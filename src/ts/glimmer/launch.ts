// file for launching glimmer by func
import { join } from "@tauri-apps/api/path";
import { commands } from "$ts/bindings";
import { appState, rememberFleasionPath } from "$lib/appState.svelte";
import { flagsToObject } from "$lib/flags";
import { applyMods, loadMods } from "$lib/mods.svelte";
import {
  Downloader,
  type Distribution,
  type WindowBinaryType,
} from "$ts/roblox/installation/download";
import {
  Installation,
  type InstallEntry,
} from "$ts/roblox/installation/installation";
import {
  DEFAULT_BASE_URLS,
  installVersion,
  installName,
} from "$ts/roblox/installation";
import { PackageCache } from "$ts/roblox/installation/packageCache";
import { FastFlagManager } from "$ts/roblox/fastflag/flags";
import { hiddenFlags } from "$ts/roblox/fastflag/fleasionPresets";
import {
  AccountLauncher,
  AccountLaunchError,
} from "$ts/roblox/account/launcher";
import { GameLink, type GameTarget } from "$ts/roblox/game";
import { LocalAppEditor } from "$ts/roblox/localApp";
import { delay } from "$ts/utils";
import { restartFleasion } from "$ts/fleasion/restart";

export type LaunchTarget = "player" | "studio";

export interface LaunchOptions {
  target: LaunchTarget;
  /**
   * a link from the Roblox website or a deep link, to launch with as Roblox's own launcher would
   * (the player only, Studio ignores it)
   */
  link?: string | null;
}

/** what a launch is doing, for the window to say in the person's language */
export type LaunchStatus =
  | {
    step:
    | "checkingForUpdates"
    | "fetchingManifest"
    | "finishingInstallation"
    | "applyingMods"
    | "applyingFlags"
    | "stoppingFleasion"
    | "startingFleasion"
    | "prepare";
  }
  | {
    step: "downloadingClient" | "extractingClient" | "downloadingModOriginals";
    done: number;
    total: number;
  }
  | { step: "signingIn"; name: string }
  | { step: "launching"; version: string };

/** called whenever the launch moves on: what it is doing, and how far it is (percent) when that is known */
export type LaunchReport = (
  status: LaunchStatus,
  progress: number | null,
) => void;

/** why a launch could not sign in as the selected account, for the window to say in the person's language */
export class LaunchError extends Error {
  constructor(
    readonly kind:
      | "accountNeeded"
      | "accountExpired"
      | "accountMissing"
      | "accountFailed",
    /** the display name of the account, for the message */
    readonly account: string,
    /** what went wrong, when the kind does not say it already */
    message: string,
  ) {
    super(message);
  }
}

export interface LaunchContext {
  isStudio: boolean;
  /** how the link of the launch is used, see `parseLaunchLink` */
  link: ReturnType<typeof parseLaunchLink>;
  report: LaunchReport;
}

/**
 * how a link launches: a roblox-player: link goes to the player as it is, a roblox://experiences/start
 * link names a game to sign in to, and any other roblox:// link (a profile, the avatar page...) goes to the
 * player as it is too
 */
export function parseLaunchLink(link: string | null | undefined) {
  const game = link ? GameLink.parse(link) : null;
  const playerLink =
    link &&
      (/^roblox-player:/i.test(link) || (/^roblox:/i.test(link) && !game))
      ? link
      : null;
  return { playerLink, game };
}

/** a failure of the account launch as one the window can word, anything else as it is */
function accountFailure(e: unknown, name: string) {
  if (!(e instanceof AccountLaunchError)) return e;
  return new LaunchError(
    e.kind === "expired"
      ? "accountExpired"
      : e.kind === "missing"
        ? "accountMissing"
        : "accountFailed",
    name,
    e.message,
  );
}

/**
 * the arguments that sign the player in as the selected account, or none to leave Roblox on its
 * own login. Built right before launching because the login ticket expires within a minute.
 */
export async function launchArgs(
  { isStudio, link, report }: LaunchContext,
  launcher: Pick<AccountLauncher, "args" | "gameArgs"> = new AccountLauncher(),
): Promise<string[]> {
  if (link.playerLink) return [link.playerLink];

  const id = appState.accounts.activeId;
  const account = appState.accounts.list.find((a) => a.id === id);

  if (link.game) {
    // a game link carries no login ticket, so only one of Glimmer's accounts can sign it in
    if (!account) throw new LaunchError("accountNeeded", "", "");

    report({ step: "signingIn", name: account.displayName }, null);
    try {
      return await launcher.gameArgs(account.id, link.game);
    } catch (e) {
      throw accountFailure(e, account.displayName);
    }
  }

  if (isStudio || !account) return [];

  report({ step: "signingIn", name: account.displayName }, null);
  try {
    return await launcher.args(account.id);
  } catch (e) {
    throw accountFailure(e, account.displayName);
  }
}

/** downloads, extracts and installs a client version, then marks it active */
async function downloadAndInstall(
  isStudio: boolean,
  binaryType: WindowBinaryType,
  report: LaunchReport,
  d: Downloader,
  i: Installation,
  version: string,
) {
  await installVersion(
    d,
    i,
    version,
    appState.installations.parallelDownloader.value,
    (p) => {
      switch (p.status) {
        case "fetchingManifest":
          report({ step: "fetchingManifest" }, null);
          break;
        case "downloading":
          report(
            { step: "downloadingClient", done: p.done, total: p.total },
            p.percent,
          );
          break;
        case "extracting":
          report(
            { step: "extractingClient", done: p.done, total: p.total },
            p.percent,
          );
          break;
        case "finishing":
          report({ step: "finishingInstallation" }, null);
          break;
      }
    },
    binaryType,
    !isStudio, // the player's zips are what mods restore stock files from
  );

  await i.setActiveVersion(installName(version, d.distribution));

  // mods are only applied to the player, and only the active version's zips are needed to restore it
  if (!isStudio) {
    try {
      await (
        await PackageCache.create()
      ).prune(installName(version, d.distribution));
    } catch (e) {
      console.error("failed to prune old package cache:", e);
    }
  }
}

/** spawns the player or Studio executable from an installed version's folder */
async function launchInstall(
  context: LaunchContext,
  exeName: string,
  installPath: string,
  version: string,
) {
  const { isStudio, report } = context;

  if (!isStudio) {
    report({ step: "applyingMods" }, null);
    await loadMods();
    try {
      await applyMods((done, total, percent) =>
        report({ step: "downloadingModOriginals", done, total }, percent),
      );
    } catch (e) {
      console.error("failed to apply mods before launch:", e);
    }
  }

  const ffm = await FastFlagManager.create(installPath);
  const hidden = await hiddenFlags(appState.integrations.fleasion);

  if (appState.fastflags.enabled || Object.keys(hidden).length > 0) {
    report({ step: "applyingFlags" }, null);

    try {
      await ffm.apply(appState.fastflags.enabled ? flagsToObject(appState.fastflags.flags) : {}, hidden);
    } catch (e) {
      console.error("failed to apply fast flags before launch:", e);
    }
  } else {
    await ffm.disableFlags();
  }

  report({ step: "prepare" }, null);

  const exePath = await join(installPath, exeName);

  if (!isStudio) {
    commands.setFullscreenProp(
      appState.integrations.disableFullscreenOptimization.enabled,
      exePath,
    );

    const lca = await LocalAppEditor.create();
    await lca.setMinimizeToTray(
      appState.integrations.disableSystemTray.enabled,
    );
    await lca.launchAtStartup(
      !appState.integrations.disableLaunchAtStartup.enabled,
    );
  }

  if (!isStudio && appState.integrations.fleasion.enabled) {
    try {
      const fleasion = appState.integrations.fleasion;
      const account = appState.accounts.list.find((a) => a.id === appState.accounts.activeId);
      const name = fleasion.settings.name.trim() || account?.name || "";

      if (!name && (fleasion.settings.verify || fleasion.settings.gameCreator)) {
        console.warn("Fleasion keeps its username spoofer off with no name: set one on the Fleasion page");
      }

      await restartFleasion(
        { ...fleasion.settings, name },
        { ...hidden, ...(appState.fastflags.enabled ? flagsToObject(appState.fastflags.flags) : {}) },
        report,
        { path: fleasion.path, onPathFound: rememberFleasionPath },
      );
    } catch (e) {
      console.error("failed to restart Fleasion before launch:", e);
    }
  }

  report({ step: "launching", version }, null);

  const result = await commands.launch(exePath, await launchArgs(context));

  if (result.status === "error") {
    throw new Error(result.error);
  }
}

/**
 * Updates Roblox when it needs it and starts it, as `options` say. Says what it is doing through
 * `report`. Fails with a `LaunchError` when the account to sign in as can't be used, or with the
 * error of the step that failed.
 */
export async function launch(options: LaunchOptions, report: LaunchReport) {
  const isStudio = options.target === "studio";
  const binaryType: WindowBinaryType = isStudio
    ? "WindowsStudio64"
    : "WindowsPlayer";
  const exeName = isStudio ? "RobloxStudioBeta.exe" : "RobloxPlayerBeta.exe";
  const context: LaunchContext = {
    isStudio,
    link: parseLaunchLink(isStudio ? null : options.link),
    report,
  };

  report({ step: "checkingForUpdates" }, null);

  // VNG only distributes the player, so Studio always uses the global CDN
  const distribution: Distribution =
    !isStudio && appState.installations.vngDistribution.enabled
      ? "vng"
      : "global";
  const d = await Downloader.create(DEFAULT_BASE_URLS, distribution);
  const i = await Installation.create(true, isStudio ? "studio" : "player");

  const install = (version: string) =>
    downloadAndInstall(isStudio, binaryType, report, d, i, version);
  const start = (path: string, version: string) =>
    launchInstall(context, exeName, path, version);

  const existingInstallations: InstallEntry[] = await i.listInstallations();
  const pinned = i.getPinnedVersion();

  if (pinned) {
    // a pinned version stays as it is, whatever the latest one is
    await start(pinned.path, pinned.version);
  } else if (existingInstallations.length === 0) {
    const latest = await d.fetchLatestVersion(binaryType);
    const name = installName(latest, distribution);
    await install(latest);

    await start(await join(i.installationPath, name), name);
  } else {
    const active = i.getActiveVersion() ?? existingInstallations[0];

    if (appState.installations.disableRobloxUpgrade.enabled) {
      await start(active.path, active.version);
    } else {
      const latest = await d.fetchLatestVersion(binaryType);
      const name = installName(latest, distribution);
      const upToDate = existingInstallations.find(
        (ver) => ver.version === name,
      );

      if (upToDate) {
        await start(upToDate.path, upToDate.version);
      } else {
        await install(latest);

        await start(await join(i.installationPath, name), name);
      }
    }
  }

  if (!isStudio && appState.integrations.closeCrashHandler.enabled) {
    await delay(5000);
    await commands.closeCrashHandler();
  }
}
