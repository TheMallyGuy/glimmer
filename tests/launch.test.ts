import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AccountLaunchError } from "$ts/roblox/account/launcher";

// appState.svelte.ts and mods.svelte.ts use runes, so they are swapped for plain objects. A mock of a module that
// is mocked again later (logProcess.test.ts) has to name every export of the real one, or the later mock can't add it.
const appState = {
    accounts: {
        list: [] as { id: string; name: string; displayName: string }[],
        activeId: null as string | null,
    },
};
mock.module("$lib/appState.svelte", () => ({ appState, gameState: {}, setGameState: () => { }, loadAppState: async () => { }, rememberFleasionPath: async () => { } }));
mock.module("$lib/mods.svelte", () => ({ loadMods: async () => { }, applyMods: async () => { } }));

const { LaunchError, launchArgs, parseLaunchLink } = await import("$ts/launch");
import type { LaunchContext, LaunchStatus } from "$ts/launch";

const GAME_LINK = "roblox://experiences/start?placeId=1818&gameInstanceId=abc";
const PLAYER_LINK = "roblox-player:1+launchmode:play+gameinfo:T";
const PROFILE_LINK = "roblox://navigation/profile?userId=1";

let reported: LaunchStatus[];
let launcher: { args: ReturnType<typeof mock>; gameArgs: ReturnType<typeof mock> };

const context = (link: string | null, isStudio = false): LaunchContext => ({
    isStudio,
    link: parseLaunchLink(link),
    report: (status) => void reported.push(status),
});
const args = (link: string | null, isStudio = false) => launchArgs(context(link, isStudio), launcher as never);

function signedInAs(displayName = "Cool Person") {
    appState.accounts.list = [{ id: "7", name: "coolperson", displayName }];
    appState.accounts.activeId = "7";
}

beforeEach(() => {
    reported = [];
    appState.accounts.list = [];
    appState.accounts.activeId = null;
    launcher = {
        args: mock(async (id: string) => [`launch:${id}`]),
        gameArgs: mock(async (id: string, game: { placeId: number }) => [`game:${id}:${game.placeId}`]),
    };
});

describe("parseLaunchLink", () => {
    test("a roblox-player: link goes to the player as it is", () => {
        expect(parseLaunchLink(PLAYER_LINK)).toEqual({ playerLink: PLAYER_LINK, game: null });
    });

    test("a game link names a game, and is not passed on as it is", () => {
        expect(parseLaunchLink(GAME_LINK)).toEqual({ playerLink: null, game: { placeId: 1818, jobId: "abc" } });
    });

    test("any other roblox:// link goes to the player as it is", () => {
        expect(parseLaunchLink(PROFILE_LINK)).toEqual({ playerLink: PROFILE_LINK, game: null });
    });

    test.each([null, undefined, "", "https://www.roblox.com/games/1818", "glimmer:open"])("%p is no launch link", (link) => {
        expect(parseLaunchLink(link)).toEqual({ playerLink: null, game: null });
    });
});

describe("launchArgs", () => {
    test("passes a roblox-player: link on as it is, without signing in", async () => {
        signedInAs();

        expect(await args(PLAYER_LINK)).toEqual([PLAYER_LINK]);
        expect(launcher.args).not.toHaveBeenCalled();
        expect(launcher.gameArgs).not.toHaveBeenCalled();
        expect(reported).toEqual([]);
    });

    test("passes another roblox:// link on as it is, without signing in", async () => {
        signedInAs();

        expect(await args(PROFILE_LINK)).toEqual([PROFILE_LINK]);
        expect(launcher.gameArgs).not.toHaveBeenCalled();
    });

    test("signs a game link in as the active account", async () => {
        signedInAs("Cool Person");

        expect(await args(GAME_LINK)).toEqual(["game:7:1818"]);
        expect(launcher.gameArgs).toHaveBeenCalledWith("7", { placeId: 1818, jobId: "abc" });
        expect(reported).toEqual([{ step: "signingIn", name: "Cool Person" }]);
    });

    test("needs an account for a game link, since the link has no login of its own", async () => {
        const failure = await args(GAME_LINK).catch((e) => e);

        expect(failure).toBeInstanceOf(LaunchError);
        expect(failure.kind).toBe("accountNeeded");
        expect(launcher.gameArgs).not.toHaveBeenCalled();
    });

    test("a plain launch signs in as the active account", async () => {
        signedInAs();

        expect(await args(null)).toEqual(["launch:7"]);
        expect(reported).toEqual([{ step: "signingIn", name: "Cool Person" }]);
    });

    test("a plain launch with no account leaves Roblox on its own login", async () => {
        expect(await args(null)).toEqual([]);
        expect(launcher.args).not.toHaveBeenCalled();
        expect(reported).toEqual([]);
    });

    test("an active id that matches no account counts as no account", async () => {
        signedInAs();
        appState.accounts.activeId = "gone";

        expect(await args(null)).toEqual([]);
    });

    test("Studio never signs in", async () => {
        signedInAs();

        expect(await args(null, true)).toEqual([]);
        expect(launcher.args).not.toHaveBeenCalled();
    });
});

describe("launchArgs: an account that can't sign in", () => {
    test.each([
        ["expired", "accountExpired"],
        ["missing", "accountMissing"],
        ["failed", "accountFailed"],
    ] as const)("%s is told as %s, with the name of the account and what went wrong", async (kind, expected) => {
        signedInAs("Cool Person");
        launcher.args = mock(async () => {
            throw new AccountLaunchError(kind, "the reason");
        });

        const failure = await args(null).catch((e) => e);

        expect(failure).toBeInstanceOf(LaunchError);
        expect(failure).toMatchObject({ kind: expected, account: "Cool Person", message: "the reason" });
    });

    test("the same goes for a game link", async () => {
        signedInAs("Cool Person");
        launcher.gameArgs = mock(async () => {
            throw new AccountLaunchError("expired", "the reason");
        });

        await expect(args(GAME_LINK)).rejects.toMatchObject({ kind: "accountExpired", account: "Cool Person" });
    });

    test("any other failure comes through as it is", async () => {
        signedInAs();
        const boom = new Error("network is down");
        launcher.args = mock(async () => {
            throw boom;
        });

        expect(await args(null).catch((e) => e)).toBe(boom);
    });
});
