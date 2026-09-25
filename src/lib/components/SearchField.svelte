<script lang="ts">
  import type { HTMLInputAttributes } from 'svelte/elements';
  import { Search } from '@lucide/svelte';
  import { cn } from '../utils';

  interface Props extends Omit<HTMLInputAttributes, 'value'> {
    value?: string;
    /** Accessible name; also used as the placeholder unless one is given. */
    label: string;
    width?: string;
  }

  let { value = $bindable(''), label, placeholder, width = '320px', class: className = '', ...rest }: Props = $props();
</script>

<label
  class={cn(
    'flex h-10 items-center gap-2.5 rounded-gl bg-field px-3.5 text-muted',
    'focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent',
    className
  )}
  style:width
>
  <Search size={15} strokeWidth={1.75} aria-hidden="true" />
  <input
    type="search"
    bind:value
    aria-label={label}
    placeholder={placeholder ?? label}
    class="h-9 min-w-0 grow border-0 bg-transparent text-sm text-fg placeholder:text-subtle focus:outline-none focus-visible:outline-none [&::-webkit-search-cancel-button]:hidden"
    {...rest}
  />
</label>
