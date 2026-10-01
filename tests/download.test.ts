import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Downloader } from "$ts/roblox/installation/download";
import { invokeCalls, invokeHandlers, jsonResponse, logSpies, resetTauri } from "./helpers/tauri";

const realFetch = globalThis.fetch;
const BASE = "https://cdn.example.com";

type FakeResponse = ReturnType<typeof jsonResponse>;
let urls: string[];

function stubFetch(handler: (url: string) => FakeResponse | Promise<FakeResponse>) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        return handler(url);
    }) as typeof fetch;
}

/** the constructor is private and `create` probes the network, so build one directly */
function downloader(distribution: "global" | "vng" = "global", baseUrl = BASE) {
    const d = new (Downloader as unknown as new (urls: string[], dist: string) => Downloader)([baseUrl], distribution);
    d.baseUrl = baseUrl;
    return d;
}

beforeEach(() => {
    resetTauri();
    urls = [];
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("parsePkgManifest", () => {
    const d = downloader();

    test("reads the version and each 4-line package entry", async () => {
        const raw = ["v0", "a.zip", "aaaa", "10", "20", "b.zip", "bbbb", "30", "40"].join("\n");

        expect(await d.parsePkgManifest(raw)).toEqual({
            manifestVersion: "v0",
            packages: [
                { fileName: "a.zip", md5: "aaaa", compressedSize: 10, uncompressedSize: 20 },
                { fileName: "b.zip", md5: "bbbb", compressedSize: 30, uncompressedSize: 40 },
            ],
        });
    });

    test("handles CRLF line endings, blank lines and padding", async () => {
        const raw = "v0\r\n\r\n  a.zip \r\naaaa\r\n10\r\n20\r\n\r\n";
        const manifest = await d.parsePkgManifest(raw);

        expect(manifest.packages).toEqual([{ fileName: "a.zip", md5: "aaaa", compressedSize: 10, uncompressedSize: 20 }]);
    });

    test("accepts a manifest with no packages", async () => {
        expect(await d.parsePkgManifest("v0\n")).toEqual({ manifestVersion: "v0", packages: [] });
    });

    test("rejects an empty manifest", async () => {
        await expect(d.parsePkgManifest("")).rejects.toThrow("Empty manifest");
        await expect(d.parsePkgManifest("\n \r\n")).rejects.toThrow("Empty manifest");
    });

    test("rejects entries that are not in groups of four lines", async () => {
        const raw = ["v0", "a.zip", "aaaa", "10"].join("\n");

        await expect(d.parsePkgManifest(raw)).rejects.toThrow("groups of 4 lines, got 3 remaining lines");
        expect(logSpies.error).toHaveBeenCalledTimes(1);
    });

    test("rejects non-numeric sizes and names the entry", async () => {
        const raw = ["v0", "a.zip", "aaaa", "ten", "20"].join("\n");

        await expect(d.parsePkgManifest(raw)).rejects.toThrow('Malformed size fields for entry "a.zip"');
    });
});

describe("fetchLatestVersion", () => {
    test("asks the global client settings endpoint for the LIVE channel", async () => {
        stubFetch(() => jsonResponse({ clientVersionUpload: "version-abc" }));

        expect(await downloader().fetchLatestVersion("WindowsPlayer")).toBe("version-abc");
        expect(urls).toEqual(["https://clientsettings.roproxy.com/v2/client-version/WindowsPlayer/channel/LIVE"]);
    });

    test("uses the VNG endpoint for the vng distribution", async () => {
        stubFetch(() => jsonResponse({ clientVersionUpload: "version-abc" }));

        await downloader("vng").fetchLatestVersion("WindowsStudio64", "zcanary");
        expect(urls).toEqual([
            "https://clientsettingscdn.robloxapp.vnggames.com/v2/client-version/WindowsStudio64/channel/zcanary",
        ]);
    });

    test("wraps HTTP errors", async () => {
        stubFetch(() => jsonResponse({}, { status: 500, statusText: "Server Error" }));

        await expect(downloader().fetchLatestVersion("WindowsPlayer")).rejects.toThrow(
            "Version fetch failed: Failed to fetch version info: 500 Server Error",
        );
    });

    test("rejects a response without clientVersionUpload", async () => {
        stubFetch(() => jsonResponse({ version: "1.0" }));

        await expect(downloader().fetchLatestVersion("WindowsPlayer")).rejects.toThrow("missing clientVersionUpload");
    });

    test("reports invalid JSON", async () => {
        stubFetch(
            () =>
                ({
                    ...jsonResponse({}),
                    json: async () => {
                        throw new SyntaxError("Unexpected token");
                    },
                }) as FakeResponse,
        );

        await expect(downloader().fetchLatestVersion("WindowsPlayer")).rejects.toThrow(
            "Failed to parse version response: Invalid JSON",
        );
    });
});

describe("fetchPreviousVersion", () => {
    const history = [
        "New WindowsPlayer version-aaaa at 1/1/2025, file version 0, 0, 1, 0",
        "New Studio64 version-5111 at 1/1/2025, file version 0, 0, 1, 0",
        "New WindowsPlayer version-bbbb at 2/1/2025, file version 0, 0, 2, 0",
        "New Studio64 version-5222 at 2/1/2025, file version 0, 0, 2, 0",
        "New WindowsPlayer version-cccc at 3/1/2025, file version 0, 0, 3, 0",
    ].join("\r\n");

    test("returns the version before the latest one", async () => {
        stubFetch(() => jsonResponse(history));

        expect(await downloader().fetchPreviousVersion("WindowsPlayer")).toBe("version-bbbb");
    });

    test("maps WindowsStudio64 to Studio64 entries only", async () => {
        stubFetch(() => jsonResponse(history));

        expect(await downloader().fetchPreviousVersion("WindowsStudio64")).toBe("version-5111");
    });

    test("ignores repeated entries for the latest version", async () => {
        stubFetch(() =>
            jsonResponse(
                [
                    "New WindowsPlayer version-aaaa at 1",
                    "New WindowsPlayer version-bbbb at 2",
                    "New WindowsPlayer version-bbbb at 3",
                    "New WindowsPlayer version-bbbb at 4",
                ].join("\n"),
            ),
        );

        expect(await downloader().fetchPreviousVersion("WindowsPlayer")).toBe("version-aaaa");
    });

    test("reads DeployHistory.txt from the base url on LIVE", async () => {
        stubFetch(() => jsonResponse(history));

        await downloader().fetchPreviousVersion("WindowsPlayer");
        expect(urls).toEqual([`${BASE}/DeployHistory.txt`]);
    });

    test("reads it from the channel folder otherwise", async () => {
        stubFetch(() => jsonResponse(history));

        await downloader().fetchPreviousVersion("WindowsPlayer", "zintegration");
        expect(urls).toEqual([`${BASE}/channel/zintegration/DeployHistory.txt`]);
    });

    test("throws when only one version is logged", async () => {
        stubFetch(() => jsonResponse("New WindowsPlayer version-aaaa at 1"));

        await expect(downloader().fetchPreviousVersion("WindowsPlayer")).rejects.toThrow(
            "Couldn't find a previous WindowsPlayer version",
        );
    });

    test("throws on an HTTP error", async () => {
        stubFetch(() => jsonResponse("", { status: 404, statusText: "Not Found" }));

        await expect(downloader().fetchPreviousVersion("WindowsPlayer")).rejects.toThrow(
            "Failed to fetch deploy history: 404 Not Found",
        );
    });
});

describe("fetchManifest", () => {
    const manifest = ["v0", "a.zip", "aaaa", "1", "2"].join("\n");

    test("fetches and parses the version's package manifest", async () => {
        stubFetch(() => jsonResponse(manifest));

        const result = await downloader().fetchManifest("version-abc");
        expect(result.packages).toHaveLength(1);
        expect(urls).toEqual([`${BASE}/version-abc-rbxPkgManifest.txt`]);
    });

    test("includes the vng CDN folder for the vng distribution", async () => {
        stubFetch(() => jsonResponse(manifest));

        await downloader("vng").fetchManifest("version-abc");
        expect(urls).toEqual([`${BASE}/vng/version-abc-rbxPkgManifest.txt`]);
    });

    test("throws on an HTTP error", async () => {
        stubFetch(() => jsonResponse("", { status: 403, statusText: "Forbidden" }));

        await expect(downloader().fetchManifest("version-abc")).rejects.toThrow(
            "Failed to fetch rbxPkgManifest for version-abc: 403 Forbidden",
        );
    });
});

describe("bestRegion", () => {
    test("picks the reachable url that answered fastest", async () => {
        const delays: Record<string, number> = { "https://slow.test": 40, "https://fast.test": 1 };
        stubFetch(async (url) => {
            await new Promise((r) => setTimeout(r, delays[url] ?? 0));
            return jsonResponse({}, { status: 403 });
        });

        expect(await downloader().bestRegion(["https://slow.test", "https://fast.test"])).toBe("https://fast.test");
    });

    test("only counts a 403 as reachable, and skips failures", async () => {
        stubFetch(async (url) => {
            if (url === "https://down.test") throw new Error("unreachable");
            if (url === "https://ok.test") return jsonResponse({}, { status: 200 });
            return jsonResponse({}, { status: 403 });
        });

        const best = await downloader().bestRegion(["https://down.test", "https://ok.test", "https://real.test"]);
        expect(best).toBe("https://real.test");
    });

    test("throws when nothing is reachable", async () => {
        stubFetch(async () => {
            throw new Error("offline");
        });

        await expect(downloader().bestRegion(["https://a.test"])).rejects.toThrow("No reachable base URLs");
    });
});

describe("extractPackages", () => {
    beforeEach(() => {
        invokeHandlers.extract_zip = () => null;
    });

    test("extracts the player set into the right sub folders and reports progress", async () => {
        const progress: [number, number, string][] = [];
        await downloader().extractPackages("/src", "/dist", "WindowsPlayer", (done, total, name) =>
            progress.push([done, total, name]),
        );

        const expected = Object.keys(downloader().extractRoots.player).length;
        expect(invokeCalls).toHaveLength(expected);
        expect(progress).toHaveLength(expected);
        expect(progress.at(-1)).toEqual([expected, expected, "extracontent-places.zip"]);
        expect(invokeCalls[0].args).toMatchObject({ zipPath: "/src/RobloxApp.zip", dest: "/dist" });
        expect(invokeCalls.find((c) => String(JSON.stringify(c.args)).includes("shaders.zip"))?.args).toMatchObject({
            dest: "/dist/shaders/",
        });
    });

    test("uses the studio package set for WindowsStudio64", async () => {
        await downloader().extractPackages("/src", "/dist", "WindowsStudio64");

        const sources = invokeCalls.map((c) => (c.args as { zipPath: string }).zipPath);
        expect(sources).toContain("/src/RobloxStudio.zip");
        expect(sources).not.toContain("/src/RobloxApp.zip");
    });
});
