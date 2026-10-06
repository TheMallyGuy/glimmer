
export const OUTER_RADIUS = 176;
export const INNER_RADIUS = 84;
/** the dark disc behind the ring */
export const BACKDROP_RADIUS = 186;
/** the circle in the middle that shows the name of the action */
export const CENTRE_RADIUS = 78;
/** the mouse has to be this far (in px) from the middle to select a slot */
export const DEAD_ZONE = 40;
export const NOTCH_DEPTH = 9;
export const NOTCH_HALF_WIDTH = 0.16;

const TAU = Math.PI * 2;

/** the point at a distance from the middle, at an angle clockwise from the top (radians) */
function point(radius: number, angle: number): [number, number] {
  return [round(radius * Math.sin(angle)), round(-radius * Math.cos(angle))];
}

/** keeps the paths short and the same on every machine */
function round(value: number) {
  return Math.round(value * 100) / 100;
}

/** the angle of the middle of a slot, clockwise from the top */
export function slotAngle(index: number, count: number) {
  return (index * TAU) / count;
}

/** the path of one slice of the ring: an arc between the radii, `outer` out and `inner` in */
export function slicePath(index: number, count: number, outer: number, inner: number) {
  const half = Math.PI / count;
  const start = slotAngle(index, count) - half;
  const end = slotAngle(index, count) + half;
  const large = end - start > Math.PI ? 1 : 0;

  const [ox0, oy0] = point(outer, start);
  const [ox1, oy1] = point(outer, end);
  const [ix1, iy1] = point(inner, end);
  const [ix0, iy0] = point(inner, start);

  return (
    `M ${ox0} ${oy0} A ${outer} ${outer} 0 ${large} 1 ${ox1} ${oy1} ` +
    `L ${ix1} ${iy1} A ${inner} ${inner} 0 ${large} 0 ${ix0} ${iy0} Z`
  );
}

/** the slot a direction points at, whatever the distance. dx is to the right and dy is down, like on a screen. */
export function angleToSlot(dx: number, dy: number, count: number) {
  const angle = (Math.atan2(dx, -dy) + TAU) % TAU;
  return Math.floor((angle + Math.PI / count) / (TAU / count)) % count;
}

/** the slot the mouse selects, or -1 for the middle circle and for a slot with no action */
export function pickSlot(dx: number, dy: number, active: boolean[]) {
  if (Math.hypot(dx, dy) < DEAD_ZONE) return -1;
  const slot = angleToSlot(dx, dy, active.length);
  return active[slot] ? slot : -1;
}

/** the next slot with an action going clockwise (step 1) or back (step -1), skipping the blank ones. -1 when none. */
export function stepSlot(current: number, active: boolean[], step: 1 | -1) {
  const count = active.length;
  // from nothing, the first step goes to the first (or last) action
  const from = current < 0 ? (step === 1 ? -1 : count) : current;

  for (let i = 1; i <= count; i++) {
    const slot = (((from + step * i) % count) + count) % count;
    if (active[slot]) return slot;
  }
  return -1;
}

/** the triangle on the middle circle that points at a slot */
export function notchPoints(index: number, count: number) {
  const angle = slotAngle(index, count);
  return [
    point(CENTRE_RADIUS, angle - NOTCH_HALF_WIDTH),
    point(CENTRE_RADIUS + NOTCH_DEPTH, angle),
    point(CENTRE_RADIUS, angle + NOTCH_HALF_WIDTH),
  ]
    .map(([x, y]) => `${x},${y}`)
    .join(" ");
}

/** the middle of a slice, where its icon goes */
export function slotCentre(index: number, count: number): [number, number] {
  return point((OUTER_RADIUS + INNER_RADIUS) / 2, slotAngle(index, count));
}

/** where the menu goes: a square of `size` logical px centred on a screen, in screen pixels, for the screen's scale */
export function menuPlacement(screen: { x: number; y: number; width: number; height: number }, scale: number, size: number) {
  const side = Math.round(size * scale);
  return {
    side,
    x: Math.round(screen.x + screen.width / 2 - side / 2),
    y: Math.round(screen.y + screen.height / 2 - side / 2),
    /** the middle of the menu, which the mouse direction is measured from */
    centreX: screen.x + screen.width / 2,
    centreY: screen.y + screen.height / 2,
  };
}
