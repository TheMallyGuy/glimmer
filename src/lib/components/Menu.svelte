<script lang="ts" module>
  export interface MenuItem {
    label: string;
    /** Shown on the right, e.g. "F2". */
    shortcut?: string;
    danger?: boolean;
    /** Draws a thin gap above this item. */
    separator?: boolean;
    onselect: () => void;
  }
</script>

<script lang="ts">
  import { tick } from 'svelte';
  import { cn } from '../utils';

  interface Props {
    open?: boolean;
    /** Viewport position (fixed). The menu is kept on screen. */
    x: number;
    y: number;
    items: MenuItem[];
    label: string;
    /** Focus goes back here when the menu closes. */
    returnFocus?: HTMLElement | null;
  }

  let { open = $bindable(false), x, y, items, label, returnFocus = null }: Props = $props();

  let menu = $state<HTMLDivElement>();
  let buttons: HTMLButtonElement[] = $state([]);
  let pos = $state({ left: 0, top: 0 });

  $effect(() => {
    if (!open) return;
    pos = { left: x, top: y };
    tick().then(() => {
      if (!menu) return;
      const r = menu.getBoundingClientRect();
      pos = {
        left: Math.max(8, Math.min(x, innerWidth - r.width - 8)),
        top: Math.max(8, Math.min(y, innerHeight - r.height - 8)),
      };
      buttons[0]?.focus();
    });
  });

  function close(refocus = true) {
    open = false;
    if (refocus) returnFocus?.focus();
  }

  function select(item: MenuItem) {
    close();
    item.onselect();
  }

  function onkeydown(e: KeyboardEvent) {
    const i = buttons.indexOf(document.activeElement as HTMLButtonElement);
    const last = items.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      buttons[i === last ? 0 : i + 1]?.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      buttons[i <= 0 ? last : i - 1]?.focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      buttons[last]?.focus();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      close();
    } else if (e.key === 'Tab') close(false);
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && menu && !menu.contains(e.target as Node)) close(false);
  }
</script>

<svelte:window
  onpointerdown={onWindowPointer}
  onblur={() => open && close(false)}
  onresize={() => open && close(false)}
/>

{#if open}
  <div
    bind:this={menu}
    role="menu"
    aria-label={label}
    tabindex="-1"
    class="fixed z-50 flex w-52 flex-col rounded-gl bg-menu p-1 shadow-menu outline-none"
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    {onkeydown}
  >
    {#each items as item, i (item.label)}
      {#if item.separator}<div class="my-1 h-px bg-track" role="separator"></div>{/if}
      <button
        bind:this={buttons[i]}
        type="button"
        role="menuitem"
        class={cn(
          'flex h-8 cursor-pointer items-center justify-between gap-4 rounded-gl border-0 bg-transparent px-2.5 text-left text-sm',
          'hover:bg-menu-active focus-visible:bg-menu-active focus-visible:-outline-offset-2',
          item.danger ? 'text-danger' : 'text-fg'
        )}
        onclick={() => select(item)}
      >
        {item.label}
        {#if item.shortcut}<span class="text-xs text-subtle">{item.shortcut}</span>{/if}
      </button>
    {/each}
  </div>
{/if}
