export function joinUrl(base: string, path: string) {
    return base.replace(/\/+$/, "") + "/" + path.replace(/^\/+/, "");
}

export function delay(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}


/**
 * The `roblox-player:` URI the Roblox website hands to the client, in "app" mode (no place to
 * join). The client signs in with the ticket instead of its own saved login.
 */
export function launchUri(ticket: string, launchTimeMs: number, browserTrackerId: number): string {
    return (
        `roblox-player:1+launchmode:app+gameinfo:${ticket}+launchtime:${launchTimeMs}` +
        `+browsertrackerid:${browserTrackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp`
    );
}