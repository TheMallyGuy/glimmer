<script lang="ts" module>
  export interface SplitOption {
    value: string;
    label: string;
    description?: string;
  }
</script>

<script lang="ts">
  import { ArrowRight, ChevronDown, Check } from '@lucide/svelte';
  import { cn } from '../utils';

  interface Props {
    /** Main action text, e.g. "Save and launch". */
    label: string;
    options: SplitOption[];
    /** The chosen target, e.g. "player" or "studio". */
    value?: string;
    disabled?: boolean;
    /** Which way the menu opens. Use "up" in a footer. */
    placement?: 'up' | 'down';
    class?: string;
    onclick?: (value: string) => void;
    onchange?: (value: string) => void;
  }

  let {
    label,
    options,
    value = $bindable(options[0]?.value),
    disabled = false,
    placement = 'up',
    class: className = '',
    onclick,
    onchange
  }: Props = $props();

  const uid = $props.id();
  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement;
  let toggle: HTMLButtonElement;
  let items: HTMLButtonElement[] = $state([]);

  const current = $derived(options.find((o) => o.value === value) ?? options[0]);

  const half =
    'inline-flex h-11 cursor-pointer items-center border-0 bg-accent font-display tracking-[0.01em] text-on-accent transition-colors motion-reduce:transition-none hover:enabled:bg-accent-hover active:enabled:bg-accent-press disabled:cursor-not-allowed disabled:bg-track disabled:text-off';

  function show() {
    const i = options.findIndex((o) => o.value === value);
    active = i < 0 ? 0 : i;
    open = true;
  }

  function hide(refocus = true) {
    open = false;
    if (refocus) toggle?.focus();
  }

  function choose(v: string) {
    if (v !== value) {
      value = v;
      onchange?.(v);
    }
    hide();
  }

  $effect(() => {
    if (open) items[active]?.focus();
  });

  function onMenuKey(e: KeyboardEvent) {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') { e.preventDefault(); active = active === last ? 0 : active + 1; }
    else if (e.key === 'ArrowUp') { e.preventDefault(); active = active === 0 ? last : active - 1; }
    else if (e.key === 'Escape') { e.preventDefault(); hide(); }
    else if (e.key === 'Tab') hide(false);
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) hide(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div class={cn('relative inline-flex gap-0.5', className)} bind:this={root}>
  <button
    type="button"
    {disabled}
    class={cn(half, 'min-w-[168px] justify-between gap-4 rounded-l-gl px-4 text-base')}
    onclick={() => onclick?.(value!)}
  >
    {label}
    <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
  </button>
  <button
    bind:this={toggle}
    type="button"
    aria-label="Launch target: {current?.label}"
    aria-haspopup="menu"
    aria-expanded={open}
    aria-controls="{uid}-menu"
    {disabled}
    class={cn(half, 'gap-1.5 rounded-r-gl pl-3 pr-2.5 text-sm')}
    onclick={() => (open ? hide() : show())}
  >
    {current?.label}
    <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" />
  </button>

  {#if open}
    <div
      id="{uid}-menu"
      role="menu"
      aria-label="Launch target"
      tabindex="-1"
      class={cn(
        'absolute right-0 z-30 flex w-[220px] flex-col rounded-gl bg-menu p-1 shadow-menu outline-none',
        placement === 'up' ? 'bottom-[calc(100%+8px)]' : 'top-[calc(100%+8px)]'
      )}
      onkeydown={onMenuKey}
    >
      {#each options as opt, i (opt.value)}
        {@const sel = opt.value === value}
        <button
          bind:this={items[i]}
          type="button"
          role="menuitemradio"
          aria-checked={sel}
          tabindex={i === active ? 0 : -1}
          class={cn(
            'flex cursor-pointer items-center gap-3 rounded-gl border-0 bg-transparent px-2.5 py-2 text-left text-fg',
            'hover:bg-menu-active focus-visible:bg-menu-active focus-visible:-outline-offset-2',
            sel && 'bg-menu-active'
          )}
          onpointerenter={() => (active = i)}
          onclick={() => choose(opt.value)}
        >
          <span class="flex grow flex-col gap-0.5">
            <span class="text-sm">{opt.label}</span>
            {#if opt.description}<span class="text-xs text-muted">{opt.description}</span>{/if}
          </span>
          <span class={cn('flex text-accent', sel ? 'opacity-100' : 'opacity-0')}>
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </button>
      {/each}
    </div>
  {/if}
</div>
