<script lang="ts" module>
  import type { Component } from 'svelte';

  export interface Tab {
    id: string;
    label: string;
    /** A Lucide icon component, e.g. `Plug` from '@lucide/svelte'. */
    icon?: Component<any>;
  }
</script>

<script lang="ts">
  import { cn } from '../utils';

  interface Props {
    tabs: Tab[];
    value?: string;
    /** Accessible name for the tab list. */
    label?: string;
    showIcons?: boolean;
    /** Prefix for tab ids, so a panel can use aria-labelledby="{idPrefix}-{tab.id}". */
    idPrefix?: string;
    class?: string;
    onchange?: (id: string) => void;
  }

  let {
    tabs,
    value = $bindable(tabs[0]?.id),
    label = 'Sections',
    showIcons = true,
    idPrefix = 'gl-tab',
    class: className = '',
    onchange
  }: Props = $props();

  let buttons: HTMLButtonElement[] = $state([]);

  function select(id: string) {
    if (id === value) return;
    value = id;
    onchange?.(id);
  }

  function onkeydown(event: KeyboardEvent, index: number) {
    const last = tabs.length - 1;
    const next =
      event.key === 'ArrowRight' ? (index === last ? 0 : index + 1) :
      event.key === 'ArrowLeft' ? (index === 0 ? last : index - 1) :
      event.key === 'Home' ? 0 :
      event.key === 'End' ? last : -1;
    if (next < 0) return;
    event.preventDefault();
    select(tabs[next].id);
    buttons[next]?.focus();
  }
</script>

<div class={cn('flex gap-0.5 overflow-x-auto [scrollbar-width:none]', className)} role="tablist" aria-label={label}>
  {#each tabs as tab, i (tab.id)}
    {@const selected = tab.id === value}
    {@const Icon = tab.icon}
    <button
      bind:this={buttons[i]}
      type="button"
      role="tab"
      id="{idPrefix}-{tab.id}"
      aria-selected={selected}
      tabindex={selected ? 0 : -1}
      class={cn(
        'group relative inline-flex h-12 shrink-0 cursor-pointer items-center gap-2 border-0 bg-transparent px-3.5',
        'font-display text-[15px] tracking-[0.01em] transition-colors motion-reduce:transition-none focus-visible:-outline-offset-2',
        selected ? 'text-white' : 'text-[#9c9c9c] hover:text-[#e0e0e0]'
      )}
      onclick={() => select(tab.id)}
      onkeydown={(e) => onkeydown(e, i)}
    >
      {#if showIcons && Icon}
        <Icon
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          class={cn('transition-colors', selected ? 'text-accent' : 'text-[#7a7a7a] group-hover:text-[#bdbdbd]')}
        />
      {/if}
      {tab.label}
      <span
        class={cn('absolute inset-x-3.5 bottom-0 h-0.5', selected ? 'bg-accent' : 'bg-transparent group-hover:bg-[#3a3a3a]')}
      ></span>
    </button>
  {/each}
</div>
