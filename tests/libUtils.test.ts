import { describe, expect, test } from "bun:test";
import { cn, dictText } from "$lib/utils";

describe("cn", () => {
  test("later tailwind classes override earlier ones and falsy values drop out", () => {
    expect(cn("px-2 text-fg", false, null, undefined, "px-4")).toBe("text-fg px-4");
  });
});

describe("dictText", () => {
  test("returns the value of a plain entry", () => {
    const plain = Object.assign(() => ({ value: "never" }), { value: "Close" });
    expect(dictText(plain)).toBe("Close");
  });

  test("calls an insertion entry with its values", () => {
    const insertion = Object.assign(
      (v: Record<string, string>) => ({ value: `Saved ${v.file}.` }),
      { value: undefined },
    );
    expect(dictText(insertion, { file: "icons.ttf" })).toBe("Saved icons.ttf.");
  });
});
