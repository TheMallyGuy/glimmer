import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getCustomGameIcon } from "$ts/svg/api";
import { jsonResponse, logSpies, resetTauri } from "./helpers/tauri";

const realFetch = globalThis.fetch;
let requested: string[];
let respond: () => ReturnType<typeof jsonResponse>;

beforeEach(() => {
    resetTauri();
    requested = [];
    respond = () => jsonResponse({ url: "https://img.example/icon.png" });
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        requested.push(String(input));
        return respond();
    }) as typeof fetch;
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("getCustomGameIcon", () => {
    test("requests the place thumbnail endpoint and returns the url", async () => {
        const url = await getCustomGameIcon(123);

        expect(url).toBe("https://img.example/icon.png");
        expect(requested).toEqual(["https://glimmer.mallyy.workers.dev/thumbnail/place/123/url"]);
    });

    test("sends the options as query parameters", async () => {
        await getCustomGameIcon(123, { svgUrl: "https://x.test/a.svg", overlay: "black", size: 256 });

        const url = new URL(requested[0]);
        expect(url.pathname).toBe("/thumbnail/place/123/url");
        expect(url.searchParams.get("url_svg")).toBe("https://x.test/a.svg");
        expect(url.searchParams.get("overlay")).toBe("black");
        expect(url.searchParams.get("size")).toBe("256");
    });

    test("leaves out options that are not set", async () => {
        await getCustomGameIcon(123, { overlay: "white" });

        const params = new URL(requested[0]).searchParams;
        expect([...params.keys()]).toEqual(["overlay"]);
    });

    test("throws and logs when the service fails", async () => {
        respond = () => jsonResponse({}, { status: 500 });

        await expect(getCustomGameIcon(123)).rejects.toThrow("error when fetching custom svg");
        expect(logSpies.error).toHaveBeenCalledTimes(1);
    });
});
