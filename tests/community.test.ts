import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { fetchCommunityMods } from "$ts/roblox/mod/community";
import { jsonResponse } from "./helpers/tauri";

const FROSTSTRAP = "RealMeddsam/config";
const KLIKO = "klikos-modloader/marketplace";

type Route = () => ReturnType<typeof jsonResponse> | Promise<never>;

const realFetch = globalThis.fetch;
let calls: string[];

/** answer the two library URLs from `routes`, matched by a substring of the url */
function stubFetch(routes: { froststrap: Route; kliko: Route }) {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        calls.push(url);
        if (url.includes(FROSTSTRAP)) return routes.froststrap();
        if (url.includes(KLIKO)) return routes.kliko();
        throw new Error(`unexpected url ${url}`);
    }) as typeof fetch;
}

const froststrapMod = {
    id: "1",
    name: "Cool mod",
    download: "https://example.com/1.zip",
    author: "me",
    description: "does a thing",
    thumbnail: "https://example.com/1.png",
};

beforeEach(() => {
    calls = [];
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("fetchCommunityMods", () => {
    test("merges both libraries and prefixes ids with the source", async () => {
        stubFetch({
            froststrap: () => jsonResponse({ communityMods: [froststrapMod] }),
            kliko: () => jsonResponse([{ id: "k1", name: "Kliko mod", download: "https://example.com/k.zip" }]),
        });

        const { mods, failed } = await fetchCommunityMods(true);

        expect(failed).toEqual([]);
        expect(mods.map((m) => m.id)).toEqual(["froststrap:1", "kliko:k1"]);
        expect(mods[0]).toMatchObject({
            name: "Cool mod",
            author: "me",
            description: "does a thing",
            download: "https://example.com/1.zip",
            thumbnail: "https://example.com/1.png",
            source: "froststrap",
        });
        expect(mods[1]).toMatchObject({ name: "Kliko mod", source: "kliko" });
    });

    test("skips Froststrap theme entries (modtype 5)", async () => {
        stubFetch({
            froststrap: () =>
                jsonResponse({
                    communityMods: [
                        { ...froststrapMod, id: "mod", modtype: 1 },
                        { ...froststrapMod, id: "theme", modtype: 5 },
                        { ...froststrapMod, id: "untyped" },
                    ],
                }),
            kliko: () => jsonResponse([]),
        });

        const { mods } = await fetchCommunityMods(true);
        expect(mods.map((m) => m.id)).toEqual(["froststrap:mod", "froststrap:untyped"]);
    });

    test("tolerates a Froststrap payload without communityMods", async () => {
        stubFetch({ froststrap: () => jsonResponse({}), kliko: () => jsonResponse([]) });

        const { mods, failed } = await fetchCommunityMods(true);
        expect(mods).toEqual([]);
        expect(failed).toEqual([]);
    });

    describe("gradients", () => {
        const withGradient = (angle: number | undefined, gradient: { offset: number; color: string }[] | undefined) =>
            stubFetch({
                froststrap: () => jsonResponse({ communityMods: [{ ...froststrapMod, angle, gradient }] }),
                kliko: () => jsonResponse([]),
            });

        test("builds a linear-gradient from the stops", async () => {
            withGradient(45, [
                { offset: 0, color: "#ff0000" },
                { offset: 0.5, color: "#00ff00" },
                { offset: 1, color: "#0000ff" },
            ]);

            const { mods } = await fetchCommunityMods(true);
            expect(mods[0].gradient).toBe("linear-gradient(45deg, #ff0000 0%, #00ff00 50%, #0000ff 100%)");
        });

        test("defaults the angle to 90 degrees", async () => {
            withGradient(undefined, [
                { offset: 0, color: "#111" },
                { offset: 1, color: "#222" },
            ]);

            const { mods } = await fetchCommunityMods(true);
            expect(mods[0].gradient).toBe("linear-gradient(90deg, #111 0%, #222 100%)");
        });

        test("needs at least two stops", async () => {
            withGradient(90, [{ offset: 0, color: "#111" }]);
            expect((await fetchCommunityMods(true)).mods[0].gradient).toBeUndefined();

            withGradient(90, undefined);
            expect((await fetchCommunityMods(true)).mods[0].gradient).toBeUndefined();
        });
    });

    describe("failures", () => {
        test("one failing source does not drop the other", async () => {
            stubFetch({
                froststrap: () => jsonResponse({}, { status: 500, statusText: "Server Error" }),
                kliko: () => jsonResponse([{ id: "k1", name: "Kliko mod", download: "d" }]),
            });

            const { mods, failed } = await fetchCommunityMods(true);
            expect(failed).toEqual(["froststrap"]);
            expect(mods.map((m) => m.id)).toEqual(["kliko:k1"]);
        });

        test("a network error counts as a failure", async () => {
            stubFetch({
                froststrap: () => jsonResponse({ communityMods: [froststrapMod] }),
                kliko: () => Promise.reject(new Error("offline")),
            });

            const { mods, failed } = await fetchCommunityMods(true);
            expect(failed).toEqual(["kliko"]);
            expect(mods).toHaveLength(1);
        });

        test("reports both when everything fails", async () => {
            stubFetch({
                froststrap: () => jsonResponse({}, { status: 404 }),
                kliko: () => jsonResponse({}, { status: 404 }),
            });

            const { mods, failed } = await fetchCommunityMods(true);
            expect(mods).toEqual([]);
            expect(failed).toEqual(["froststrap", "kliko"]);
        });
    });

    describe("caching", () => {
        const ok = () =>
            stubFetch({
                froststrap: () => jsonResponse({ communityMods: [froststrapMod] }),
                kliko: () => jsonResponse([]),
            });

        test("reuses the previous result", async () => {
            ok();
            await fetchCommunityMods(true);
            const requestsAfterFirst = calls.length;

            const again = await fetchCommunityMods();
            expect(calls).toHaveLength(requestsAfterFirst);
            expect(again.mods).toHaveLength(1);
        });

        test("force refetches", async () => {
            ok();
            await fetchCommunityMods(true);
            const requestsAfterFirst = calls.length;

            await fetchCommunityMods(true);
            expect(calls.length).toBe(requestsAfterFirst * 2);
        });
    });
});
