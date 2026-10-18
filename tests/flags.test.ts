import { describe, expect, test } from "bun:test";
import {
  flagsToObject,
  flagType,
  flagValueProblem,
  mergeFlags,
  getFlagValue,
  newFlag,
  parseFlagsJson,
  setFlagValue,
  type Flag,
} from "$lib/flags";

describe("flagType", () => {
  test.each([
    ["FFlagDebugFoo", "Boolean"],
    ["DFFlagDebugFoo", "Boolean"],
    ["SFFlagDebugFoo", "Boolean"],
    ["FIntTaskSchedulerTargetFps", "Integer"],
    ["DFIntFoo", "Integer"],
    ["FStringFoo", "String"],
    ["SFStringFoo", "String"],
    ["FLogNetwork", "Log"],
    ["DFLogFoo", "Log"],
  ])("%s is %s", (name, type) => {
    expect(flagType(name)).toBe(type as ReturnType<typeof flagType>);
  });

  test("empty or blank names are Empty", () => {
    expect(flagType("")).toBe("Empty");
    expect(flagType("   ")).toBe("Empty");
  });

  test("anything else has an unknown prefix", () => {
    expect(flagType("MyFlag")).toBe("Unknown prefix");
    expect(flagType("fflagLowercase")).toBe("Unknown prefix");
    expect(flagType("XFFlagFoo")).toBe("Unknown prefix");
  });
});

describe("newFlag", () => {
  test("defaults to an empty name and value", () => {
    const f = newFlag();
    expect(f.name).toBe("");
    expect(f.value).toBe("");
  });

  test("keeps the name and value it was given", () => {
    expect(newFlag("FFlagX", "True")).toMatchObject({ name: "FFlagX", value: "True" });
  });

  test("gives every flag its own id", () => {
    expect(newFlag().id).not.toBe(newFlag().id);
  });
});

describe("parseFlagsJson", () => {
  test("turns an object into flags", () => {
    const flags = parseFlagsJson('{"FFlagA":"True","FIntB":"5"}');
    expect(flags.map(({ name, value }) => ({ name, value }))).toEqual([
      { name: "FFlagA", value: "True" },
      { name: "FIntB", value: "5" },
    ]);
  });

  test("stringifies non-string values", () => {
    const flags = parseFlagsJson('{"FFlagA":true,"FIntB":12,"FStringC":null}');
    expect(flags.map((f) => f.value)).toEqual(["true", "12", "null"]);
  });

  test("accepts an empty object", () => {
    expect(parseFlagsJson("{}")).toEqual([]);
  });

  test.each(["[]", "null", "5", '"text"'])("rejects %s", (text) => {
    expect(() => parseFlagsJson(text)).toThrow("Expected an object");
  });

  test("rejects invalid JSON", () => {
    expect(() => parseFlagsJson("{nope")).toThrow();
  });

  test("reads a file that starts with a byte order mark", () => {
    expect(
      parseFlagsJson(String.fromCharCode(0xfeff) + '{"FFlagA":"True"}').map((f) => f.name),
    ).toEqual(["FFlagA"]);
  });

  test("trims names and skips blank ones", () => {
    expect(parseFlagsJson('{" FFlagA ":"True","  ":"x"}').map((f) => f.name)).toEqual(["FFlagA"]);
  });
});

describe("mergeFlags", () => {
  test("updates names already there, adds new ones at the end, and counts both", () => {
    const flags = [newFlag("FFlagA", "False"), newFlag("FIntB", "1")];

    const result = mergeFlags(flags, [newFlag("FFlagA", "True"), newFlag("FIntC", "3")]);

    expect(result).toEqual({ added: 1, updated: 1 });
    expect(flags.map(({ name, value }) => [name, value])).toEqual([
      ["FFlagA", "True"],
      ["FIntB", "1"],
      ["FIntC", "3"],
    ]);
  });

  test("matches a name typed with spaces around it", () => {
    const flags = [newFlag(" FFlagA ", "False")];

    expect(mergeFlags(flags, [newFlag("FFlagA", "True")])).toEqual({ added: 0, updated: 1 });
    expect(flags[0].value).toBe("True");
  });

  test("keeps the id of an updated flag", () => {
    const flags = [newFlag("FFlagA", "False")];
    const id = flags[0].id;

    mergeFlags(flags, [newFlag("FFlagA", "True")]);

    expect(flags[0].id).toBe(id);
  });
});

describe("flagValueProblem", () => {
  test.each([
    ["FFlagA", "True"],
    ["DFFlagA", "false"],
    ["FIntB", "-12"],
    ["FLogC", "7"],
    ["FStringD", "anything at all"],
    ["SomethingElse", "x"],
    ["FFlagA", "  "],
  ])("%s = %p is fine", (name, value) => {
    expect(flagValueProblem(name, value)).toBeNull();
  });

  test.each([
    ["FFlagA", "1"],
    ["DFFlagA", "yes"],
  ])("%s = %p is not a boolean", (name, value) => {
    expect(flagValueProblem(name, value)).toBe("notBoolean");
  });

  test.each([
    ["FIntB", "1.5"],
    ["DFIntB", "True"],
    ["FLogC", "high"],
  ])("%s = %p is not a whole number", (name, value) => {
    expect(flagValueProblem(name, value)).toBe("notInteger");
  });
});

describe("flagsToObject", () => {
  test("builds a name to value record", () => {
    const flags = [newFlag("FFlagA", "True"), newFlag("FIntB", "5")];
    expect(flagsToObject(flags)).toEqual({ FFlagA: "True", FIntB: "5" });
  });

  test("trims names and skips blank ones", () => {
    const flags = [newFlag("  FFlagA ", "True"), newFlag("", "x"), newFlag("   ", "y")];
    expect(flagsToObject(flags)).toEqual({ FFlagA: "True" });
  });

  test("the last duplicate wins", () => {
    const flags = [newFlag("FFlagA", "1"), newFlag("FFlagA", "2")];
    expect(flagsToObject(flags)).toEqual({ FFlagA: "2" });
  });

  test("round-trips through parseFlagsJson", () => {
    const json = '{"FFlagA":"True","FIntB":"5"}';
    expect(JSON.stringify(flagsToObject(parseFlagsJson(json)))).toBe(json);
  });
});

describe("getFlagValue", () => {
  const flags: Flag[] = [newFlag("FFlagA", "True")];

  test("finds a flag by exact name", () => {
    expect(getFlagValue(flags, "FFlagA")).toBe("True");
  });

  test("returns undefined when it is missing", () => {
    expect(getFlagValue(flags, "FFlagB")).toBeUndefined();
    expect(getFlagValue(flags, "fflaga")).toBeUndefined();
  });
});

describe("setFlagValue", () => {
  test("adds a flag that does not exist", () => {
    const flags: Flag[] = [];
    setFlagValue(flags, "FFlagA", "True");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ name: "FFlagA", value: "True" });
  });

  test("updates an existing flag in place", () => {
    const flags = [newFlag("FFlagA", "True")];
    const id = flags[0].id;
    setFlagValue(flags, "FFlagA", "False");
    expect(flags).toHaveLength(1);
    expect(flags[0]).toMatchObject({ id, value: "False" });
  });

  test("undefined removes the flag", () => {
    const flags = [newFlag("FFlagA", "True"), newFlag("FFlagB", "1")];
    setFlagValue(flags, "FFlagA", undefined);
    expect(flags.map((f) => f.name)).toEqual(["FFlagB"]);
  });

  test("undefined on a missing flag does nothing", () => {
    const flags = [newFlag("FFlagA", "True")];
    setFlagValue(flags, "FFlagZ", undefined);
    expect(flags).toHaveLength(1);
  });

  test("an empty string is a value, not a removal", () => {
    const flags = [newFlag("FFlagA", "True")];
    setFlagValue(flags, "FFlagA", "");
    expect(flags).toHaveLength(1);
    expect(flags[0].value).toBe("");
  });
});
