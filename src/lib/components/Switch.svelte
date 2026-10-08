<script lang="ts">
  import type { HTMLButtonAttributes } from 'svelte/elements';
  import { cn } from '../utils';

  interface Props extends Omit<HTMLButtonAttributes, 'onchange'> {
    checked?: boolean;
    /** Accessible name. Leave out only when a visible <label> points at this switch. */
    label?: string;
    size?: 'sm' | 'md';
    onchange?: (checked: boolean) => void;
  }

  let {
    checked = $bindable(false),
    label,
    size = 'md',
    disabled = false,
    onchange,
    class: className = '',
    ...rest
  }: Props = $props();

  function toggle() {
    if (disabled) return;
    checked = !checked;
    onchange?.(checked);
  }
</script>

<button
  type="button"
  role="switch"
  aria-checked={checked}
  aria-label={label}
  {disabled}
  class={cn(
    'group relative shrink-0 rounded-gl border-0 p-0 cursor-pointer bg-track transition-colors motion-reduce:transition-none',
    'aria-checked:bg-accent',
    'disabled:cursor-not-allowed disabled:bg-[#1c1c1c] disabled:aria-checked:bg-accent/30',
    size === 'sm' ? 'w-[30px] h-[18px]' : 'w-[38px] h-[22px]',
    className
  )}
  onclick={toggle}
  {...rest}
>
  <span
    class={cn(
      'absolute top-[3px] left-[3px] rounded-[1px] bg-muted transition-[translate,background-color] duration-150 motion-reduce:transition-none',
      'group-aria-checked:bg-on-accent group-disabled:bg-[#4a4a4a] group-disabled:group-aria-checked:bg-track',
      size === 'sm' ? 'size-3 group-aria-checked:translate-x-3' : 'size-4 group-aria-checked:translate-x-4'
    )}
  ></span>
</button>
