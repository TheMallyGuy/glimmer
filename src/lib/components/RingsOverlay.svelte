<script lang="ts">
  import { onMount } from 'svelte';
  import { RingsEffect } from '../../ts/rings';

  interface Props {
    /** "#rrggbb": the colour of the first ring. */
    color: string;
    /** "#rrggbb": the colour the rings fade to, ending at the outermost one. */
    colorTwo: string;
  }

  let { color, colorTwo }: Props = $props();

  let canvas: HTMLCanvasElement;
  let rings = null as RingsEffect | null;

  onMount(() => {
    rings = RingsEffect.create(canvas);
    rings?.start();
    return () => rings?.stop();
  });

  $effect(() => rings?.setColors(color, colorTwo));
</script>

<!-- Decorative: covers the window, never takes a click or a keypress, and is hidden from screen readers. -->
<canvas
  bind:this={canvas}
  aria-hidden="true"
  class="pointer-events-none fixed inset-0 z-50 h-screen w-screen"
></canvas>
