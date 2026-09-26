<script lang="ts">
  import { onMount, onDestroy } from 'svelte';
  import { getCurrentWindow } from '@tauri-apps/api/window';
  import { listen, type UnlistenFn } from '@tauri-apps/api/event';
  import { Button, cn } from '$lib';
  import { settings } from '$lib/settings.svelte';
  import { sizeWindow } from '$lib/window';

  interface LaunchProgress {
    status: string;
    progress: number | null;
    done?: boolean;
    error?: string;
  }

  let status = $state('Downloading client…');
  let progress = $state<number | null>(null);
  let error = $state<string | null>(null);

  const appWindow = getCurrentWindow();
  let unlisten: UnlistenFn | undefined;

  const pct = $derived(progress === null ? null : Math.round(progress));

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
        if (settings.close) appWindow.close();
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

  function tryAgain() {
    error = null;
    progress = null;
    status = 'Downloading client…';
    // TODO: invoke the launch command again, e.g. invoke('launch', { target })
  }
</script>

<div
  data-tauri-drag-region
  class="relative flex h-screen w-screen flex-col overflow-hidden bg-canvas"
  style="background-image: linear-gradient(180deg, var(--color-tonal) 0px, var(--color-canvas) 78px, var(--color-canvas) 100%)"
>
  <div
    class="pointer-events-none absolute inset-0"
    style="background-image: linear-gradient(to right, rgb(255 255 255 / 0.2) 1px, transparent 1px), linear-gradient(to bottom, rgb(255 255 255 / 0.2) 1px, transparent 1px); background-size: 45.12px 47px;"
  ></div>

  <div class="relative flex justify-end gap-1 p-2">
    <Button variant="ghost" onclick={cancel}>{error ? 'Close' : 'Cancel'}</Button>
    {#if error}
      <Button variant="secondary" onclick={tryAgain}>Try again</Button>
    {/if}
  </div>

  <div data-tauri-drag-region class="relative flex grow flex-col items-center justify-center gap-6">
    <img src="/glimmer-logo.svg" alt="Glimmer" width="199" class="pointer-events-none h-auto" />

    <div class="flex w-[320px] flex-col gap-2">
      <div class="flex items-baseline justify-between gap-4" aria-live="polite">
        <span class={cn('text-sm', error ? 'text-danger' : 'text-fg-3')}>{error ?? status}</span>
        <span class="font-display text-sm font-normal tracking-[0.01em] text-fg tabular-nums">
          {pct !== null ? `${pct}%` : ''}
        </span>
      </div>

      <div
        role="progressbar"
        aria-label="Launch progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct ?? undefined}
        class="relative h-1 w-full overflow-hidden rounded-gl bg-progress-track"
      >
        {#if pct !== null}
          <div
            class={cn('h-full transition-[width] motion-reduce:transition-none', error ? 'bg-danger' : 'bg-accent')}
            style="width: {pct}%"
          ></div>
        {:else}
          <div
            class={cn(
              'absolute inset-y-0 left-0 w-1/4 animate-progress-indeterminate motion-reduce:animate-none',
              error ? 'bg-danger' : 'bg-accent'
            )}
          ></div>
        {/if}
      </div>
    </div>
  </div>
</div>
