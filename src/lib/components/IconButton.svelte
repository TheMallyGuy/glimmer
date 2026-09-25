<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '../utils';

  interface Props extends HTMLButtonAttributes {
    /** Accessible name. Required, since the button has no visible text. */
    label: string;
    variant?: 'tonal' | 'ghost';
    size?: 'sm' | 'md';
    children: Snippet;
  }

  let {
    label,
    variant = 'tonal',
    size = 'md',
    type = 'button',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const variants = {
    tonal: 'bg-tonal text-[#d6d6d6] hover:enabled:bg-tonal-hover hover:enabled:text-fg',
    ghost: 'bg-transparent text-muted hover:enabled:bg-hover hover:enabled:text-fg'
  };
</script>

<button
  {type}
  aria-label={label}
  title={label}
  class={cn(
    'inline-flex shrink-0 items-center justify-center rounded-gl border-0 cursor-pointer transition-colors motion-reduce:transition-none disabled:opacity-40 disabled:cursor-not-allowed',
    size === 'sm' ? 'size-9' : 'size-11',
    variants[variant],
    className
  )}
  {...rest}
>
  {@render children()}
</button>
