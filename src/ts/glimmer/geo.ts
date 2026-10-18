// geolc

import { fetch } from "@tauri-apps/plugin-http";

export interface Location {
  city: string;
  country: string;
  continent: string;
  /** ISO code, like "VN" */
  countryCode: string;
  latitude: number;
  longitude: number;
}

const MAX_RETRY_WAIT_MS = 3000;

/** geojs answers with the code of the continent, not its name */
const CONTINENTS: Record<string, string> = {
  AF: "Africa",
  AN: "Antarctica",
  AS: "Asia",
  EU: "Europe",
  NA: "North America",
  OC: "Oceania",
  SA: "South America",
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export class GeoLocator {
  private readonly cache = new Map<string, Location>();

  constructor(private readonly wait: (ms: number) => Promise<unknown> = delay) {}

  /** where `ip` is, or where this device is when `ip` is empty (both services answer for the caller then) */
  async locate(ip = ""): Promise<Location> {
    ip = ip.trim();
    const known = this.cache.get(ip);
    if (known) return known;

    let res = await this.request(ip);
    if (res.status === 429) {
      // Retry-After is in seconds; without it, a short pause is still better than failing at once
      const seconds = Number(res.headers.get("retry-after"));
      await this.wait(
        Math.min(
          MAX_RETRY_WAIT_MS,
          Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000,
        ),
      );
      res = await this.request(ip);
    }

    if (res.status === 429) {
      // ipwho.is limits by address, and phones share addresses a lot: another service has its own limit
      const other = await this.fallback(ip).catch(() => null);
      if (other) return other;
    }

    if (!res.ok) {
      throw new Error(`cannot fetch geolocation for ${ip}: ${res.status}`);
    }

    const data = await res.json();

    if (!data.success) {
      throw new Error(`cannot fetch geolocation for ${ip}: ${data.message ?? "unknown error"}`);
    }

    const location = {
      city: data.city,
      country: data.country,
      continent: data.continent,
      countryCode: data.country_code,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
    };
    this.cache.set(ip, location);
    return location;
  }

  private async fallback(ip: string): Promise<Location> {
    const res = await fetch(
      ip ? `https://get.geojs.io/v1/ip/geo/${ip}.json` : "https://get.geojs.io/v1/ip/geo.json",
    );
    if (!res.ok) throw new Error(`cannot fetch geolocation for ${ip}: ${res.status}`);

    const data = await res.json();
    if (!data.country) throw new Error(`cannot fetch geolocation for ${ip}: no country`);

    const location = {
      city: data.city ?? "",
      country: data.country,
      continent: CONTINENTS[data.continent_code] ?? data.continent_code ?? "",
      countryCode: data.country_code,
      latitude: Number(data.latitude),
      longitude: Number(data.longitude),
    };
    this.cache.set(ip, location);
    return location;
  }

  private request(ip: string) {
    return fetch(`https://ipwho.is/${ip}`, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
      },
    });
  }
}

const shared = new GeoLocator();

export const fetchLocation = (ip?: string): Promise<Location> => shared.locate(ip);
