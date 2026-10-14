import { fetch } from "@tauri-apps/plugin-http";
import { error, info } from "@tauri-apps/plugin-log";

export async function getRobloxUrl(url: string) {
    const res = await fetch(url.replaceAll("roblox.com", "roproxy.com"))

    if (res.status == 429 || !res.ok) {
        info("fetching with roproxy got too many rqs or error, using rotunnel instead")
        const res = await fetch(url.replaceAll("roblox.com", "rotunnel.com"))
        if (res.status == 429) {
            error("both domain rotunnel & roproxy failed")
            throw Error(`Error: Cannot fetch domain ${url}`)
        }

        return res
    }

    return res
}