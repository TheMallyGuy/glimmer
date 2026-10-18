import { beforeEach, describe, expect, test } from "bun:test";
import { Applier } from "$ts/roblox/mod/apply";
import { ModificationManager } from "$ts/roblox/mod/manager";
import { EXTRACT_ROOTS } from "$ts/roblox/installation/download";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, logSpies, resetTauri } from "./helpers/tauri";

const MODS = "/appdata/mods";
const INSTALL = "/appdata/versions/version-aaaa";
const CACHE = "/cache/glimmer-downloads/version-aaaa";

function seedActiveInstall() {
  fakeFs.seed(`${INSTALL}/AppSettings.xml`, "<Settings />");
  fakeFs.seed(
    "/appdata/versions/index.json",
    JSON.stringify([{ version: "version-aaaa", path: INSTALL, active: true }]),
  );
}

/** a complete package cache, so restoring never has to download */
function seedCache() {
  for (const zip of Object.keys(EXTRACT_ROOTS.player)) fakeFs.seed(`${CACHE}/${zip}`, "zip");
}

async function applier() {
  return Applier.create(await ModificationManager.create(true, true));
}

const appliedIndex = () => JSON.parse(fakeFs.text(`${MODS}/applied.json`) ?? "{}");
const calls = (cmd: string) => invokeCalls.filter((c) => c.cmd === cmd).map((c) => c.args);

beforeEach(() => {
  fakeFs.reset();
  resetTauri();
  invokeHandlers.apply_mod = (args) => [
    { path: `file-from-${(args as { modDir: string }).modDir.split("/").pop()}`, hash: "h" },
  ];
  invokeHandlers.extract_package_files = (args) => (args as { paths: string[] }).paths;
  seedCache();
});

describe("Applier.apply", () => {
  test("throws without an active installation", async () => {
    const a = await applier();

    await expect(a.apply(["A"])).rejects.toThrow("No active installation to apply mods to.");
  });

  test("applies mods bottom of the list first, so the top mod wins", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/Top`);
    fakeFs.seedDir(`${MODS}/Middle`);
    fakeFs.seedDir(`${MODS}/Bottom`);
    const a = await applier();

    await a.apply(["Top", "Middle", "Bottom"]);

    expect(calls("apply_mod").map((c) => (c as { modDir: string }).modDir)).toEqual([
      `${MODS}/Bottom`,
      `${MODS}/Middle`,
      `${MODS}/Top`,
    ]);
    expect(calls("apply_mod")[0]).toEqual({ modDir: `${MODS}/Bottom`, destDir: INSTALL });
  });

  test("skips names that are not mods on disk", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/Real`);
    const a = await applier();

    await a.apply(["Ghost", "Real"]);

    expect(calls("apply_mod")).toHaveLength(1);
    expect(Object.keys(appliedIndex())).toEqual(["Real"]);
  });

  test("records the files each mod wrote", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/Real`);
    const a = await applier();

    await a.apply(["Real"]);

    expect(appliedIndex()).toEqual({ Real: [{ path: "file-from-Real", hash: "h" }] });
  });

  test("keeps going and warns when one mod fails to apply", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/Bad`);
    fakeFs.seedDir(`${MODS}/Good`);
    invokeHandlers.apply_mod = (args) => {
      if ((args as { modDir: string }).modDir.endsWith("Bad")) throw "corrupt mod";
      return [];
    };
    const a = await applier();

    await a.apply(["Bad", "Good"]);

    expect(Object.keys(appliedIndex())).toEqual(["Good"]);
    expect(logSpies.warn).toHaveBeenCalledTimes(1);
  });

  test("does not restore anything on the first apply", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    const a = await applier();

    await a.apply(["A"]);

    expect(calls("extract_package_files")).toEqual([]);
  });

  test("restores stock for what the previous apply wrote before reapplying", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    const a = await applier();
    await a.apply(["A"]);

    await a.apply(["A"]);

    expect(calls("extract_package_files")).toEqual([
      { sources: expect.any(Array), destDir: INSTALL, paths: ["file-from-A"] },
    ]);
  });

  test("a mod that was removed is restored to stock and no longer recorded", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    fakeFs.seedDir(`${MODS}/B`);
    const a = await applier();
    await a.apply(["A", "B"]);

    await a.apply(["A"]);

    expect(calls("extract_package_files").at(-1)).toMatchObject({
      paths: expect.arrayContaining(["file-from-A", "file-from-B"]),
    });
    expect(Object.keys(appliedIndex())).toEqual(["A"]);
  });

  test("a failed restore is a warning, not an error", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    const a = await applier();
    await a.apply(["A"]);
    invokeHandlers.extract_package_files = () => {
      throw "locked";
    };

    // the retry re-verifies the cache against the CDN, which is offline here
    const realFetch = globalThis.fetch;
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;
    try {
      await a.apply(["A"]);
    } finally {
      globalThis.fetch = realFetch;
    }

    expect(logSpies.warn).toHaveBeenCalledTimes(2);
    expect(Object.keys(appliedIndex())).toEqual(["A"]);
  });

  test("removes the legacy .originals backup folder", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    fakeFs.seed(`${MODS}/.originals/version-aaaa/file.bin`, "old backup");
    const a = await applier();

    await a.apply(["A"]);

    expect(fakeFs.has(`${MODS}/.originals`)).toBe(false);
  });

  test("loads the applied index saved by an earlier session", async () => {
    seedActiveInstall();
    fakeFs.seedDir(`${MODS}/A`);
    fakeFs.seed(
      `${MODS}/applied.json`,
      JSON.stringify({ Old: [{ path: "stale.file", hash: "x" }] }),
    );
    const a = await applier();

    await a.apply(["A"]);

    expect(calls("extract_package_files")).toEqual([
      { sources: expect.any(Array), destDir: INSTALL, paths: ["stale.file"] },
    ]);
    expect(Object.keys(appliedIndex())).toEqual(["A"]);
  });
});
