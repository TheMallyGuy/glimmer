/** whether the system asks for less motion */
export function prefersReducedMotion(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * A duration for a Svelte transition: `ms`, or 0 when the system asks for less motion. CSS
 * animations don't need this, because theme.css switches them off for the same setting.
 */
export function motionMs(ms: number): number {
  return prefersReducedMotion() ? 0 : ms;
}
