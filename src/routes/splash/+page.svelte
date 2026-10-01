<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { listen, type UnlistenFn } from "@tauri-apps/api/event";
  import { join } from "@tauri-apps/api/path";
  import { sizeWindow } from "$lib/window";
  import { cn } from "$lib";
  import { Downloader } from "$ts/roblox/installation/download";
  import {
    Installation,
    type InstallEntry,
  } from "$ts/roblox/installation/installation";
  import { DEFAULT_BASE_URLS, installVersion } from "$ts/roblox/installation";
  import { appState } from "$lib/appState.svelte";
  import { loadMods, applyMods, backupNewVersion } from "$lib/mods.svelte";
  import { FastFlagManager } from "$ts/roblox/flags";
  import { flagsToObject } from "$lib/flags";
  import { commands } from "$ts/bindings";
  import { _ } from "svelte-i18n";
  import { delay } from "$ts/utils";
  import { app } from "@tauri-apps/api";

  const PLAYER_EXE = "RobloxPlayerBeta.exe";

  interface LaunchProgress {
    status: string;
    progress: number | null;
    done?: boolean;
    error?: string;
  }

  let status = $state($_("splash.checkingForUpdates"));
  let progress = $state<number | null>(null);
  let error = $state<string | null>(null);

  const GRID_OPACITY = 0.2;

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
    );

    await i.setActiveVersion(version);

    status = $_("splash.backingUpModOriginals");
    try {
      await backupNewVersion();
    } catch (e) {
      console.error("failed to back up new version for mods:", e);
    }

    progress = null;
  }

  /** spawn RobloxPlayerBeta.exe from an installed version's folder */
  async function launchInstall(installPath: string) {
    const launchStatus = status;

    status = $_("splash.applyingMods");
    await loadMods();
    try {
      await applyMods();
    } catch (e) {
      console.error("failed to apply mods before launch:", e);
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

    commands.setFullscreenProp(
      appState.integrations.disableFullscreenOptimization.enabled,
      await join(installPath, 'RobloxPlayerBeta.exe')
    );

    status = launchStatus;

    const exePath = await join(installPath, PLAYER_EXE);
    const result = await commands.launch(exePath, []);

    if (result.status === "error") {
      throw new Error(result.error);
    }
  }

  async function checkAndLaunch() {
    try {
      const d = await Downloader.create(DEFAULT_BASE_URLS);
      const i = await Installation.create();

      const existingInstallations: InstallEntry[] = await i.listInstallations();

      if (existingInstallations.length === 0) {
        const latest = await d.fetchLatestVersion("WindowsPlayer");
        await downloadAndInstall(d, i, latest);

        status = $_("splash.launching", { values: { version: latest } });

        await launchInstall(await join(i.installationPath, latest));
      } else {
        const active = i.getActiveVersion() ?? existingInstallations[0];

        if (appState.installations.disableRobloxUpgrade) {
          status = $_("splash.launching", {
            values: { version: active.version },
          });

          await launchInstall(active.path);
        } else {
          const latest = await d.fetchLatestVersion("WindowsPlayer");
          const upToDate = existingInstallations.find(
            (ver) => ver.version == latest,
          );

          if (upToDate) {
            status = $_("splash.launching", {
              values: { version: upToDate.version },
            });

            await launchInstall(upToDate.path);
          } else {
            await downloadAndInstall(d, i, latest);

            status = $_("splash.launching", { values: { version: latest } });

            await launchInstall(await join(i.installationPath, latest));
          }
        }
      }

      if (appState.integrations.closeCrashHandler.enabled) {
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
  style="background-image: linear-gradient(180deg, #1f1f1f 0px, #0d0d0d 78px, #0d0d0d 100%);"
>
  <!-- Grid overlay -->
  <div
    aria-hidden="true"
    class="pointer-events-none absolute inset-0"
    style="background-image: linear-gradient(to right, rgb(255 255 255 / {GRID_OPACITY}) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / {GRID_OPACITY}) 1px, transparent 1px); background-size: 45.12px 47px;"
  ></div>

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

  <!-- Logo -->
  <div
    data-tauri-drag-region
    class="relative flex grow items-center justify-center"
  >
    <img
      src="/glimmer-logo.svg"
      alt="Glimmer"
      width="199"
      height="44"
      class="pointer-events-none block h-11 w-[199px]"
    />
  </div>

  <!-- Status row -->
  <div class="relative flex items-baseline gap-4 px-7 pb-5" aria-live="polite">
    <p
      class={cn(
        "m-0 grow truncate text-sm",
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
