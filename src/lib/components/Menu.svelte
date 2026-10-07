<script lang="ts" module>
  export interface MenuItem {
    label: string;
    /** Shown on the right, e.g. "F2". */
    shortcut?: string;
    danger?: boolean;
    /** Small picture before the label. A url, or null for a placeholder; leave out for no picture. */
    avatar?: string | null;
    /** Makes the item a radio: true marks the current choice. Leave out for a plain action. */
    checked?: boolean;
    /** Draws a thin gap above this item. */
    separator?: boolean;
    onselect: () => void;
  }
</script>

<script lang="ts">
  import { tick } from "svelte";
  import { Check, User } from "@lucide/svelte";
  import { cn } from "../utils";

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

  let {
    open = $bindable(false),
    x,
    y,
    items,
    label,
    returnFocus = null,
  }: Props = $props();

  let menu = $state<HTMLDivElement>();
  let buttons: HTMLButtonElement[] = $state([]);
  let pos = $state({ left: 0, top: 0 });

  $effect(() => {
    if (!open) return;
    pos = { left: x, top: y };
    tick().then(() => {
      if (!menu) return;
      if (!menu.matches(":popover-open")) menu.showPopover();
      pos = {
        left: Math.max(8, Math.min(x, innerWidth - menu.offsetWidth - 8)),
        top: Math.max(8, Math.min(y, innerHeight - menu.offsetHeight - 8)),
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
    if (e.key === "ArrowDown") {
      e.preventDefault();
      buttons[i === last ? 0 : i + 1]?.focus();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      buttons[i <= 0 ? last : i - 1]?.focus();
    } else if (e.key === "Home") {
      e.preventDefault();
      buttons[0]?.focus();
    } else if (e.key === "End") {
      e.preventDefault();
      buttons[last]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") close(false);
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
    popover="manual"
    aria-label={label}
    tabindex="-1"
    class="fixed inset-auto z-50 flex w-52 origin-top animate-pop-in flex-col rounded-gl bg-menu p-1 shadow-menu outline-none"
    style:left="{pos.left}px"
    style:top="{pos.top}px"
    {onkeydown}
  >
    {#each items as item, i}
      {#if item.separator}<div
          class="my-1 h-px bg-track"
          role="separator"
        ></div>{/if}
      <button
        bind:this={buttons[i]}
        type="button"
        role={item.checked === undefined ? "menuitem" : "menuitemradio"}
        aria-checked={item.checked}
        class={cn(
          "flex h-8 cursor-pointer items-center justify-between gap-4 rounded-gl border-0 bg-transparent px-2.5 text-left text-sm",
          "hover:bg-menu-active focus-visible:bg-menu-active focus-visible:-outline-offset-2",
          item.danger ? "text-danger" : "text-fg",
        )}
        onclick={() => select(item)}
      >
        <span class="flex min-w-0 items-center gap-2">
          {#if item.avatar !== undefined}
            <span
              class="flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-gl bg-field text-muted"
            >
              {#if item.avatar}
                <img src={item.avatar} alt="" class="size-full object-cover" />
              {:else}
                <User size={12} strokeWidth={1.75} aria-hidden="true" />
              {/if}
            </span>
          {/if}
          <span class="min-w-0 truncate">{item.label}</span>
        </span>
        {#if item.shortcut}<span class="text-xs text-subtle"
            >{item.shortcut}</span
          >{/if}
        {#if item.checked}<Check
            size={16}
            strokeWidth={1.75}
            aria-hidden="true"
            class="shrink-0 text-accent"
          />{/if}
      </button>
    {/each}
  </div>
{/if}
