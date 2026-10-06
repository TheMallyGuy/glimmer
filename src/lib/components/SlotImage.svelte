<script lang="ts">
  interface Props {
    href: string;
    /** the middle of the picture in the menu's coordinates */
    cx: number;
    cy: number;
    size: number;
  }

  let { href, cx, cy, size }: Props = $props();

  const clip = $props.id();
</script>

<!-- a picture on a slice, with the 2px corners. One that fails to load shows nothing, so the icon under it stays. -->
<clipPath id="{clip}-clip">
  <rect x={cx - size / 2} y={cy - size / 2} width={size} height={size} rx="2" />
</clipPath>
<image
  {href}
  x={cx - size / 2}
  y={cy - size / 2}
  width={size}
  height={size}
  clip-path="url(#{clip}-clip)"
  pointer-events="none"
  aria-hidden="true"
/>
