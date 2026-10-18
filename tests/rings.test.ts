import { describe, expect, test } from "bun:test";
import { RingsEffect } from "$ts/glimmer/rings";

describe("RingsEffect.pointer", () => {
  test("is 0,0 in the middle of the window", () => {
    expect(RingsEffect.pointer(400, 300, 800, 600)).toEqual([0, 0]);
  });

  test("goes from -0.5 to 0.5 across, and up is positive", () => {
    expect(RingsEffect.pointer(0, 0, 800, 600)).toEqual([-0.5, 0.5]);
    expect(RingsEffect.pointer(800, 600, 800, 600)).toEqual([0.5, -0.5]);
  });
});

describe("RingsEffect.step", () => {
  test("the smoothed pointer moves a fraction of the way toward the real one", () => {
    const { smooth } = RingsEffect.step([0.5, -0.5], [0, 0], 0);

    expect(smooth[0]).toBeCloseTo(0.04, 10);
    expect(smooth[1]).toBeCloseTo(-0.04, 10);
  });

  test("keeps closing in without overshooting", () => {
    let smooth: [number, number] = [0, 0];
    for (let i = 0; i < 200; i++) smooth = RingsEffect.step([0.3, 0.3], smooth, 0).smooth;

    expect(smooth[0]).toBeGreaterThan(0.299);
    expect(smooth[0]).toBeLessThanOrEqual(0.3);
  });

  test("a click's flash fades a little each frame and then stops at exactly 0", () => {
    expect(RingsEffect.step([0, 0], [0, 0], 1).burst).toBeCloseTo(0.95, 10);

    let burst = 1;
    for (let i = 0; i < 200; i++) burst = RingsEffect.step([0, 0], [0, 0], burst).burst;
    expect(burst).toBe(0);
  });
});

describe("RingsEffect.create", () => {
  test("is null when the canvas has no WebGL", () => {
    const canvas = { getContext: () => null } as unknown as HTMLCanvasElement;

    expect(RingsEffect.create(canvas)).toBeNull();
  });
});
