import { fetch } from "@tauri-apps/plugin-http";
import { fetchLocation, type Location } from "$ts/glimmer/geo";

interface Datacenter {
  location: { country: string; latLong: [string, string] };
  inactive?: boolean;
}

interface RegionServers {
  servers?: { server_id?: string }[];
}

const EARTH_RADIUS_KM = 6371;

/** great-circle distance in km between two points in degrees (haversine) */
export function getDistance(lat1: number, lon1: number, lat2: number, lon2: number) {
  const rad = (deg: number) => (deg * Math.PI) / 180;
  const a =
    Math.sin(rad(lat2 - lat1) / 2) ** 2 +
    Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(rad(lon2 - lon1) / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url} answered ${res.status}`);
  return res.json();
}

/** RoValra's server list by region, to join a game on a server close to the person */
export class RoValra {
  constructor(
    private readonly random: () => number = Math.random,
    private readonly locate: () => Promise<Location> = () => fetchLocation(),
  ) {}

  async getClosestServer(placeId: number, randomize = false): Promise<string> {
    // 1. where this device is (city-level at best, a VPN's exit with one)
    const me = await this.locate();
    if (!me.countryCode) throw new Error("no country for this device's location");
    const { latitude: lat, longitude: lon } = me;

    // 2. + 3. datacenter countries, nearest first, each once
    const datacenters = await getJson<Datacenter[]>("https://apis.rovalra.com/v1/datacenters/list");
    const distance = (d: Datacenter) =>
      getDistance(lat, lon, Number(d.location.latLong[0]), Number(d.location.latLong[1]));
    const countries = [
      ...new Set(
        datacenters
          .filter((d) => !d.inactive)
          .sort((a, b) => distance(a) - distance(b))
          .map((d) => d.location.country.toUpperCase()),
      ),
    ];

    // 4. the person's own country first, even when a neighbour's datacenter is nearer
    const own = me.countryCode.toUpperCase();
    const regions = countries.includes(own)
      ? [own, ...countries.filter((c) => c !== own)]
      : countries;

    // 5. the first country with a server wins
    for (const region of regions) {
      const { servers = [] } = await getJson<RegionServers>(
        `https://apis.rovalra.com/v1/servers/region?place_id=${placeId}&region=${region}`,
      );
      const ids = servers.map((s) => s.server_id).filter((id): id is string => !!id);
      if (ids.length === 0) {
        console.info(`no RoValra servers of ${placeId} in ${region}, trying the next country`);
        continue;
      }
      return randomize ? ids[Math.floor(this.random() * ids.length)] : ids[0];
    }

    // 6. no country had one
    return "";
  }
}
