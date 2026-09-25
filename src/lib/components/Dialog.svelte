<script lang="ts">
  import type { Snippet } from 'svelte';
  import { X } from '@lucide/svelte';
  import IconButton from './IconButton.svelte';
  import { cn } from '../utils';

  interface Props {
    open?: boolean;
    title: string;
    /** Close when the dimmed area outside the dialog is clicked. */
    closeOnBackdrop?: boolean;
    width?: string;
    class?: string;
    children?: Snippet;
    /** Buttons, right-aligned at the bottom. */
    actions?: Snippet;
    onclose?: () => void;
  }

  let {
    open = $bindable(false),
    title,
    closeOnBackdrop = true,
    width = '440px',
    class: className = '',
    children,
    actions,
    onclose
  }: Props = $props();

  const uid = $props.id();
  let dialog: HTMLDialogElement;

  $effect(() => {
    if (open && !dialog.open) dialog.showModal();
    else if (!open && dialog.open) dialog.close();
  });

  function handleClose() {
    open = false;
    onclose?.();
  }

  function onBackdrop(e: MouseEvent) {
    if (closeOnBackdrop && e.target === dialog) open = false;
  }
</script>

<!-- svelte-ignore a11y_click_events_have_key_events, a11y_no_noninteractive_element_interactions (Escape is handled natively by <dialog>) -->
<dialog
  bind:this={dialog}
  aria-labelledby="{uid}-title"
  style:width
  class={cn(
    'm-auto max-w-[calc(100vw-32px)] rounded-gl border-0 bg-dialog p-0 text-fg shadow-dialog backdrop:bg-black/60',
    className
  )}
  onclose={handleClose}
  onclick={onBackdrop}
>
  <div class="flex flex-col gap-3 pt-6 pr-6 pb-5 pl-7">
    <header class="flex items-start gap-4">
      <h2 id="{uid}-title" class="m-0 grow pt-1.5 font-display text-[22px] font-normal tracking-[0.01em]">{title}</h2>
      <IconButton label="Close" variant="ghost" size="sm" class="-mr-2" onclick={() => (open = false)}>
        <X size={16} strokeWidth={1.75} aria-hidden="true" />
      </IconButton>
    </header>
    {#if children}
      <div class="text-sm leading-[1.55] text-fg-2 [&_p]:m-0">{@render children()}</div>
    {/if}
    {#if actions}
      <footer class="flex justify-end gap-1 pt-4">{@render actions()}</footer>
    {/if}
  </div>
</dialog>
