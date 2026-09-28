// geolc

import { fetch } from "@tauri-apps/plugin-http";

export async function fetchLocation(ip: string): Promise<{ city: string, country: string, continent: string }> {
    const res = await fetch(`https://ipwho.is/${ip}`, {
        headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"
        }
    })

    if (!res.ok) {
        throw new Error(`cannot fetch geolocation for ${ip}: ${res.status}`)
    }

    const data = await res.json()

    if (!data.success) {
        throw new Error(`cannot fetch geolocation for ${ip}: ${data.message ?? "unknown error"}`)
    }

    return {
        city: data.city,
        country: data.country,
        continent: data.continent
    }
}