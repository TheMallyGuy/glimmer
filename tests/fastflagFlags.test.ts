import { beforeEach, describe, expect, test } from "bun:test";
import { FastFlagManager } from "$ts/roblox/fastflag/flags";
import { fakeFs } from "./helpers/fakeFs";

const INSTALL = "/appdata/versions/version-abc";
const FILE = `${INSTALL}/ClientSettings/ClientAppSettings.json`;

beforeEach(() => fakeFs.reset());

describe("FastFlagManager.create", () => {
  test("points at ClientAppSettings.json inside the install", async () => {
    const ffm = await FastFlagManager.create(INSTALL);

    expect(ffm.clientAppSettingsPath).toBe(FILE);
  });
});

describe("FastFlagManager.apply", () => {
  test("writes the flags, and the hidden ones under them", async () => {
    const ffm = await FastFlagManager.create(INSTALL);

    await ffm.apply({ FFlagA: "True", FIntB: "2" }, { FFlagA: "False", FFlagHidden: "True" });

    expect(JSON.parse(fakeFs.text(FILE)!)).toEqual({
      FFlagA: "True",
      FIntB: "2",
      FFlagHidden: "True",
    });
  });

  test("makes the ClientSettings folder when it is missing", async () => {
    const ffm = await FastFlagManager.create(INSTALL);

    await ffm.apply({}, {});

    expect(fakeFs.has(`${INSTALL}/ClientSettings`)).toBe(true);
  });
});

describe("FastFlagManager.read", () => {
  test("reads the flags back, values as text", async () => {
    fakeFs.seed(FILE, '{"FFlagA":"True","FIntB":5,"FFlagC":false}');
    const ffm = await FastFlagManager.create(INSTALL);

    expect((await ffm.read()).map(({ name, value }) => [name, value])).toEqual([
      ["FFlagA", "True"],
      ["FIntB", "5"],
      ["FFlagC", "false"],
    ]);
  });

  test("gives no flags when the file is not there", async () => {
    expect(await (await FastFlagManager.create(INSTALL)).read()).toEqual([]);
  });

  test.each(["{ nope", "[]", "null"])("%p is refused", async (text) => {
    fakeFs.seed(FILE, text);

    await expect((await FastFlagManager.create(INSTALL)).read()).rejects.toThrow();
  });

  test("reads what apply wrote", async () => {
    const ffm = await FastFlagManager.create(INSTALL);
    await ffm.apply({ FFlagA: "True" }, {});

    expect((await ffm.read()).map((f) => f.name)).toEqual(["FFlagA"]);
  });
});

describe("FastFlagManager.disableFlags", () => {
  test("removes the file", async () => {
    fakeFs.seed(FILE, "{}");

    await (await FastFlagManager.create(INSTALL)).disableFlags();

    expect(fakeFs.has(FILE)).toBe(false);
  });
});
