<script lang="ts">
  import type { Snippet } from 'svelte';
  import { cn } from '../utils';

  interface Props {
    /** Optional group name shown above the rows (sentence case). */
    label?: string;
    class?: string;
    children: Snippet;
  }

  let { label, class: className = '', children }: Props = $props();
</script>

<!-- a group with no row left after the search goes too -->
<section class={cn('flex flex-col not-has-[>div>:not(.hidden)]:hidden', className)}>
  {#if label}<h2 class="mb-2 text-[13px] font-normal text-muted">{label}</h2>{/if}
  <div class="stagger flex flex-col gap-0.5">{@render children()}</div>
</section>
