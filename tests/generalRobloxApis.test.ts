import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
    getAssetThumbnail,
    getGameInfo,
    getGameName,
    getGameThumbnail,
    getUserHeadShot,
    getUserName,
    resolveUniverseId,
} from "$ts/roblox/generalRobloxApis";
import { jsonResponse, logSpies, resetTauri } from "./helpers/tauri";

const realFetch = globalThis.fetch;
let urls: string[];

/** answer requests by the first route whose key is a substring of the url */
function stubFetch(routes: Record<string, () => ReturnType<typeof jsonResponse>>) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        const key = Object.keys(routes).find((k) => url.includes(k));
        if (!key) throw new Error(`unexpected url ${url}`);
        return routes[key]();
    }) as typeof fetch;
}

beforeEach(() => {
    urls = [];
    resetTauri();
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("resolveUniverseId", () => {
    test("returns the universe id for a place", async () => {
        stubFetch({ "/places/42/universe": () => jsonResponse({ universeId: 999 }) });
        expect(await resolveUniverseId(42)).toBe(999);
    });

    test("throws and logs on an HTTP error", async () => {
        stubFetch({ "/universe": () => jsonResponse({}, { status: 404, statusText: "Not Found" }) });
        await expect(resolveUniverseId(42)).rejects.toThrow("Failed to resolve universeId for placeId 42");
        expect(logSpies.error).toHaveBeenCalledTimes(1);
    });

    test("throws when the response has no universe id", async () => {
        stubFetch({ "/universe": () => jsonResponse({}) });
        await expect(resolveUniverseId(42)).rejects.toThrow("No universeId found for placeId 42");
    });
});

describe("getGameInfo", () => {
    const universe = { "/places/7/universe": () => jsonResponse({ universeId: 70 }) };

    test("maps the API entry onto GameInfo", async () => {
        stubFetch({
            ...universe,
            "universeIds=70": () =>
                jsonResponse({
                    data: [
                        {
                            name: "Obby",
                            description: "jump",
                            creator: { name: "builder" },
                            playing: 12,
                            visits: 3400,
                            isContentRestricted: true,
                        },
                    ],
                }),
        });

        expect(await getGameInfo(7)).toEqual({
            universeId: 70,
            name: "Obby",
            description: "jump",
            creatorName: "builder",
            playing: 12,
            visits: 3400,
            isContentRestricted: true,
        });
    });

    test("falls back when the creator and restriction are missing", async () => {
        stubFetch({
            ...universe,
            "universeIds=70": () =>
                jsonResponse({ data: [{ name: "Obby", description: "", playing: 0, visits: 0 }] }),
        });

        const info = await getGameInfo(7);
        expect(info.creatorName).toBe("Unknown");
        expect(info.isContentRestricted).toBe(false);
    });

    test("throws when the game is not returned", async () => {
        stubFetch({ ...universe, "universeIds=70": () => jsonResponse({ data: [] }) });
        await expect(getGameInfo(7)).rejects.toThrow("No game info found for universeId 70");
    });

    test("throws on an HTTP error", async () => {
        stubFetch({ ...universe, "universeIds=70": () => jsonResponse({}, { status: 429 }) });
        await expect(getGameInfo(7)).rejects.toThrow("Failed to fetch game info for universeId 70");
    });

    test("getGameName returns just the name", async () => {
        stubFetch({
            ...universe,
            "universeIds=70": () => jsonResponse({ data: [{ name: "Obby", description: "", playing: 0, visits: 0 }] }),
        });
        expect(await getGameName(7)).toBe("Obby");
    });
});

describe("getGameThumbnail", () => {
    const universe = { "/places/7/universe": () => jsonResponse({ universeId: 70 }) };

    test("returns the first completed thumbnail", async () => {
        stubFetch({
            ...universe,
            "games/multiget/thumbnails": () =>
                jsonResponse({
                    data: [
                        {
                            thumbnails: [
                                { state: "Pending", imageUrl: "pending.png" },
                                { state: "Completed", imageUrl: "done.png" },
                            ],
                        },
                    ],
                }),
        });
        expect(await getGameThumbnail(7)).toBe("done.png");
    });

    test("returns null when none are completed", async () => {
        stubFetch({
            ...universe,
            "games/multiget/thumbnails": () =>
                jsonResponse({ data: [{ thumbnails: [{ state: "Pending", imageUrl: "pending.png" }] }] }),
        });
        expect(await getGameThumbnail(7)).toBeNull();
    });

    test("returns null for an empty response", async () => {
        stubFetch({ ...universe, "games/multiget/thumbnails": () => jsonResponse({}) });
        expect(await getGameThumbnail(7)).toBeNull();
    });

    test("throws on an HTTP error", async () => {
        stubFetch({ ...universe, "games/multiget/thumbnails": () => jsonResponse({}, { status: 500 }) });
        await expect(getGameThumbnail(7)).rejects.toThrow("Failed to fetch game thumbnail for universeId 70");
    });
});

describe("getAssetThumbnail", () => {
    test("returns the picture of an asset", async () => {
        stubFetch({ "/v1/assets": () => jsonResponse({ data: [{ state: "Completed", imageUrl: "asset.png" }] }) });

        expect(await getAssetThumbnail(123)).toBe("asset.png");
        expect(urls[0]).toContain("assetIds=123");
    });

    test("is null while Roblox has not made the picture", async () => {
        stubFetch({ "/v1/assets": () => jsonResponse({ data: [{ state: "Pending", imageUrl: "" }] }) });

        expect(await getAssetThumbnail(123)).toBeNull();
    });

    test("throws and logs when the request fails", async () => {
        stubFetch({ "/v1/assets": () => jsonResponse({}, { status: 500, statusText: "Server Error" }) });

        await expect(getAssetThumbnail(123)).rejects.toThrow("Failed to fetch the thumbnail of asset 123");
        expect(logSpies.error).toHaveBeenCalled();
    });
});

describe("getUserName", () => {
    test("returns the display name and the login name Roblox calls `name`", async () => {
        stubFetch({ "/users/5/": () => jsonResponse({ displayName: "Cool Person", name: "coolperson" }) });
        expect(await getUserName(5)).toEqual({ displayName: "Cool Person", username: "coolperson" });
    });

    test("throws with the status on failure", async () => {
        stubFetch({ "/users/5/": () => jsonResponse({}, { status: 404, statusText: "Not Found" }) });
        await expect(getUserName(5)).rejects.toThrow("Failed to resolve user info for id 5: 404 Not Found");
        expect(logSpies.error).toHaveBeenCalledTimes(1);
    });
});

describe("getUserHeadShot", () => {
    test("returns the completed headshot", async () => {
        stubFetch({
            "avatar-headshot?userIds=5": () =>
                jsonResponse({
                    data: [
                        { state: "Blocked", imageUrl: "blocked.png" },
                        { state: "Completed", imageUrl: "head.png" },
                    ],
                }),
        });
        expect(await getUserHeadShot(5)).toBe("head.png");
    });

    test("returns null when nothing is completed", async () => {
        stubFetch({ "avatar-headshot": () => jsonResponse({ data: [{ state: "Pending", imageUrl: "x.png" }] }) });
        expect(await getUserHeadShot(5)).toBeNull();
    });

    test("throws on an HTTP error", async () => {
        stubFetch({ "avatar-headshot": () => jsonResponse({}, { status: 503, statusText: "Unavailable" }) });
        await expect(getUserHeadShot(5)).rejects.toThrow("Failed to resolve user headshot for id 5: 503 Unavailable");
    });
});
