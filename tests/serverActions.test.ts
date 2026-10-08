import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, jsonResponse, resetTauri } from "./helpers/tauri";
import { GameLink } from "$ts/roblox/game";

// appState.svelte.ts uses runes, so it is swapped for a plain object with the same shape
const gameState: { gameId?: number; gameServer?: string; userId?: number } = {};
const appState = { integrations: { discordRpc: { customImage: { svgUrl: undefined as string | undefined } } } };
mock.module("$lib/appState.svelte", () => ({ gameState, appState }));

const { ServerActionError, ServerActions } = await import("$ts/roblox/serverActions");

const PLACE = 100753254401525;
const JOB = "0b4a04f2-8fd1-4cc5-9e93-fdf87ca44bae";

let copied: string[];
let launches: { exe: unknown; args: unknown }[];
/** the servers the launches went to */
const joined = () => launches.map((l) => GameLink.parse((l.args as string[])[0])!.jobId);
let urls: string[];
let servers: { id: string; maxPlayers: number; playing: number }[];
let status: number;
let randomValue: number;

const server = (id: string, playing: number, maxPlayers = 15) => ({ id, maxPlayers, playing });

/** Roblox's answer to the list of servers */
function stubServers(answer: typeof fetch = (async (url: RequestInfo | URL) => {
    urls.push(String(url));
    return jsonResponse({ data: servers }, { status });
}) as unknown as typeof fetch) {
    globalThis.fetch = answer;
}

function actions() {
    return new ServerActions({
        copy: async (text) => void copied.push(text),
        random: () => randomValue,
    });
}

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});

beforeEach(() => {
    stubServers();
    resetTauri();
    invokeHandlers.get_roblox_hwnd = () => "42"; // Roblox is open
    gameState.gameId = PLACE;
    gameState.gameServer = JOB;
    gameState.userId = undefined;
    appState.integrations.discordRpc.customImage.svgUrl = undefined;
    copied = [];
    launches = [];
    fakeFs.reset();
    fakeFs.seed("/appdata/versions/index.json", JSON.stringify([{ version: "version-old", path: "/appdata/versions/version-old", active: false }, { version: "version-abc", path: "/appdata/versions/version-abc", active: true }]));
    fakeFs.seed("/appdata/versions/version-abc/RobloxPlayerBeta.exe", "exe");
    invokeHandlers.launch = (args) => void launches.push({ exe: (args as { exePath: string }).exePath, args: (args as { args: string[] }).args });
    urls = [];
    servers = [server(JOB, 5), server("aaaa", 3), server("bbbb", 4), server("cccc", 15)];
    status = 200;
    randomValue = 0;
});

describe("ServerActions: copy invite link", () => {
    const INVITE = "https://glimmer.mallyy.workers.dev/join";

    test("copies a link to the server the player is in", async () => {
        await actions().copyInvite();

        expect(copied).toEqual([`${INVITE}?placeId=${PLACE}&jobId=${JOB}&userId=0&svg=`]);
    });

    test("puts the player's user id and custom icon in the link when there are some", async () => {
        gameState.userId = 123;
        appState.integrations.discordRpc.customImage.svgUrl = "https://example.com/icon.svg";

        await actions().copyInvite();

        expect(copied).toEqual([`${INVITE}?placeId=${PLACE}&jobId=${JOB}&userId=123&svg=https://example.com/icon.svg`]);
    });

    test("says the player is not in a game, and copies nothing", async () => {
        gameState.gameServer = "";

        const failure = await actions().copyInvite().catch((err) => err);

        expect(failure).toBeInstanceOf(ServerActionError);
        expect(failure.failure).toBe("notInGame");
        expect(failure.message).toBe("You’re not in a game");
        expect(copied).toEqual([]);
    });
});

describe("ServerActions: hop server", () => {
    test("asks for the public servers of the place, 100 at most", async () => {
        await actions().hop();

        expect(urls).toEqual([`https://games.roblox.com/v1/games/${PLACE}/servers/Public?limit=100`]);
    });

    test("joins another server of the same game with a roblox:// link", async () => {
        await actions().hop();

        expect(launches.map((l) => l.args)).toEqual([[`roblox://experiences/start?placeId=${PLACE}&gameInstanceId=aaaa`]]);
    });

    test("runs the active version of the player with the roblox:// link, and closes nothing", async () => {
        await actions().hop();

        expect(launches).toEqual([
            {
                exe: "/appdata/versions/version-abc/RobloxPlayerBeta.exe",
                args: [`roblox://experiences/start?placeId=${PLACE}&gameInstanceId=aaaa`],
            },
        ]);
        expect(invokeCalls.map((c) => c.cmd)).not.toContain("exit");
    });

    test("says so when there is no installed version to start", async () => {
        fakeFs.seed("/appdata/versions/index.json", "[]");

        await expect(actions().hop()).rejects.toThrow("Cannot find active version folder");
        expect(launches).toEqual([]);
    });

    test("says so when the active version has lost its exe", async () => {
        fakeFs.reset();
        fakeFs.seed("/appdata/versions/index.json", JSON.stringify([{ version: "version-abc", path: "/appdata/versions/version-abc", active: true }]));

        await expect(actions().hop()).rejects.toThrow("Cannot find active version exe");
        expect(launches).toEqual([]);
    });

    test("passes on the error when Roblox fails to start", async () => {
        invokeHandlers.launch = () => {
            throw "Executable not found";
        };

        await expect(actions().hop()).rejects.toThrow("Executable not found");
    });

    test("never picks the server the player is in", async () => {
        servers = [server(JOB, 1), server("only", 2)];

        for (const value of [0, 0.5, 0.99]) {
            randomValue = value;
            launches = [];
            await actions().hop();

            expect(joined()).toEqual(["only"]);
        }
    });

    test("never picks a full server", async () => {
        servers = [server(JOB, 5), server("full", 15), server("over", 16), server("room", 14)];

        for (const value of [0, 0.5, 0.99]) {
            randomValue = value;
            launches = [];
            await actions().hop();

            expect(joined()).toEqual(["room"]);
        }
    });

    test("picks at random among the servers that fit", async () => {
        randomValue = 0.99;
        await actions().hop();
        randomValue = 0;
        await actions().hop();

        expect(joined()).toEqual(["bbbb", "aaaa"]);
    });

    test("says so when no other server has space, and joins nothing", async () => {
        servers = [server(JOB, 5), server("full", 15)];

        const failure = await actions().hop().catch((err) => err);

        expect(failure).toBeInstanceOf(ServerActionError);
        expect(failure.failure).toBe("noOtherServers");
        expect(failure.message).toBe("No other servers have space");
        expect(launches).toEqual([]);
    });

    test("says so when there are no servers at all", async () => {
        servers = [];

        await expect(actions().hop()).rejects.toMatchObject({ failure: "noOtherServers" });
    });

    test("says the player is not in a game when Roblox is closed, though the state still has a server", async () => {
        invokeHandlers.get_roblox_hwnd = () => {
            throw "no window";
        };

        await expect(actions().copyInvite()).rejects.toMatchObject({ failure: "notInGame" });
    });

    test("says the player is not in a game, and asks Roblox nothing", async () => {
        gameState.gameServer = "";

        await expect(actions().hop()).rejects.toMatchObject({ failure: "notInGame" });
        expect(urls).toEqual([]);
    });

    test("says Roblox could not be reached when the answer is an error", async () => {
        status = 429;

        const failure = await actions().hop().catch((err) => err);

        expect(failure).toMatchObject({ failure: "unreachable" });
        expect(failure.message).toContain("429");
        expect(launches).toEqual([]);
    });

    test("says Roblox could not be reached when the request fails", async () => {
        stubServers((async () => {
            throw new Error("network down");
        }) as unknown as typeof fetch);

        await expect(actions().hop()).rejects.toMatchObject({ failure: "unreachable" });
    });

    test("gives up on a request that never answers", async () => {
        let signal: AbortSignal | undefined;
        stubServers(((_url: RequestInfo | URL, init?: RequestInit) => {
            signal = init?.signal ?? undefined;
            return new Promise(() => {});
        }) as unknown as typeof fetch);

        void actions().hop();
        await new Promise((r) => setTimeout(r, 5));

        expect(signal).toBeDefined(); // a timeout is attached, so the menu is never stuck on it
    });
});

describe("ServerActions: join a game", () => {
    test("joins the game on any server with a roblox:// link", async () => {
        await actions().joinGame(1818);

        expect(launches.map((l) => l.args)).toEqual([["roblox://experiences/start?placeId=1818"]]);
    });

    test("works out of a game, and asks Roblox nothing", async () => {
        gameState.gameId = 0;
        gameState.gameServer = "";
        invokeHandlers.get_roblox_hwnd = () => {
            throw new Error("Roblox is not open");
        };

        await actions().joinGame(1818);

        expect(launches).toHaveLength(1);
        expect(urls).toEqual([]);
    });
});
