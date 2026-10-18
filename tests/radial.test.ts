import { describe, expect, test } from "bun:test";
import {
  DEAD_ZONE,
  INNER_RADIUS,
  OUTER_RADIUS,
  angleToSlot,
  menuPlacement,
  notchPoints,
  pickSlot,
  slicePath,
  slotCentre,
  stepSlot,
} from "$lib/radial";

/** dx right and dy down, as on a screen: where the mouse is for a compass direction at a distance */
const toward = {
  up: [0, -100],
  upRight: [100, -100],
  right: [100, 0],
  downRight: [100, 100],
  down: [0, 100],
  downLeft: [-100, 100],
  left: [-100, 0],
  upLeft: [-100, -100],
} as const;

describe("angleToSlot", () => {
  test("slot 0 is at the top and the slots go clockwise", () => {
    // 6 slots of 60 degrees, slot i centred on i * 60
    expect(angleToSlot(...toward.up, 6)).toBe(0);
    expect(angleToSlot(100, -100 / Math.tan((60 * Math.PI) / 180), 6)).toBe(1); // 60 degrees clockwise from the top
    expect(angleToSlot(100, 100 / Math.tan((60 * Math.PI) / 180), 6)).toBe(2); // 120
    expect(angleToSlot(...toward.down, 6)).toBe(3);
    expect(angleToSlot(-100, 100 / Math.tan((60 * Math.PI) / 180), 6)).toBe(4); // 240
    expect(angleToSlot(-100, -100 / Math.tan((60 * Math.PI) / 180), 6)).toBe(5); // 300
  });

  test("a slot covers 30 degrees to each side of its middle, so the border between 0 and 1 is at 30", () => {
    const at = (degrees: number) =>
      angleToSlot(Math.sin((degrees * Math.PI) / 180), -Math.cos((degrees * Math.PI) / 180), 6);

    expect(at(29)).toBe(0);
    expect(at(31)).toBe(1);
    expect(at(-29)).toBe(0);
    expect(at(-31)).toBe(5);
    expect(at(359)).toBe(0);
  });

  test("works for other counts", () => {
    expect(angleToSlot(...toward.right, 4)).toBe(1);
    expect(angleToSlot(...toward.down, 4)).toBe(2);
    expect(angleToSlot(...toward.left, 4)).toBe(3);
    expect(angleToSlot(...toward.up, 8)).toBe(0);
    expect(angleToSlot(...toward.upRight, 8)).toBe(1);
  });

  test("does not depend on how far the mouse is", () => {
    expect(angleToSlot(1, -2, 6)).toBe(angleToSlot(1000, -2000, 6));
  });
});

describe("pickSlot", () => {
  const active = [true, true, false, false, false, false];

  test("selects nothing inside the middle circle", () => {
    expect(pickSlot(0, -(DEAD_ZONE - 1), active)).toBe(-1);
    expect(pickSlot(0, 0, active)).toBe(-1);
    expect(pickSlot(0, -DEAD_ZONE, active)).toBe(0);
  });

  test("selects the slot in the direction, wherever the mouse is", () => {
    expect(pickSlot(0, -50, active)).toBe(0);
    expect(pickSlot(0, -2000, active)).toBe(0);
    expect(pickSlot(80, -45, active)).toBe(1); // about 60 degrees
  });

  test("selects nothing when the direction is a blank slot", () => {
    expect(pickSlot(...toward.down, active)).toBe(-1);
    expect(pickSlot(...toward.left, active)).toBe(-1);
  });
});

describe("stepSlot", () => {
  test("goes clockwise and back, skipping blank slots", () => {
    const active = [true, false, true, false, true, false];

    expect(stepSlot(0, active, 1)).toBe(2);
    expect(stepSlot(2, active, 1)).toBe(4);
    expect(stepSlot(4, active, 1)).toBe(0);
    expect(stepSlot(0, active, -1)).toBe(4);
    expect(stepSlot(2, active, -1)).toBe(0);
  });

  test("from nothing, the first step goes to the first action, or the last one going back", () => {
    const active = [false, true, true, false, true, false];

    expect(stepSlot(-1, active, 1)).toBe(1);
    expect(stepSlot(-1, active, -1)).toBe(4);
  });

  test("with a single action it stays there, and with none it selects nothing", () => {
    expect(stepSlot(1, [false, true, false], 1)).toBe(1);
    expect(stepSlot(1, [false, true, false], -1)).toBe(1);
    expect(stepSlot(-1, [false, false, false], 1)).toBe(-1);
  });

  test("never lands on a blank slot", () => {
    const active = [true, true, false, false, false, false];
    let slot = -1;
    for (let i = 0; i < 20; i++) {
      slot = stepSlot(slot, active, 1);
      expect(active[slot]).toBe(true);
    }
  });
});

describe("slicePath", () => {
  test("is an arc between the two radii, between the borders of the slot", () => {
    // slot 0 of 6 spans -30 to +30 degrees: sin(30) = 0.5
    expect(slicePath(0, 6, 176, 84)).toBe(
      "M -88 -152.42 A 176 176 0 0 1 88 -152.42 L 42 -72.75 A 84 84 0 0 0 -42 -72.75 Z",
    );
  });

  test("the next slot is the same shape turned 60 degrees clockwise", () => {
    expect(slicePath(1, 6, 176, 84)).toBe(
      "M 88 -152.42 A 176 176 0 0 1 176 0 L 84 0 A 84 84 0 0 0 42 -72.75 Z",
    );
  });

  test("keeps the same start and end between neighbours, so a gap can be stroked", () => {
    const end = (path: string) => /A \d+ \d+ 0 0 1 (\S+ \S+) L/.exec(path)![1];
    const start = (path: string) => /^M (\S+ \S+) A/.exec(path)![1];

    for (let i = 0; i < 6; i++)
      expect(end(slicePath(i, 6, 176, 84))).toBe(start(slicePath((i + 1) % 6, 6, 176, 84)));
  });

  test("uses the radii given", () => {
    expect(OUTER_RADIUS).toBe(176);
    expect(INNER_RADIUS).toBe(84);
  });
});

describe("notchPoints", () => {
  test("is a small triangle on the edge of the middle circle, pointing 9px out at the slot", () => {
    // slot 0 is at the top: the tip is straight up, 78 + 9 from the middle
    const [left, tip, right] = notchPoints(0, 6)
      .split(" ")
      .map((p) => p.split(",").map(Number));

    expect(tip).toEqual([0, -87]);
    expect(left[0]).toBeLessThan(0);
    expect(right[0]).toBeGreaterThan(0);
    expect(left[1]).toBe(right[1]);
    expect(Math.hypot(left[0], left[1])).toBeCloseTo(78, 1);
  });
});

describe("slotCentre", () => {
  test("is the middle of the slice, halfway between the radii", () => {
    expect(slotCentre(0, 6)).toEqual([0, -130]);
    expect(slotCentre(3, 6)[1]).toBe(130);
  });
});

describe("menuPlacement", () => {
  test("centres the menu on the screen", () => {
    expect(menuPlacement({ x: 0, y: 0, width: 1920, height: 1080 }, 1, 420)).toEqual({
      side: 420,
      x: 750,
      y: 330,
      centreX: 960,
      centreY: 540,
    });
  });

  test("goes by the scale of the screen, and by where the screen is", () => {
    // a second screen on the right, 4K at 150%
    expect(menuPlacement({ x: 1920, y: -200, width: 3840, height: 2160 }, 1.5, 420)).toEqual({
      side: 630,
      x: 1920 + 1920 - 315,
      y: -200 + 1080 - 315,
      centreX: 3840,
      centreY: 880,
    });
  });
});
