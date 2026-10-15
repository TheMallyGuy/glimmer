import { afterEach, describe, expect, test } from "bun:test";
import { GeoLocator } from "$ts/glimmer/geo";

const realFetch = globalThis.fetch;
const HANOI = { success: true, city: "Hanoi", country: "Vietnam", continent: "Asia", country_code: "VN", latitude: 21.03, longitude: 105.85 };

let urls: string[];
let waits: number[];

/** answers the given responses in order, then repeats the last one */
function stub(...responses: Response[]) {
    urls = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        urls.push(String(input));
        return responses[Math.min(urls.length - 1, responses.length - 1)].clone();
    }) as typeof fetch;
}

const json = (body: unknown, init: ResponseInit = {}) => new Response(JSON.stringify(body), init);
const locator = () => {
    waits = [];
    return new GeoLocator(async (ms) => void waits.push(ms));
};

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("GeoLocator.locate", () => {
    test("returns the city, country and continent", async () => {
        stub(json(HANOI));

        expect(await locator().locate("1.2.3.4")).toEqual({ city: "Hanoi", country: "Vietnam", continent: "Asia", countryCode: "VN", latitude: 21.03, longitude: 105.85 });
        expect(urls).toEqual(["https://ipwho.is/1.2.3.4"]);
    });

    test("looks up this device's own address when no address is given", async () => {
        stub(json(HANOI, { status: 429 }), json(HANOI, { status: 429 }), json({ country: "Vietnam", continent_code: "AS" }));
        const geo = locator();

        await geo.locate();
        await geo.locate("  ");

        expect(urls).toEqual(["https://ipwho.is/", "https://ipwho.is/", "https://get.geojs.io/v1/ip/geo.json"]);
    });

    test("remembers an answer, so the same server is only looked up once", async () => {
        stub(json(HANOI));
        const geo = locator();

        await geo.locate("1.2.3.4");
        await geo.locate("1.2.3.4");

        expect(urls).toHaveLength(1);
    });

    test("retries once after a 429, waiting as long as the server asks", async () => {
        stub(json({}, { status: 429, headers: { "retry-after": "2" } }), json(HANOI));
        const geo = locator();

        expect((await geo.locate("1.2.3.4")).city).toBe("Hanoi");
        expect(urls).toHaveLength(2);
        expect(waits).toEqual([2000]);
    });

    test("waits a second after a 429 that names no time, and never longer than 3 seconds", async () => {
        stub(json({}, { status: 429 }), json(HANOI));
        const quick = locator();
        await quick.locate("1.2.3.4");
        expect(waits).toEqual([1000]);

        stub(json({}, { status: 429, headers: { "retry-after": "60" } }), json(HANOI));
        const capped = locator();
        await capped.locate("5.6.7.8");
        expect(waits).toEqual([3000]);
    });

    test("asks geojs when ipwho.is is still limited after the retry, and turns the continent code into a name", async () => {
        stub(json({}, { status: 429 }), json({}, { status: 429 }), json({ city: "Singapore", country: "Singapore", continent_code: "AS", country_code: "SG", latitude: "1.35", longitude: "103.82" }));

        expect(await locator().locate("1.2.3.4")).toEqual({ city: "Singapore", country: "Singapore", continent: "Asia", countryCode: "SG", latitude: 1.35, longitude: 103.82 });
        expect(urls[2]).toBe("https://get.geojs.io/v1/ip/geo/1.2.3.4.json");
    });

    test("fails with the status of ipwho.is when geojs cannot answer either, and does not remember it", async () => {
        stub(json({}, { status: 429 }));
        const geo = locator();

        await expect(geo.locate("1.2.3.4")).rejects.toThrow("cannot fetch geolocation for 1.2.3.4: 429");
        expect(urls).toHaveLength(3);

        stub(json(HANOI));
        expect((await geo.locate("1.2.3.4")).city).toBe("Hanoi");
    });

    test("fails with the message when the service says it did not succeed", async () => {
        stub(json({ success: false, message: "Reserved range" }));

        await expect(locator().locate("10.0.0.1")).rejects.toThrow("cannot fetch geolocation for 10.0.0.1: Reserved range");
    });
});
