import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { downloadCommunityMod, unwrapModFolder, type CommunityMod } from "$ts/roblox/mod/community";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";

const realFetch = globalThis.fetch;

const mod: CommunityMod = {
  id: "kliko:klikos-mod",
  name: "Kliko's mod",
  download: "https://github.com/klikos-modloader/marketplace/raw/refs/heads/main/mods/klikos-mod.zip",
  source: "kliko",
};

const ZIP = "/cache/glimmer-community/kliko_klikos-mod.zip";

beforeEach(() => {
  fakeFs.reset();
  resetTauri();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("downloadCommunityMod", () => {
  test("extracts the downloaded zip into the mod folder and deletes the zip", async () => {
    globalThis.fetch = (async () => new Response(new Uint8Array([1, 2, 3]))) as unknown as typeof fetch;
    let zipSeen = false;
    invokeHandlers.extract_zip = () => {
      zipSeen = fakeFs.has(ZIP);
      fakeFs.seed("/appdata/mods/[Kliko] Kliko's mod/Kliko's mod/content/a.png", "a");
      return null;
    };

    await downloadCommunityMod(mod, "/appdata/mods/[Kliko] Kliko's mod");

    expect(zipSeen).toBe(true);
    expect(invokeCalls.find((c) => c.cmd === "extract_zip")?.args).toEqual({
      zipPath: ZIP,
      dest: "/appdata/mods/[Kliko] Kliko's mod",
    });
    expect(fakeFs.has(ZIP)).toBe(false);
    expect(fakeFs.text("/appdata/mods/[Kliko] Kliko's mod/content/a.png")).toBe("a");
  });

  test("throws on a failed download without extracting", async () => {
    globalThis.fetch = (async () => new Response("", { status: 404 })) as unknown as typeof fetch;

    await expect(downloadCommunityMod(mod, "/appdata/mods/x")).rejects.toThrow("404");
    expect(invokeCalls.some((c) => c.cmd === "extract_zip")).toBe(false);
  });

  test("throws when extraction fails and still deletes the zip", async () => {
    globalThis.fetch = (async () => new Response(new Uint8Array([1]))) as unknown as typeof fetch;
    invokeHandlers.extract_zip = () => {
      throw "bad zip";
    };

    await expect(downloadCommunityMod(mod, "/appdata/mods/x")).rejects.toThrow("bad zip");
    expect(fakeFs.has(ZIP)).toBe(false);
  });
});

describe("unwrapModFolder", () => {
  const DIR = "/appdata/mods/[Froststrap] VC Robloxian";

  test("lifts a wrapper folder's files into the mod folder", async () => {
    fakeFs.seed(`${DIR}/VC Robloxian/PlatformContent/pc/a.png`, "a");
    fakeFs.seed(`${DIR}/VC Robloxian/content/b.png`, "b");

    await unwrapModFolder(DIR);

    expect(fakeFs.text(`${DIR}/PlatformContent/pc/a.png`)).toBe("a");
    expect(fakeFs.text(`${DIR}/content/b.png`)).toBe("b");
    expect(fakeFs.has(`${DIR}/VC Robloxian`)).toBe(false);
    expect(fakeFs.has(`${DIR}/.glimmer-unwrap`)).toBe(false);
  });

  test("handles nested wrappers, one named like its parent, and drops __MACOSX", async () => {
    fakeFs.seed(`${DIR}/x/x/content/c.png`, "c");
    fakeFs.seed(`${DIR}/__MACOSX/x/._c.png`, "junk");

    await unwrapModFolder(DIR);

    expect(fakeFs.text(`${DIR}/content/c.png`)).toBe("c");
    expect(fakeFs.has(`${DIR}/x`)).toBe(false);
    expect(fakeFs.has(`${DIR}/__MACOSX`)).toBe(false);
  });

  test("leaves a mod that starts at a Roblox folder alone", async () => {
    fakeFs.seed(`${DIR}/content/textures/d.png`, "d");

    await unwrapModFolder(DIR);

    expect(fakeFs.text(`${DIR}/content/textures/d.png`)).toBe("d");
  });
});
