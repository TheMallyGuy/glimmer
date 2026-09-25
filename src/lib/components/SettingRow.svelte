<script lang="ts">
  import type { Snippet } from 'svelte';
  import { ChevronRight } from '@lucide/svelte';
  import { cn } from '../utils';

  interface Props {
    title: string;
    description?: string;
    /** Small yellow line under the description, e.g. "Takes effect after the client restarts". */
    note?: string;
    disabled?: boolean;
    /** Makes the whole row a link with a chevron (no control). */
    href?: string;
    /** Short value shown before the chevron on link rows, e.g. "12 set". */
    value?: string;
    /** The control on the right: a Switch, Dropdown, Button… */
    control?: Snippet;
    class?: string;
    onclick?: (event: MouseEvent) => void;
  }

  let { title, description, note, disabled = false, href, value, control, class: className = '', onclick }: Props = $props();

  const row = 'flex items-center gap-6 bg-row px-[18px] py-4 text-fg no-underline';
</script>

{#snippet text()}
  <div class="flex min-w-0 grow flex-col gap-[3px]">
    <div class={cn('text-[15px] font-medium', disabled && 'text-off')}>{title}</div>
    {#if description}
      <div class={cn('text-[13px] text-muted', disabled && 'text-[#5e5e5e]')}>{description}</div>
    {/if}
    {#if note}<div class="pt-0.5 text-xs text-accent">{note}</div>{/if}
  </div>
{/snippet}

{#if href}
  <a
    {href}
    {onclick}
    class={cn(row, 'cursor-pointer transition-colors hover:bg-hover focus-visible:-outline-offset-2 motion-reduce:transition-none', className)}
  >
    {@render text()}
    {#if value}<span class="shrink-0 text-sm text-muted">{value}</span>{/if}
    <ChevronRight size={18} strokeWidth={1.75} class="shrink-0 text-muted" aria-hidden="true" />
  </a>
{:else}
  <div class={cn(row, className)} aria-disabled={disabled || undefined}>
    {@render text()}
    {#if control}<div class="flex shrink-0 items-center">{@render control()}</div>{/if}
  </div>
{/if}
