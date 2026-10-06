/** a game to join */
export interface GameTarget {
    placeId: number;
    /** join this running server (its job id) instead of any */
    jobId?: string;
    /** join a private server by its link code */
    linkCode?: string;
    /** what the game reads as its launch data (`SetLaunchData` in the BloxstrapRPC SDK sets it for invite links) */
    launchData?: string;
}

/** the numbers and clock a launch URI needs, so it can be built the same way every time in a test */
export interface LaunchContext {
    ticket: string;
    launchTimeMs: number;
    browserTrackerId: number;
}

const PLACE_LAUNCHER = "https://assetgame.roblox.com/game/PlaceLauncher.ashx";

export class GameLink {
    /** the game a `roblox://experiences/start?placeId=…` link names, or null when it isn't one */
    static parse(raw: string): GameTarget | null {
        let url: URL;
        try {
            url = new URL(raw.trim());
        } catch {
            return null;
        }
        if (url.protocol !== "roblox:") return null;
        // `roblox://experiences/start`: the URL parser puts "experiences" in the host and "/start" in the path
        if (`${url.hostname}${url.pathname}`.replace(/\/+$/, "") !== "experiences/start") return null;

        const placeId = Number(url.searchParams.get("placeId"));
        if (!Number.isSafeInteger(placeId) || placeId <= 0) return null;

        const jobId = url.searchParams.get("gameInstanceId") || undefined;
        const linkCode = url.searchParams.get("linkCode") || undefined;
        const launchData = url.searchParams.get("launchData") || undefined;
        return { placeId, ...(jobId && { jobId }), ...(linkCode && { linkCode }), ...(launchData && { launchData }) };
    }

    /** the place id in what a person pastes: a bare number, a roblox.com/games link or a roblox:// game link. null for anything else. */
    static placeIdFrom(raw: string): number | null {
        const text = raw.trim();
        const web = /^https?:\/\/(?:[\w-]+\.)?roblox\.com\/(?:[a-z-]+\/)?games\/(\d+)/i.exec(text)?.[1];
        const placeId = Number(/^\d+$/.test(text) ? text : (web ?? GameLink.parse(text)?.placeId));
        return Number.isSafeInteger(placeId) && placeId > 0 ? placeId : null;
    }

    /** the `roblox://` link for a game, the one Glimmer's deep link handler understands */
    static format(target: GameTarget): string {
        const params = new URLSearchParams({ placeId: String(target.placeId) });
        if (target.jobId) params.set("gameInstanceId", target.jobId);
        if (target.linkCode) params.set("linkCode", target.linkCode);
        if (target.launchData) params.set("launchData", target.launchData);
        return `roblox://experiences/start?${params}`;
    }

    /** the `roblox-player:` URI that starts the player in that game, signed in with the ticket */
    static launchUri(target: GameTarget, { ticket, launchTimeMs, browserTrackerId }: LaunchContext): string {
        const launcher = `${PLACE_LAUNCHER}?${GameLink.request(target, browserTrackerId)}`;

        return (
            `roblox-player:1+launchmode:play+gameinfo:${ticket}+launchtime:${launchTimeMs}` +
            `+placelauncherurl:${encodeURIComponent(launcher)}` +
            `+browsertrackerid:${browserTrackerId}+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp`
        );
    }

    /** the place launcher query for a game: any server, one server, or a private server */
    private static request(target: GameTarget, browserTrackerId: number): string {
        const params = new URLSearchParams();

        if (target.linkCode) {
            params.set("request", "RequestPrivateGame");
            params.set("browserTrackerId", String(browserTrackerId));
            params.set("placeId", String(target.placeId));
            params.set("accessCode", "");
            params.set("linkCode", target.linkCode);
        } else if (target.jobId) {
            params.set("request", "RequestGameJob");
            params.set("browserTrackerId", String(browserTrackerId));
            params.set("placeId", String(target.placeId));
            params.set("gameId", target.jobId);
            params.set("isPlayTogetherGame", "false");
        } else {
            params.set("request", "RequestGame");
            params.set("browserTrackerId", String(browserTrackerId));
            params.set("placeId", String(target.placeId));
            params.set("isPlayTogetherGame", "false");
        }
        if (target.launchData) params.set("launchData", target.launchData);

        return params.toString();
    }
}
