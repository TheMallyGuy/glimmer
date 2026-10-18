import { describe, expect, test } from "bun:test";
import { ACCENT_PRESETS, AccentTheme, DEFAULT_ACCENT } from "$ts/glimmer/theme";

/** the bit of <html> that `apply` touches */
function fakeRoot() {
  const vars: Record<string, string> = {};
  return {
    vars,
    root: {
      style: { setProperty: (k: string, v: string) => (vars[k] = v) },
    } as unknown as HTMLElement,
  };
}

describe("AccentTheme.normalize", () => {
  test("accepts 3 and 6 digit hex, with or without #, in any case", () => {
    expect(AccentTheme.normalize("#FFE54E")).toBe("#ffe54e");
    expect(AccentTheme.normalize("ffe54e")).toBe("#ffe54e");
    expect(AccentTheme.normalize(" #f0a ")).toBe("#ff00aa");
  });

  test.each(["", "#12", "#12345", "#1234567", "#ggg", "red", "rgb(1,2,3)"])(
    "rejects %p",
    (input) => {
      expect(AccentTheme.normalize(input)).toBeNull();
    },
  );
});

describe("AccentTheme.contrast", () => {
  test("is 21 for black on white and 1 for the same colour", () => {
    expect(AccentTheme.contrast("#000000", "#ffffff")).toBeCloseTo(21, 5);
    expect(AccentTheme.contrast("#336699", "#336699")).toBeCloseTo(1, 5);
  });

  test("does not depend on the order", () => {
    expect(AccentTheme.contrast("#ffe54e", "#0d0d0d")).toBeCloseTo(
      AccentTheme.contrast("#0d0d0d", "#ffe54e"),
      10,
    );
  });
});

describe("AccentTheme.isReadable", () => {
  test("the default accent and every preset are readable on the canvas", () => {
    expect(AccentTheme.isReadable(DEFAULT_ACCENT)).toBe(true);
    for (const preset of ACCENT_PRESETS) expect(AccentTheme.isReadable(preset)).toBe(true);
  });

  test("dark colours are not", () => {
    expect(AccentTheme.isReadable("#000080")).toBe(false);
    expect(AccentTheme.isReadable("#222222")).toBe(false);
  });
});

describe("AccentTheme.shades", () => {
  test("reproduces the hand-made shades of the default yellow", () => {
    const { hover, press, onAccent } = AccentTheme.shades("#ffe54e");

    // theme.css has #fff1a0 and #e6cc3f; the derived ones are within a few steps of them
    const close = (a: string, b: string) =>
      [1, 3, 5].every(
        (i) => Math.abs(parseInt(a.slice(i, i + 2), 16) - parseInt(b.slice(i, i + 2), 16)) <= 8,
      );
    expect(close(hover, "#fff1a0")).toBe(true);
    expect(close(press, "#e6cc3f")).toBe(true);
    expect(onAccent).toBe("#0d0d0d");
  });

  test("light accents get dark text and dark accents get white text", () => {
    expect(AccentTheme.shades("#6be28a").onAccent).toBe("#0d0d0d");
    expect(AccentTheme.shades("#1a3a8a").onAccent).toBe("#ffffff");
  });

  test("hover is lighter and press is darker than the accent", () => {
    const { accent, hover, press } = AccentTheme.shades("#b794ff");
    const sum = (hex: string) =>
      [1, 3, 5].reduce((n, i) => n + parseInt(hex.slice(i, i + 2), 16), 0);
    expect(sum(hover)).toBeGreaterThan(sum(accent));
    expect(sum(press)).toBeLessThan(sum(accent));
  });
});

describe("AccentTheme.apply", () => {
  test("sets the four accent variables", () => {
    const { vars, root } = fakeRoot();

    AccentTheme.apply("#6db3ff", root);

    expect(Object.keys(vars).sort()).toEqual([
      "--color-accent",
      "--color-accent-hover",
      "--color-accent-press",
      "--color-on-accent",
    ]);
    expect(vars["--color-accent"]).toBe("#6db3ff");
  });

  test("falls back to the default accent for something that is not a colour", () => {
    const { vars, root } = fakeRoot();

    AccentTheme.apply("not a colour", root);

    expect(vars["--color-accent"]).toBe(DEFAULT_ACCENT);
  });
});
