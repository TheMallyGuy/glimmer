<script lang="ts">
  import { cn } from '../utils';
  import { _ } from 'svelte-i18n';

  interface Props {
    /** Font size of the line; the logo scales with it. */
    size?: string;
    /** Froststrap logo. Put Froststrap's Bloxstrap.png in /static as froststrap.png. */
    logo?: string;
    href?: string;
    class?: string;
  }

  let {
    size = '22px',
    logo = '/froststrap.png',
    href = 'https://github.com/Froststrap/Froststrap',
    class: className = ''
  }: Props = $props();
</script>

<a
  {href}
  target="_blank"
  rel="noreferrer"
  style:font-size={size}
  class={cn(
    'group inline-flex items-center gap-[0.35em] font-display uppercase leading-none tracking-[0.01em] text-fg no-underline',
    className
  )}
>
  {$_('inspiredBanner.inspiredFrom')}
  <img
    src={logo}
    alt=""
    class="-my-[0.1em] h-[1.2em] w-auto transition-transform duration-200 group-hover:-rotate-6 motion-reduce:transition-none"
  />
  Froststrap
</a>