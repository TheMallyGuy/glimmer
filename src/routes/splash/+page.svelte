<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { isTauri } from "@tauri-apps/api/core";
  import { type UnlistenFn } from "@tauri-apps/api/event";
  import { page } from "$app/state";
  import { sizeWindow } from "$lib/window";
  import { cn } from "$lib";
  import { loadAppState } from "$lib/appState.svelte";
  import { launch, LaunchError, type LaunchStatus } from "$ts/launch";
  import { app } from "@tauri-apps/api";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const splashContent = useIntlayer("splash");

  // the chooser and the footer pass ?target=studio; anything else launches the player
  const isStudio = page.url.searchParams.get("target") === "studio";
  // a link from the Roblox website or a deep link, to launch with as Roblox's own launcher would
  const link = page.url.searchParams.get("link");

  let status = $state($splashContent.checkingForUpdates.value);
  let progress = $state<number | null>(null);
  let error = $state<string | null>(null);

  // there is no window outside Tauri (e.g. in the intlayer editor)
  const appWindow = isTauri() ? getCurrentWindow() : null;
  let unlisten: UnlistenFn | undefined;

  /** what the launch is doing, in the person's language */
  function statusText(next: LaunchStatus) {
    switch (next.step) {
      case "downloadingClient":
        return $splashContent.downloadingClient({
          done: next.done,
          total: next.total,
        }).value;
      case "extractingClient":
        return $splashContent.extractingClient({
          done: next.done,
          total: next.total,
        }).value;
      case "downloadingModOriginals":
        return $splashContent.downloadingModOriginals({
          done: next.done,
          total: next.total,
        }).value;
      case "signingIn":
        return $splashContent.signingIn({ name: next.name }).value;
      case "launching":
        return $splashContent.launching({ version: next.version }).value;
      default:
        return $splashContent[next.step].value;
    }
  }

  function report(next: LaunchStatus, percent: number | null) {
    status = statusText(next);
    progress = percent;
  }

  /** why the launch failed, in the person's language */
  function errorText(e: unknown) {
    if (e instanceof LaunchError) {
      switch (e.kind) {
        case "accountNeeded":
          return $splashContent.accountNeeded.value;
        case "accountExpired":
          return $splashContent.accountExpired({ name: e.account }).value;
        case "accountMissing":
          return $splashContent.accountMissing({ name: e.account }).value;
        case "accountFailed":
          return $splashContent.accountFailed({
            name: e.account,
            error: e.message,
          }).value;
      }
    }
    if (e instanceof Error) return e.message;
    if (typeof e === "string") return e;
    return $splashContent.genericError.value;
  }

  async function checkAndLaunch() {
    try {
      await launch({ target: isStudio ? "studio" : "player", link }, report);

      // launched successfully: close just this window, not the whole app
      await appWindow?.close();
    } catch (e) {
      error = errorText(e);
    }
  }

  onMount(async () => {
    // outside Tauri (e.g. the intlayer editor) there is nothing to install or launch
    if (!isTauri()) return;

    sizeWindow(671, 329);
    appWindow?.setResizable(false);

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
      appWindow?.close();
      return;
    }
    appWindow?.close();
  }

  function retry() {
    error = null;
    progress = null;
    status = $splashContent.checkingForUpdates.value;
    checkAndLaunch();
  }
</script>

<div
  data-tauri-drag-region
  class="relative flex h-screen w-screen flex-col overflow-hidden bg-app text-fg"
>
  <!-- Artwork: background, grid, corner arcs and the Glimmer wordmark in one 671x329 file -->
  <img
    src="/splash-bg.svg"
    alt="Glimmer"
    width="671"
    height="329"
    class="pointer-events-none absolute inset-0 h-full w-full animate-fade-in"
  />

  <!-- Top row -->
  <div class="relative flex justify-end gap-1 p-2">
    {#if error}
      <button
        type="button"
        class="h-11 cursor-pointer rounded-gl border-0 bg-tonal px-4 text-sm text-fg hover:bg-tonal-hover"
        onclick={retry}
      >
        {$commonContent.tryAgain.value}
      </button>
    {/if}
    <button
      type="button"
      class="h-11 cursor-pointer rounded-gl border-0 bg-transparent px-4 text-sm text-fg-3 hover:bg-hover hover:text-fg"
      onclick={cancel}
    >
      {error ? $commonContent.close.value : $commonContent.cancel.value}
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
    aria-label={$splashContent.launchProgress.value}
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
