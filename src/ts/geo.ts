// geolc

import { fetch } from "@tauri-apps/plugin-http";

export interface Location {
    city: string;
    country: string;
    continent: string;
}

const MAX_RETRY_WAIT_MS = 3000;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeoLocator {
    private readonly cache = new Map<string, Location>();

    constructor(private readonly wait: (ms: number) => Promise<unknown> = delay) { }

    async locate(ip: string): Promise<Location> {
        const known = this.cache.get(ip);
        if (known) return known;

        let res = await this.request(ip);
        if (res.status === 429) {
            // Retry-After is in seconds; without it, a short pause is still better than failing at once
            const seconds = Number(res.headers.get("retry-after"));
            await this.wait(Math.min(MAX_RETRY_WAIT_MS, Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000));
            res = await this.request(ip);
        }

        if (!res.ok) {
            throw new Error(`cannot fetch geolocation for ${ip}: ${res.status}`);
        }

        const data = await res.json();

        if (!data.success) {
            throw new Error(`cannot fetch geolocation for ${ip}: ${data.message ?? "unknown error"}`);
        }

        const location = { city: data.city, country: data.country, continent: data.continent };
        this.cache.set(ip, location);
        return location;
    }

    private request(ip: string) {
        return fetch(`https://ipwho.is/${ip}`, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
            }
        });
    }
}

const shared = new GeoLocator();

export const fetchLocation = (ip: string): Promise<Location> => shared.locate(ip);
