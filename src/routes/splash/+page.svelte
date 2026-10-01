<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { join } from "@tauri-apps/api/path";
  import { page } from "$app/state";
  import { sizeWindow } from "$lib/window";
  import { cn } from "$lib";
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
  import { appState, loadAppState } from "$lib/appState.svelte";
  import { loadMods, applyMods, backupNewVersion } from "$lib/mods.svelte";
  import { FastFlagManager } from "$ts/roblox/flags";
  import { flagsToObject } from "$lib/flags";
  import { commands } from "$ts/bindings";
  import { _ } from "svelte-i18n";
  import { delay } from "$ts/utils";
  import { app } from "@tauri-apps/api";
  import { LocalAppEditor } from "$ts/roblox/localApp";

  // the chooser and the footer pass ?target=studio; anything else launches the player
  const isStudio = page.url.searchParams.get("target") === "studio";
  const binaryType: WindowBinaryType = isStudio
    ? "WindowsStudio64"
    : "WindowsPlayer";
  const EXE_NAME = isStudio ? "RobloxStudioBeta.exe" : "RobloxPlayerBeta.exe";

  interface LaunchProgress {
    status: string;
    progress: number | null;
    done?: boolean;
    error?: string;
  }

  let status = $state($_("splash.checkingForUpdates"));
  let progress = $state<number | null>(null);
  let error = $state<string | null>(null);

  const appWindow = getCurrentWindow();
  let unlisten: UnlistenFn | undefined;

  /** downloads, extracts and installs a client version, then marks it active */
  async function downloadAndInstall(
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
            status = $_("splash.fetchingManifest");
            progress = null;
            break;
          case "downloading":
            status = $_("splash.downloadingClient", {
              values: { done: p.done, total: p.total },
            });
            progress = p.percent;
            break;
          case "extracting":
            status = $_("splash.extractingClient", {
              values: { done: p.done, total: p.total },
            });
            progress = p.percent;
            break;
          case "finishing":
            status = $_("splash.finishingInstallation");
            progress = null;
            break;
        }
      },
      binaryType,
    );

    await i.setActiveVersion(installName(version, d.distribution));

    // mods are only applied to the player install, so there are no originals to back up for Studio
    if (!isStudio) {
      status = $_("splash.backingUpModOriginals");
      try {
        await backupNewVersion();
      } catch (e) {
        console.error("failed to back up new version for mods:", e);
      }
    }

    progress = null;
  }

  /** spawn the player or Studio executable from an installed version's folder */
  async function launchInstall(installPath: string) {
    const launchStatus = status;

    if (!isStudio) {
      status = $_("splash.applyingMods");
      await loadMods();
      try {
        await applyMods();
      } catch (e) {
        console.error("failed to apply mods before launch:", e);
      }
    }

    const ffm = await FastFlagManager.create(installPath);

    if (appState.fastflags.enabled) {
      status = $_("splash.applyingFlags");
      try {
        await ffm.apply(flagsToObject(appState.fastflags.flags));
      } catch (e) {
        console.error("failed to apply fast flags before launch:", e);
      }
    } else {
      await ffm.disableFlags();
    }

    status = $_("splash.prepare");

    if (!isStudio) {
      commands.setFullscreenProp(
        appState.integrations.disableFullscreenOptimization.enabled,
        await join(installPath, EXE_NAME),
      );
    }

    if (!isStudio) {
      const lca = await LocalAppEditor.create();
      await lca.setMinimizeToTray(
        appState.integrations.disableSystemTray.enabled,
      );
      await lca.launchAtStartup(
        !appState.integrations.disableLaunchAtStartup.enabled,
      );
    }

    status = launchStatus;

    const exePath = await join(installPath, EXE_NAME);
    const result = await commands.launch(exePath, []);

    if (result.status === "error") {
      throw new Error(result.error);
    }
  }

  async function checkAndLaunch() {
    try {
      // VNG only distributes the player, so Studio always uses the global CDN
      const distribution: Distribution =
        !isStudio && appState.installations.vngDistribution.enabled
          ? "vng"
          : "global";
      const d = await Downloader.create(DEFAULT_BASE_URLS, distribution);
      const i = await Installation.create(true, isStudio ? "studio" : "player");

      const existingInstallations: InstallEntry[] = await i.listInstallations();

      if (existingInstallations.length === 0) {
        const latest = await d.fetchLatestVersion(binaryType);
        const name = installName(latest, distribution);
        await downloadAndInstall(d, i, latest);

        status = $_("splash.launching", { values: { version: name } });

        await launchInstall(await join(i.installationPath, name));
      } else {
        const active = i.getActiveVersion() ?? existingInstallations[0];

        if (appState.installations.disableRobloxUpgrade.enabled) {
          status = $_("splash.launching", {
            values: { version: active.version },
          });

          await launchInstall(active.path);
        } else {
          const latest = await d.fetchLatestVersion(binaryType);
          const name = installName(latest, distribution);
          const upToDate = existingInstallations.find(
            (ver) => ver.version === name,
          );

          if (upToDate) {
            status = $_("splash.launching", {
              values: { version: upToDate.version },
            });

            await launchInstall(upToDate.path);
          } else {
            await downloadAndInstall(d, i, latest);

            status = $_("splash.launching", { values: { version: name } });

            await launchInstall(await join(i.installationPath, name));
          }
        }
      }

      if (!isStudio && appState.integrations.closeCrashHandler.enabled) {
        await delay(5000);
        await commands.closeCrashHandler();
      }

      // launched successfully: close just this window, not the whole app
      await appWindow.close();
    } catch (e) {
      if (e instanceof Error) {
        error = e.message;
      } else if (typeof e === "string") {
        error = e;
      } else {
        error = $_("splash.genericError");
      }
    }
  }

  onMount(async () => {
    sizeWindow(671, 329);
    appWindow.setResizable(false);

    // the root layout also calls this, but its onMount races this page's --
    // load explicitly so settings like the VNG switch are in before we check
    await loadAppState();
    await checkAndLaunch();
  });

  onDestroy(() => {
    unlisten?.();
  });

  function cancel() {
    if (error) {
      appWindow.close();
      return;
    }
    appWindow.close();
  }

  function retry() {
    error = null;
    progress = null;
    status = $_("splash.checkingForUpdates");
    checkAndLaunch();
  }
</script>

<div
  data-tauri-drag-region
  class="relative flex h-screen w-screen flex-col overflow-hidden bg-canvas text-fg"
>
  <!-- Artwork: background, grid, corner arcs and the Glimmer wordmark in one 671x329 file -->
  <img
    src="/splash-bg.svg"
    alt="Glimmer"
    width="671"
    height="329"
    class="pointer-events-none absolute inset-0 h-full w-full"
  />

  <!-- Top row -->
  <div class="relative flex justify-end gap-1 p-2">
    {#if error}
      <button
        type="button"
        class="h-11 cursor-pointer rounded-gl border-0 bg-tonal px-4 text-sm text-fg hover:bg-tonal-hover"
        onclick={retry}
      >
        {$_("common.tryAgain")}
      </button>
    {/if}
    <button
      type="button"
      class="h-11 cursor-pointer rounded-gl border-0 bg-transparent px-4 text-sm text-fg-3 hover:bg-hover hover:text-fg"
      onclick={cancel}
    >
      {error ? $_("common.close") : $_("common.cancel")}
    </button>
  </div>

  <!-- Spacer over the wordmark, so the window can be dragged from it -->
  <div data-tauri-drag-region class="relative grow"></div>

  <!-- Status row -->
  <div
    class="relative flex items-baseline justify-between gap-4 px-7 pb-5"
    aria-live="polite"
  >
    <p
      class={cn(
        "m-0 max-w-[440px] min-w-0 truncate text-sm",
        error ? "text-danger" : "text-fg-3",
      )}
    >
      {error ?? `${status}…`}
    </p>
    {#if progress !== null && !error}
      <span
        class="font-display text-[22px] font-normal tracking-[0.01em] text-fg tabular-nums"
      >
        {Math.round(progress)}%
      </span>
    {/if}
  </div>

  <!-- Progress line: flush with the bottom edge -->
  <div
    role="progressbar"
    aria-label={$_("splash.launchProgress")}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={progress ?? undefined}
    class="relative h-0.5 w-full overflow-hidden bg-progress-track"
  >
    {#if progress === null && !error}
      <div
        class="splash-indeterminate absolute inset-y-0 w-1/4 bg-accent motion-reduce:left-0 motion-reduce:animate-none"
      ></div>
    {:else}
      <div
        class={cn(
          "h-full transition-[width] duration-200 ease-out motion-reduce:transition-none",
          error ? "bg-danger" : "bg-accent",
        )}
        style:width="{error ? 100 : progress}%"
      ></div>
    {/if}
  </div>
</div>
