import { afterEach, describe, expect, test } from "bun:test";
import { motionMs, prefersReducedMotion } from "$lib/motion";

const realMatchMedia = globalThis.matchMedia;

/** a matchMedia that answers "reduce" for the reduced-motion query */
function system(reduce: boolean) {
  globalThis.matchMedia = ((query: string) => ({
    matches: reduce && query.includes("prefers-reduced-motion"),
  })) as typeof matchMedia;
}

afterEach(() => {
  globalThis.matchMedia = realMatchMedia;
});

describe("prefersReducedMotion", () => {
  test("follows the system setting", () => {
    system(true);
    expect(prefersReducedMotion()).toBe(true);

    system(false);
    expect(prefersReducedMotion()).toBe(false);
  });

  test("is false where there is no matchMedia", () => {
    // @ts-expect-error simulating an environment without it
    globalThis.matchMedia = undefined;

    expect(prefersReducedMotion()).toBe(false);
  });
});

describe("motionMs", () => {
  test("is the duration normally and 0 when the system asks for less motion", () => {
    system(false);
    expect(motionMs(220)).toBe(220);

    system(true);
    expect(motionMs(220)).toBe(0);
  });
});
