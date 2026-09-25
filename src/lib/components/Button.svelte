<script lang="ts">
  import type { Snippet } from 'svelte';
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { ArrowRight } from '@lucide/svelte';
  import { cn } from '../utils';

  interface Props extends HTMLButtonAttributes {
    variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
    size?: 'sm' | 'md' | 'lg';
    /** Trailing arrow, used on launch actions. */
    arrow?: boolean;
    children?: Snippet;
  }

  let {
    variant = 'secondary',
    size = 'md',
    arrow = false,
    type = 'button',
    class: className = '',
    children,
    ...rest
  }: Props = $props();

  const sizes = {
    sm: 'h-9 px-3.5',
    md: 'h-11 px-[18px]',
    lg: 'h-13 px-[22px]'
  };

  const primaryText = { sm: 'text-sm', md: 'text-base', lg: 'text-lg' };

  const variants = {
    primary:
      'px-4 bg-accent text-on-accent font-display font-normal tracking-[0.01em] hover:enabled:bg-accent-hover active:enabled:bg-accent-press disabled:bg-track disabled:text-off',
    secondary:
      'bg-tonal text-fg hover:enabled:bg-tonal-hover disabled:bg-[#171717] disabled:text-[#5e5e5e]',
    ghost:
      'px-4 bg-transparent text-fg-3 font-normal hover:enabled:bg-hover hover:enabled:text-fg disabled:text-[#5e5e5e]',
    danger:
      'bg-danger-bg text-danger hover:enabled:bg-danger-bg-hover disabled:opacity-50'
  };
</script>

<button
  {type}
  class={cn(
    'inline-flex items-center justify-center gap-2 rounded-gl border-0 font-sans text-sm font-medium leading-none whitespace-nowrap cursor-pointer transition-colors motion-reduce:transition-none disabled:cursor-not-allowed',
    sizes[size],
    variants[variant],
    variant === 'primary' && primaryText[size],
    arrow && 'justify-between gap-4',
    className
  )}
  {...rest}
>
  {@render children?.()}
  {#if arrow}
    <ArrowRight size={16} strokeWidth={1.6} aria-hidden="true" />
  {/if}
</button>
