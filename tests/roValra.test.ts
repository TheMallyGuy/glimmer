import { afterEach, describe, expect, test } from "bun:test";
import type { Location } from "$ts/glimmer/geo";
import { getDistance, RoValra } from "$ts/glimmer/roValra";

const realFetch = globalThis.fetch;

// Hanoi, with datacenters in Hong Kong (nearer) and Singapore
const HANOI: Location = { city: "Hanoi", country: "Vietnam", continent: "Asia", countryCode: "vn", latitude: 21.03, longitude: 105.85 };
const PARIS: Location = { city: "Paris", country: "France", continent: "Europe", countryCode: "FR", latitude: 48.85, longitude: 2.35 };
const DATACENTERS = [
    { location: { country: "SG", latLong: ["1.35", "103.82"] } },
    { location: { country: "HK", latLong: ["22.32", "114.17"] } },
    { location: { country: "HK", latLong: ["22.30", "114.10"] } },
    { location: { country: "JP", latLong: ["35.68", "139.69"] }, inactive: true },
    { location: { country: "VN", latLong: ["10.82", "106.63"] } },
];

let urls: string[];

/** answers the datacenter list, and each region from `servers` (none when missing) */
function stub(servers: Record<string, { server_id?: string }[]>) {
    urls = [];
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        urls.push(url);
        if (url.endsWith("/datacenters/list")) return Response.json(DATACENTERS);
        const region = new URL(url).searchParams.get("region")!;
        return Response.json({ servers: servers[region] ?? [] });
    }) as typeof fetch;
}

const roValra = (at: Location = HANOI, random = Math.random) => new RoValra(random, async () => at);
const regionsAsked = () => urls.filter((u) => u.includes("/servers/region")).map((u) => new URL(u).searchParams.get("region"));

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("getDistance", () => {
    test("is about 1140 km from Hanoi to Ho Chi Minh City", () => {
        expect(getDistance(21.03, 105.85, 10.82, 106.63)).toBeCloseTo(1137, -1);
    });
});

describe("RoValra.getClosestServer", () => {
    test("asks the person's own country first, then the rest nearest first, each once, skipping inactive ones", async () => {
        stub({});

        expect(await roValra().getClosestServer(1818)).toBe("");
        expect(regionsAsked()).toEqual(["VN", "HK", "SG"]);
        expect(urls[1]).toBe("https://apis.rovalra.com/v1/servers/region?place_id=1818&region=VN");
    });

    test("takes the first server of the first country that has one", async () => {
        stub({ HK: [{}, { server_id: "a" }, { server_id: "b" }], SG: [{ server_id: "c" }] });

        expect(await roValra().getClosestServer(1)).toBe("a");
        expect(regionsAsked()).toEqual(["VN", "HK"]);
    });

    test("picks a random server of that country when asked", async () => {
        stub({ VN: [{ server_id: "a" }, { server_id: "b" }, { server_id: "c" }] });

        expect(await roValra(HANOI, () => 0.99).getClosestServer(1, true)).toBe("c");
    });

    test("leaves out a country that has no datacenter", async () => {
        stub({});

        await roValra(PARIS).getClosestServer(1);
        expect(regionsAsked()).toEqual(["HK", "VN", "SG"]);
    });

    test("fails when the location has no country", async () => {
        stub({});

        await expect(roValra({ ...HANOI, countryCode: "" }).getClosestServer(1)).rejects.toThrow("no country for this device's location");
    });
});
