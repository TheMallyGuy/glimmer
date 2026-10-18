// file for launching glimmer by func
import { join } from "@tauri-apps/api/path";
import { commands } from "$ts/glimmer/bindings";
import { appState, rememberFleasionPath } from "$lib/appState.svelte";
import { flagsToObject } from "$lib/flags";
import { applyMods, loadMods } from "$lib/mods.svelte";
import { FastFlagManager } from "$ts/roblox/fastflag/flags";
import { hiddenFlags } from "$ts/roblox/fastflag/fleasionPresets";
import { LocalAppEditor } from "$ts/roblox/localApp";
import { restartFleasion } from "$ts/fleasion/restart";
import { delay } from "$ts/glimmer/utils";
import { launchArgs, parseLaunchLink } from "./args";
import { pickVersion } from "./version";
import type { LaunchContext, LaunchOptions, LaunchReport } from "./types";

export * from "./types";
export { launchArgs, parseLaunchLink } from "./args";

export async function launch(options: LaunchOptions, report: LaunchReport) {
  const isStudio = options.target === "studio";
  const isPlayer = !isStudio;
  const context: LaunchContext = {
    isStudio,
    link: await parseLaunchLink(isStudio ? null : options.link),
    report,
  };

  // 1. version
  report({ step: "checkingForUpdates" }, null);
  const { path, version } = await pickVersion(isStudio, report);

  // 2. mods (player only)
  if (isPlayer) {
    report({ step: "applyingMods" }, null);
    await loadMods();
    await tryStep("apply mods", () =>
      applyMods((done, total, percent) =>
        report({ step: "downloadingModOriginals", done, total }, percent),
      ),
    );
  }

  // 3. fast flags: the person's own, plus the ones a Fleasion option asks for
  const flags = appState.fastflags.enabled ? flagsToObject(appState.fastflags.flags) : {};
  const hidden = await hiddenFlags(appState.integrations.fleasion);
  const ffm = await FastFlagManager.create(path);
  if (appState.fastflags.enabled || Object.keys(hidden).length > 0) {
    report({ step: "applyingFlags" }, null);
    await tryStep("apply fast flags", () => ffm.apply(flags, hidden));
  } else {
    await ffm.disableFlags();
  }

  // 4. player settings (player only)
  report({ step: "prepare" }, null);
  const exePath = await join(path, isStudio ? "RobloxStudioBeta.exe" : "RobloxPlayerBeta.exe");
  if (isPlayer) {
    commands.setFullscreenProp(
      appState.integrations.disableFullscreenOptimization.enabled,
      exePath,
    );
    const lca = await LocalAppEditor.create();
    await lca.setMinimizeToTray(appState.integrations.disableSystemTray.enabled);
    await lca.launchAtStartup(!appState.integrations.disableLaunchAtStartup.enabled);
  }

  // 5. Fleasion (player only): restarted so it takes the launch over
  if (isPlayer && appState.integrations.fleasion.enabled) {
    await tryStep("restart Fleasion", () => startFleasion({ ...hidden, ...flags }, report));
  }

  // 6. launch
  report({ step: "launching", version }, null);
  const result = await commands.launch(exePath, await launchArgs(context));
  if (result.status === "error") throw new Error(result.error);

  // 7. after launch (player only)
  if (isPlayer && appState.integrations.closeCrashHandler.enabled) {
    await delay(5000);
    await commands.closeCrashHandler();
  }
}

/** runs a step the launch can go on without, logging its failure */
async function tryStep(what: string, step: () => Promise<unknown>) {
  try {
    await step();
  } catch (e) {
    console.error(`failed to ${what} before launch:`, e);
  }
}

async function startFleasion(flags: Record<string, string>, report: LaunchReport) {
  const fleasion = appState.integrations.fleasion;
  const account = appState.accounts.list.find((a) => a.id === appState.accounts.activeId);
  const name = fleasion.settings.name.trim() || account?.name || "";

  if (!name && (fleasion.settings.verify || fleasion.settings.gameCreator)) {
    console.warn(
      "Fleasion keeps its username spoofer off with no name: set one on the Fleasion page",
    );
  }

  await restartFleasion({ ...fleasion.settings, name }, flags, report, {
    path: fleasion.path,
    onPathFound: rememberFleasionPath,
  });
}
