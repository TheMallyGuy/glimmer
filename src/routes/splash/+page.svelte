<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { sizeWindow } from '$lib/window';
  import { cn } from '$lib';

  interface LaunchProgress {
    status: string;
    progress: number | null;
    done?: boolean;
    error?: string;
  }

  // Wire these to the launch events. progress: 0–100, or null while unknown.
  let status = $state('Checking for updates');
  let progress = $state<number | null>(null);
  let error = $state<string | null>(null);

  const GRID_OPACITY = 0.2;

  const appWindow = getCurrentWindow();
  let unlisten: UnlistenFn | undefined;

  onMount(() => {
    sizeWindow(671, 329);
    appWindow.setResizable(false);

    // TODO: Rust side doesn't emit this yet - wire the launch command up to emit
    // 'launch-progress' events shaped like LaunchProgress.
    listen<LaunchProgress>('launch-progress', (event) => {
      status = event.payload.status;
      progress = event.payload.progress;
      error = event.payload.error ?? null;

      if (event.payload.done && !error) {
        appWindow.close();
      }
    }).then((fn) => (unlisten = fn));
  });

  onDestroy(() => unlisten?.());

  function cancel() {
    if (error) {
      appWindow.close();
      return;
    }
    // TODO: invoke a Tauri command to cancel the in-progress launch, e.g. invoke('cancel_launch')
    appWindow.close();
  }

  function retry() {
    error = null;
    progress = null;
    status = 'Checking for updates';
    // TODO: invoke the launch command again, e.g. invoke('launch', { target })
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
        Try again
      </button>
    {/if}
    <button
      type="button"
      class="h-11 cursor-pointer rounded-gl border-0 bg-transparent px-4 text-sm text-fg-3 hover:bg-hover hover:text-fg"
      onclick={cancel}
    >
      {error ? 'Close' : 'Cancel'}
    </button>
  </div>

  <!-- Logo -->
  <div data-tauri-drag-region class="relative flex grow items-center justify-center">
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
    <p class={cn('m-0 grow truncate text-sm', error ? 'text-danger' : 'text-fg-3')}>
      {error ?? `${status}…`}
    </p>
    {#if progress !== null && !error}
      <span class="font-display text-[22px] font-normal tracking-[0.01em] text-fg tabular-nums">
        {Math.round(progress)}%
      </span>
    {/if}
  </div>

  <!-- Progress line: flush with the bottom edge -->
  <div
    role="progressbar"
    aria-label="Launch progress"
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={progress ?? undefined}
    class="relative h-0.5 w-full overflow-hidden bg-progress-track"
  >
    {#if progress === null && !error}
      <div class="splash-indeterminate absolute inset-y-0 w-1/4 bg-accent motion-reduce:left-0 motion-reduce:animate-none"></div>
    {:else}
      <div
        class={cn('h-full transition-[width] duration-200 ease-out motion-reduce:transition-none', error ? 'bg-danger' : 'bg-accent')}
        style:width="{error ? 100 : progress}%"
      ></div>
    {/if}
  </div>
</div>
