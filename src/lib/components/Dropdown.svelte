<script lang="ts" module>
  export interface DropdownOption {
    value: string;
    label: string;
  }
</script>

<script lang="ts">
  import { ChevronDown, Check } from '@lucide/svelte';
  import { cn } from '../utils';

  interface Props {
    options: DropdownOption[];
    value?: string;
    /** Accessible name. */
    label: string;
    placeholder?: string;
    disabled?: boolean;
    size?: 'sm' | 'md';
    width?: string;
    class?: string;
    onchange?: (value: string) => void;
  }

  let {
    options,
    value = $bindable(),
    label,
    placeholder = 'Choose…',
    disabled = false,
    size = 'md',
    width = '240px',
    class: className = '',
    onchange
  }: Props = $props();

  const uid = $props.id();
  let open = $state(false);
  let active = $state(0);
  let root: HTMLDivElement;
  let trigger: HTMLButtonElement;
  let list: HTMLUListElement | undefined = $state();

  const selected = $derived(options.find((o) => o.value === value));

  function show() {
    if (disabled) return;
    const i = options.findIndex((o) => o.value === value);
    active = i < 0 ? 0 : i;
    open = true;
  }

  function hide(refocus = true) {
    open = false;
    if (refocus) trigger?.focus();
  }

  function choose(i: number) {
    const opt = options[i];
    if (!opt) return;
    if (opt.value !== value) {
      value = opt.value;
      onchange?.(opt.value);
    }
    hide();
  }

  $effect(() => {
    if (open) list?.focus();
  });

  function onTriggerKey(e: KeyboardEvent) {
    if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(e.key)) {
      e.preventDefault();
      show();
    }
  }

  function onListKey(e: KeyboardEvent) {
    const last = options.length - 1;
    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); active = Math.min(last, active + 1); break;
      case 'ArrowUp': e.preventDefault(); active = Math.max(0, active - 1); break;
      case 'Home': e.preventDefault(); active = 0; break;
      case 'End': e.preventDefault(); active = last; break;
      case 'Enter':
      case ' ': e.preventDefault(); choose(active); break;
      case 'Escape': e.preventDefault(); hide(); break;
      case 'Tab': hide(false); break;
    }
  }

  function onWindowPointer(e: PointerEvent) {
    if (open && !root.contains(e.target as Node)) hide(false);
  }
</script>

<svelte:window onpointerdown={onWindowPointer} />

<div class={cn('relative', className)} bind:this={root} style:width>
  <button
    bind:this={trigger}
    type="button"
    aria-label={label}
    aria-haspopup="listbox"
    aria-expanded={open}
    aria-controls="{uid}-list"
    {disabled}
    class={cn(
      'group flex w-full cursor-pointer items-center justify-between gap-2 rounded-gl border-0 text-sm text-fg transition-colors motion-reduce:transition-none',
      size === 'sm' ? 'h-9 bg-tonal pl-3 pr-2.5' : 'h-10 bg-hover pl-3.5 pr-3',
      'hover:enabled:bg-field-hover disabled:cursor-not-allowed disabled:bg-row disabled:text-off-dim'
    )}
    onclick={() => (open ? hide() : show())}
    onkeydown={onTriggerKey}
  >
    <span class={cn('min-w-0 truncate', !selected && 'text-muted')}>{selected?.label ?? placeholder}</span>
    <ChevronDown size={16} strokeWidth={1.75} aria-hidden="true" class="shrink-0 text-muted group-disabled:text-off-faint" />
  </button>

  {#if open}
    <ul
      bind:this={list}
      id="{uid}-list"
      role="listbox"
      aria-label={label}
      tabindex="-1"
      aria-activedescendant="{uid}-opt-{active}"
      class="absolute left-0 top-[calc(100%+4px)] z-20 m-0 w-full min-w-40 origin-top animate-pop-in list-none rounded-gl bg-menu p-1 shadow-menu outline-none"
      onkeydown={onListKey}
    >
      {#each options as opt, i (opt.value)}
        <!-- svelte-ignore a11y_click_events_have_key_events (keyboard handled on the listbox) -->
        <li
          id="{uid}-opt-{i}"
          role="option"
          aria-selected={opt.value === value}
          class={cn('flex h-9 cursor-pointer items-center justify-between rounded-gl px-2.5 text-sm text-fg', i === active && 'bg-menu-active')}
          onpointerenter={() => (active = i)}
          onclick={() => choose(i)}
        >
          <span class="min-w-0 truncate">{opt.label}</span>
          <span class={cn('flex shrink-0 text-accent', opt.value === value ? 'opacity-100' : 'opacity-0')}>
            <Check size={16} strokeWidth={1.75} aria-hidden="true" />
          </span>
        </li>
      {/each}
    </ul>
  {/if}
</div>
