import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { invokeCalls, invokeHandlers, jsonResponse, logSpies, resetTauri } from "./helpers/tauri";

// ---- modules process.ts pulls in that cannot (or should not) run under bun test
// appState.svelte.ts uses runes, so it is swapped for a plain object with the same shape.
const appState = {
    integrations: {
        serverLocNotifer: { enabled: false },
        trimMemWhenNotFocused: { enabled: false },
        discordRpc: {
            shareAccount: false,
            largeImagePreset: "icon",
            customImage: { svgUrl: "", overlay: "white", size: "512" },
        },
    },
};
const gameState: Record<string, unknown> = {};
const setGameState = mock((patch: Record<string, unknown>) => void Object.assign(gameState, patch));

mock.module("$lib/appState.svelte", () => ({
    appState,
    gameState,
    setGameState,
    loadAppState: async () => { },
}));

const setActivity = mock(async (_activity: Record<string, unknown>) => { });
const addActivity = mock(async (_activity: Record<string, unknown>) => { });
mock.module("$ts/roblox/discordRpc", () => ({ setActivity, addActivity }));

const fetchLocation = mock(async (_ip: string) => ({ city: "Hanoi", country: "Vietnam", continent: "Asia" }));
mock.module("$ts/geo", () => ({ fetchLocation }));

const sendNotification = mock((_options: { title: string; body: string }) => { });
mock.module("@tauri-apps/plugin-notification", () => ({
    isPermissionGranted: async () => true,
    requestPermission: async () => "granted",
    sendNotification,
}));

const { processLogLine } = await import("$ts/roblox/logs/process");

const PLACE_ID = 4242;
const UNIVERSE_ID = 777;
const GAME_ID = "0a1b2c3d-0000-4000-8000-0123456789ab";
const realFetch = globalThis.fetch;

/** handlers are fire and forget, so wait for the effect instead of the call */
async function waitFor(check: () => boolean, ms = 1000) {
    const end = Date.now() + ms;
    while (!check()) {
        if (Date.now() > end) throw new Error("timed out waiting for the log handler");
        await new Promise((r) => setTimeout(r, 2));
    }
}

const feed = (line: string) => processLogLine({ path: "log.txt", line });

function stubRobloxApis() {
    globalThis.fetch = (async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes("/universe")) return jsonResponse({ universeId: UNIVERSE_ID });
        if (url.includes("games.roproxy.com")) {
            return jsonResponse({ data: [{ name: "Obby Land", description: "", playing: 1, visits: 2 }] });
        }
        if (url.includes("avatar-headshot")) return jsonResponse({ data: [{ state: "Completed", imageUrl: "head.png" }] });
        if (url.includes("/users/")) return jsonResponse({ displayName: "Cool Person" });
        if (url.includes("glimmer-thumb")) return jsonResponse({ url: "https://img.example/icon.png" });
        throw new Error(`unexpected url ${url}`);
    }) as typeof fetch;
}

beforeEach(() => {
    resetTauri();
    for (const key of Object.keys(gameState)) delete gameState[key];
    for (const spy of [setGameState, setActivity, addActivity, fetchLocation, sendNotification]) spy.mockClear();

    appState.integrations.serverLocNotifer.enabled = false;
    appState.integrations.trimMemWhenNotFocused.enabled = false;
    appState.integrations.discordRpc.shareAccount = false;
    appState.integrations.discordRpc.largeImagePreset = "icon";
    stubRobloxApis();
});

afterEach(() => {
    globalThis.fetch = realFetch;
});

describe("processLogLine: state rules", () => {
    test("reads the user id from the join report", async () => {
        feed("2025-01-01T00:00:00.000Z,1.0,abc,6 [FLog::GameJoinLoadTime] Report game_join_loadtime: placeid:4242, sessionid:x, universeid:777, userid:123456");

        await waitFor(() => setGameState.mock.calls.length > 0);
        expect(setGameState).toHaveBeenCalledWith({ userId: 123456 });
    });

    test("reads the UDMUX server address", async () => {
        feed("[FLog::Network] UDMUX Address = 128.116.1.2, Port = 53640 | RCC Server Address = 10.0.0.9, Port = 53641");

        await waitFor(() => setGameState.mock.calls.length > 0);
        expect(setGameState).toHaveBeenCalledWith({ serverIp: "128.116.1.2" });
    });

    test("reads the server uptime timestamp", async () => {
        feed("[FLog::Output] Server Prefix: abcdef_20250102T030405Z_RCC_8f2a");

        await waitFor(() => setGameState.mock.calls.length > 0);
        expect(setGameState).toHaveBeenCalledWith({ serverUptime: "20250102T030405Z" });
    });

    test("only updates state for the rule that matched", async () => {
        feed("[FLog::Network] UDMUX Address = 1.2.3.4, Port = 1 | RCC Server Address = 5.6.7.8, Port = 2");

        await waitFor(() => setGameState.mock.calls.length > 0);
        expect(setGameState).toHaveBeenCalledTimes(1);
    });

    test("ignores lines that match no rule", async () => {
        feed("[FLog::Output] something unrelated");
        feed("");
        feed("UDMUX Address = not-an-ip");
        await new Promise((r) => setTimeout(r, 20));

        expect(setGameState).not.toHaveBeenCalled();
        expect(setActivity).not.toHaveBeenCalled();
        expect(logSpies.error).not.toHaveBeenCalled();
    });
});

describe("processLogLine: joining a game", () => {
    const joinLine = `[FLog::Network] ! Joining game '${GAME_ID}' place ${PLACE_ID} at 128.116.1.2`;

    test("sets Discord activity with the game name and a view button", async () => {
        const before = Date.now();
        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        const activity = setActivity.mock.calls[0][0] as Record<string, unknown>;

        expect(activity.state).toBe("Playing Obby Land");
        expect(activity.largeImage).toBe("https://img.example/icon.png");
        expect(activity.startTimestamp).toBeGreaterThanOrEqual(before);
        expect(activity.buttons).toEqual([{ label: "View Game", url: `https://roblox.com/games/${PLACE_ID}` }]);
    });

    test("uses the custom icon template when the preset asks for it", async () => {
        appState.integrations.discordRpc.largeImagePreset = "gisl";
        const requested: string[] = [];
        const base = globalThis.fetch;
        globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
            requested.push(String(input));
            return base(input, init);
        }) as typeof fetch;

        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        const thumb = new URL(requested.find((u) => u.includes("glimmer-thumb"))!);
        expect(thumb.searchParams.get("overlay")).toBe("black");
        expect(thumb.searchParams.get("size")).toBe("500");
        expect(thumb.searchParams.get("url_svg")).toContain("games%20is%20life.svg");
    });

    test("shares the account headshot and name when enabled", async () => {
        appState.integrations.discordRpc.shareAccount = true;
        gameState.userId = 99;

        feed(joinLine);

        await waitFor(() => addActivity.mock.calls.length > 0);
        expect(addActivity).toHaveBeenCalledWith({ smallImage: "head.png", smallText: "Cool Person (coolperson)" });
    });

    test("does not touch the account when sharing is off", async () => {
        gameState.userId = 99;

        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        await new Promise((r) => setTimeout(r, 20));
        expect(addActivity).not.toHaveBeenCalled();
    });

    test("notifies the server location when enabled", async () => {
        appState.integrations.serverLocNotifer.enabled = true;
        gameState.serverIp = "128.116.1.2";

        feed(joinLine);

        await waitFor(() => sendNotification.mock.calls.length > 0);
        expect(fetchLocation).toHaveBeenCalledWith("128.116.1.2");
        expect(sendNotification.mock.calls[0][0]).toMatchObject({ body: "Hanoi, Vietnam" });
        expect(sendNotification.mock.calls[0][0].title).toBe("bro is located in asia");
    });

    test("a failed location lookup does not stop the join: Discord presence still starts", async () => {
        appState.integrations.serverLocNotifer.enabled = true;
        gameState.serverIp = "128.116.1.2";
        fetchLocation.mockImplementationOnce(async () => {
            throw new Error("cannot fetch geolocation for 128.116.1.2: 429");
        });

        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        expect(sendNotification).not.toHaveBeenCalled();
    });

    test("skips the location notification without a server address", async () => {
        appState.integrations.serverLocNotifer.enabled = true;

        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        await new Promise((r) => setTimeout(r, 20));
        expect(fetchLocation).not.toHaveBeenCalled();
        expect(sendNotification).not.toHaveBeenCalled();
    });

    test("starts the memory trimmer on the Roblox window when enabled", async () => {
        appState.integrations.trimMemWhenNotFocused.enabled = true;
        invokeHandlers.get_roblox_hwnd = () => "0x1234";
        invokeHandlers.tasx = () => null;

        feed(joinLine);

        await waitFor(() => invokeCalls.some((c) => c.cmd === "tasx"));
        expect(invokeCalls.find((c) => c.cmd === "tasx")?.args).toEqual({ hwnd: "0x1234" });
    });

    test("logs and carries on when the memory trimmer cannot find the window", async () => {
        appState.integrations.trimMemWhenNotFocused.enabled = true;
        invokeHandlers.get_roblox_hwnd = () => {
            throw "Roblox is not running";
        };

        feed(joinLine);

        await waitFor(() => logSpies.error.mock.calls.length > 0);
        expect(logSpies.error.mock.calls[0][0]).toContain("Roblox is not running");
        expect(invokeCalls.some((c) => c.cmd === "tasx")).toBe(false);
    });

    test("logs a failing handler instead of throwing", async () => {
        globalThis.fetch = (async () => jsonResponse({}, { status: 500 })) as unknown as typeof fetch;

        expect(() => feed(joinLine)).not.toThrow();

        await waitFor(() => logSpies.error.mock.calls.some((c) => String(c[0]).includes('log rule "gameJoin" handler failed')));
        expect(setActivity).not.toHaveBeenCalled();
    });
});

describe("processLogLine: leaving a game", () => {
    test("goes back to the in-app activity", async () => {
        feed("[FLog::Network] Sending disconnect with reason: 277");

        await waitFor(() => setActivity.mock.calls.length > 0);
        expect(setActivity.mock.calls[0][0]).toMatchObject({ state: "In the app" });
        expect(logSpies.info).toHaveBeenCalledWith("disconnected game with code id: 277");
    });

    test("drops the pending headshot after leaving mid-join", async () => {
        appState.integrations.discordRpc.shareAccount = true;
        gameState.userId = 99;

        feed(`[FLog::Network] ! Joining game '${GAME_ID}' place ${PLACE_ID} at 128.116.1.2`);
        await waitFor(() => addActivity.mock.calls.length > 0);
        addActivity.mockClear();

        feed("[FLog::Network] Sending disconnect with reason: 0");
        await waitFor(() => setActivity.mock.calls.length > 1);

        // no session left, so a late universe line must not attach a headshot
        feed("[FLog::GameJoinLoadTime] universeid:777, userid:99");
        await waitFor(() => setGameState.mock.calls.length > 0);
        await new Promise((r) => setTimeout(r, 20));
        expect(addActivity).not.toHaveBeenCalled();
    });
});
