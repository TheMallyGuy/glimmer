import { describe, expect, test } from "bun:test";
import { GameLink } from "$ts/roblox/game";

const CONTEXT = { ticket: "TICKET", launchTimeMs: 1700000000000, browserTrackerId: 12345678901 };

/** the place launcher url inside a launch URI, decoded */
function launcherUrl(uri: string): URL {
    const encoded = uri.split("+").find((p) => p.startsWith("placelauncherurl:"))!.slice("placelauncherurl:".length);
    return new URL(decodeURIComponent(encoded));
}

describe("GameLink.parse", () => {
    test("reads the place from a roblox://experiences/start link", () => {
        expect(GameLink.parse("roblox://experiences/start?placeId=1818")).toEqual({ placeId: 1818 });
    });

    test("reads a server (gameInstanceId) and a private server link code", () => {
        expect(GameLink.parse("roblox://experiences/start?placeId=1&gameInstanceId=abc-123")).toEqual({ placeId: 1, jobId: "abc-123" });
        expect(GameLink.parse("roblox://experiences/start?placeId=1&linkCode=9876")).toEqual({ placeId: 1, linkCode: "9876" });
    });

    test("allows a trailing slash and extra parameters", () => {
        expect(GameLink.parse("roblox://experiences/start/?placeId=7&somethingElse=x")).toEqual({ placeId: 7 });
    });

    test("reads the launch data a game set for invites", () => {
        expect(GameLink.parse("roblox://experiences/start?placeId=7&launchData=%7B%22a%22%3A1%7D")).toEqual({
            placeId: 7,
            launchData: '{"a":1}',
        });
    });

    test.each([
        "roblox://experiences/start",
        "roblox://experiences/start?placeId=abc",
        "roblox://experiences/start?placeId=-5",
        "roblox://experiences/start?placeId=0",
        "roblox://navigation/profile?userId=1",
        "roblox-player:1+launchmode:play",
        "https://www.roblox.com/games/1818",
        "not a link",
        "",
    ])("%p is not a game link", (input) => {
        expect(GameLink.parse(input)).toBeNull();
    });
});

describe("GameLink.format", () => {
    test("builds a link that parse reads back", () => {
        for (const target of [{ placeId: 1818 }, { placeId: 1, jobId: "abc-123" }, { placeId: 1, linkCode: "9876" }]) {
            expect(GameLink.parse(GameLink.format(target))).toEqual(target);
        }
    });

    test("only includes the parts that are set", () => {
        expect(GameLink.format({ placeId: 1818 })).toBe("roblox://experiences/start?placeId=1818");
    });
});

describe("GameLink launch data", () => {
    test("is part of the link, and parse reads it back", () => {
        const target = { placeId: 7, jobId: "job", launchData: "a b&c=d" };

        expect(GameLink.parse(GameLink.format(target))).toEqual(target);
    });

    test("goes to the place launcher, whichever way the game is joined", () => {
        const context = { ticket: "t", launchTimeMs: 1, browserTrackerId: 2 };
        const launcher = (target: Parameters<typeof GameLink.launchUri>[0]) => {
            const uri = GameLink.launchUri(target, context);
            const encoded = /placelauncherurl:([^+]*)/.exec(uri)![1];
            return new URL(decodeURIComponent(encoded)).searchParams;
        };

        expect(launcher({ placeId: 7, launchData: "x y" }).get("launchData")).toBe("x y");
        expect(launcher({ placeId: 7, jobId: "job", launchData: "x" }).get("launchData")).toBe("x");
        expect(launcher({ placeId: 7 }).has("launchData")).toBe(false);
    });
});

describe("GameLink.launchUri", () => {
    test("starts the player in play mode with the ticket", () => {
        const uri = GameLink.launchUri({ placeId: 1818 }, CONTEXT);

        expect(uri.startsWith("roblox-player:1+launchmode:play+gameinfo:TICKET+launchtime:1700000000000+placelauncherurl:")).toBe(true);
        expect(uri.endsWith("+browsertrackerid:12345678901+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp")).toBe(true);
    });

    test("the place launcher url is encoded, so it can't split the URI at a +", () => {
        const uri = GameLink.launchUri({ placeId: 1818 }, CONTEXT);
        const encoded = uri.split("+").find((p) => p.startsWith("placelauncherurl:"))!;

        expect(encoded).not.toContain("?");
        expect(encoded).not.toContain("&");
        expect(uri.split("+")).toHaveLength(10);
    });

    test("joining any server requests the game", () => {
        const url = launcherUrl(GameLink.launchUri({ placeId: 1818 }, CONTEXT));

        expect(url.origin + url.pathname).toBe("https://assetgame.roblox.com/game/PlaceLauncher.ashx");
        expect(Object.fromEntries(url.searchParams)).toEqual({
            request: "RequestGame",
            browserTrackerId: "12345678901",
            placeId: "1818",
            isPlayTogetherGame: "false",
        });
    });

    test("joining a server requests that job", () => {
        const url = launcherUrl(GameLink.launchUri({ placeId: 1, jobId: "abc-123" }, CONTEXT));

        expect(url.searchParams.get("request")).toBe("RequestGameJob");
        expect(url.searchParams.get("gameId")).toBe("abc-123");
    });

    test("joining a private server requests it by link code", () => {
        const url = launcherUrl(GameLink.launchUri({ placeId: 1, linkCode: "9876" }, CONTEXT));

        expect(url.searchParams.get("request")).toBe("RequestPrivateGame");
        expect(url.searchParams.get("linkCode")).toBe("9876");
        expect(url.searchParams.get("accessCode")).toBe("");
    });

    test("a private server link code wins over a server id", () => {
        const url = launcherUrl(GameLink.launchUri({ placeId: 1, jobId: "j", linkCode: "c" }, CONTEXT));

        expect(url.searchParams.get("request")).toBe("RequestPrivateGame");
    });
});
