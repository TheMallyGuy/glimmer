import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { EXTRACT_ROOTS } from "$ts/roblox/installation/download";
import { PackageCache } from "$ts/roblox/installation/packageCache";
import { parseInstallName } from "$ts/roblox/installation";
import { StockRestorer } from "$ts/roblox/mod/stock";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, jsonResponse, resetTauri } from "./helpers/tauri";

const NAME = "version-aaaa";
const CACHE = `/cache/glimmer-downloads/${NAME}`;
const INSTALL = `/appdata/versions/${NAME}`;
const ZIPS = Object.keys(EXTRACT_ROOTS.player);

const realFetch = globalThis.fetch;
const seedCache = (name = NAME) => ZIPS.forEach((zip) => fakeFs.seed(`/cache/glimmer-downloads/${name}/${zip}`, "zip"));

beforeEach(() => {
    fakeFs.reset();
    resetTauri();
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("parseInstallName", () => {
    test("splits the -VNG suffix back off", () => {
        expect(parseInstallName("version-aaaa")).toEqual({ version: "version-aaaa", distribution: "global" });
        expect(parseInstallName("version-aaaa-VNG")).toEqual({ version: "version-aaaa", distribution: "vng" });
    });
});

describe("PackageCache", () => {
    test("sources are empty until every player zip is cached", async () => {
        const cache = await PackageCache.create();
        fakeFs.seed(`${CACHE}/${ZIPS[0]}`, "zip");

        expect(await cache.sources(NAME)).toEqual([]);

        seedCache();
        const sources = await cache.sources(NAME);
        expect(sources).toHaveLength(ZIPS.length);
        expect(sources[0]).toEqual({ zipPath: `${CACHE}/${ZIPS[0]}`, prefix: EXTRACT_ROOTS.player[ZIPS[0] as keyof typeof EXTRACT_ROOTS.player] });
    });

    test("prune drops every install's packages except the one kept", async () => {
        const cache = await PackageCache.create();
        seedCache("version-old");
        seedCache(NAME);

        await cache.prune(NAME);

        expect(fakeFs.has("/cache/glimmer-downloads/version-old")).toBe(false);
        expect(fakeFs.has(CACHE)).toBe(true);
    });

    test("prune does nothing when there is no cache yet", async () => {
        await (await PackageCache.create()).prune(NAME);
    });
});

describe("StockRestorer", () => {
    test("extracts straight from the cache without touching the network", async () => {
        seedCache();
        invokeHandlers.extract_package_files = (args) => (args as { paths: string[] }).paths;
        globalThis.fetch = (async () => {
            throw new Error("no network expected");
        }) as unknown as typeof fetch;

        const stock = await StockRestorer.create(NAME);
        const found = await stock.extract(["shaders/a.bin"], "/out");

        expect(found).toEqual(["shaders/a.bin"]);
        expect(invokeCalls).toHaveLength(1);
        expect(invokeCalls[0].args).toMatchObject({ destDir: "/out", paths: ["shaders/a.bin"] });
    });

    test("extracting nothing is a no-op", async () => {
        expect(await (await StockRestorer.create(NAME)).extract([], "/out")).toEqual([]);
        expect(invokeCalls).toEqual([]);
    });

    test("downloads the packages first when the cache is missing", async () => {
        const manifest = ZIPS.map((z) => `${z}\nmd5-${z}\n3\n3`).join("\n");
        const requested: string[] = [];
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            requested.push(url);
            if (url.endsWith("rbxPkgManifest.txt")) return { ...jsonResponse(`version-aaaa\n${manifest}`) };
            if (url.endsWith(".zip")) return { ...jsonResponse(""), body: null, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
            return jsonResponse({}, { status: 403 }); // region probe
        }) as unknown as typeof fetch;
        invokeHandlers.extract_package_files = (args) => (args as { paths: string[] }).paths;

        await (await StockRestorer.create(NAME)).extract(["a.bin"], "/out");

        expect(requested.filter((u) => u.endsWith(".zip"))).toHaveLength(ZIPS.length);
        expect(await (await PackageCache.create()).sources(NAME)).toHaveLength(ZIPS.length);
    });

    test("reports download progress while it fills a missing cache", async () => {
        const manifest = ZIPS.map((z) => `${z}\nmd5-${z}\n3\n3`).join("\n");
        globalThis.fetch = (async (input: RequestInfo | URL) => {
            const url = String(input);
            if (url.endsWith("rbxPkgManifest.txt")) return { ...jsonResponse(`version-aaaa\n${manifest}`) };
            if (url.endsWith(".zip")) return { ...jsonResponse(""), body: null, arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer };
            return jsonResponse({}, { status: 403 });
        }) as unknown as typeof fetch;
        invokeHandlers.extract_package_files = (args) => (args as { paths: string[] }).paths;

        const seen: number[] = [];
        await (await StockRestorer.create(NAME)).extract(["a.bin"], "/out", (_d, total, percent) => seen.push(percent, total));

        expect(seen.length).toBeGreaterThan(0);
        expect(seen.at(-2)).toBe(100);
        expect(seen.at(-1)).toBe(ZIPS.length);
    });

    test("restore re-extracts stock files and deletes ones a mod added", async () => {
        seedCache();
        fakeFs.seed(`${INSTALL}/added-by-mod.txt`, "mod");
        fakeFs.seed(`${INSTALL}/AppSettings.xml`, "<Settings />");
        invokeHandlers.extract_package_files = () => ["stock.bin"];

        const restored = await (await StockRestorer.create(NAME)).restore(INSTALL, [
            "stock.bin",
            "added-by-mod.txt",
            "AppSettings.xml",
        ]);

        expect(restored).toBe(1);
        expect(fakeFs.has(`${INSTALL}/added-by-mod.txt`)).toBe(false);
        expect(fakeFs.has(`${INSTALL}/AppSettings.xml`)).toBe(true);
    });
});
