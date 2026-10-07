import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import { invokeCalls, invokeHandlers, jsonResponse, logSpies, resetTauri } from "./helpers/tauri";
import { fakeFs } from "./helpers/fakeFs";

// ---- modules process.ts pulls in that cannot (or should not) run under bun test
// appState.svelte.ts uses runes, so it is swapped for a plain object with the same shape.
const appState = {
    integrations: {
        serverLocNotifer: { enabled: false },
        trimMemWhenNotFocused: { enabled: false },
        fleasion: { enabled: false },
        windowControl: { enabled: false, allowedUniverses: [] as number[] },
        discordRpc: {
            enabled: false,
            join: false,
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

// the window control rule pulls these in, and the real plugins need a webview
mock.module("@tauri-apps/plugin-dialog", () => ({ ask: async () => true }));
mock.module("$ts/configuration", () => ({
    Configuration: { create: async () => ({ getAsText: async () => "{}", saveRaw: async () => { } }) },
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
        if (url.includes("/v1/assets")) return jsonResponse({ data: [{ state: "Completed", imageUrl: "asset.png" }] });
        if (url.includes("avatar-headshot")) return jsonResponse({ data: [{ state: "Completed", imageUrl: "head.png" }] });
        if (url.includes("/users/")) return jsonResponse({ displayName: "Cool Person", name: "coolperson" });
        if (url.includes("glimmer.mallyy.workers.dev/api/")) return jsonResponse({ url: "https://img.example/icon.png" });
        throw new Error(`unexpected url ${url}`);
    }) as typeof fetch;
}

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    for (const key of Object.keys(gameState)) delete gameState[key];
    for (const spy of [setGameState, setActivity, addActivity, fetchLocation, sendNotification]) spy.mockClear();

    appState.integrations.serverLocNotifer.enabled = false;
    appState.integrations.trimMemWhenNotFocused.enabled = false;
    appState.integrations.fleasion.enabled = false;
    appState.integrations.windowControl.enabled = false;
    appState.integrations.windowControl.allowedUniverses = [];
    appState.integrations.discordRpc.enabled = false;
    appState.integrations.discordRpc.join = false;
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

    test("remembers the game for sharing with a link code", async () => {
        fakeFs.reset();
        fakeFs.seedDir("/appdata");
        feed(joinLine);

        await waitFor(() => fakeFs.text("/appdata/games.json") !== undefined);
        expect(JSON.parse(fakeFs.text("/appdata/games.json")!)).toMatchObject([{ placeId: PLACE_ID, name: "Obby Land", plays: 1 }]);
    });

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
        const thumb = new URL(requested.find((u) => u.includes("glimmer.mallyy.workers.dev/api/"))!);
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

    test("leaves the memory trimmer off while Fleasion is on, since Roblox then runs with more rights", async () => {
        appState.integrations.trimMemWhenNotFocused.enabled = true;
        appState.integrations.fleasion.enabled = true;
        invokeHandlers.get_roblox_hwnd = () => "0x1234";
        invokeHandlers.tasx = () => null;

        feed(joinLine);

        await waitFor(() => setActivity.mock.calls.length > 0);
        await new Promise((r) => setTimeout(r, 20));
        expect(invokeCalls.some((c) => c.cmd === "tasx")).toBe(false);
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

describe("processLogLine: window control", () => {
    const titleLine = '[FLog::Output] [BloxstrapRPC] {"command":"SetWindowTitle","data":"Funky"}';

    /** joins the game with the Roblox window found, and waits until window control has seen the join */
    async function join() {
        invokeHandlers.get_roblox_hwnd = () => "42";
        invokeHandlers.window_exe_dir = () => "/appdata/versions/version-abc";
        invokeHandlers.window_set_title = () => null;
        feed(`[FLog::Network] ! Joining game '${GAME_ID}' place ${PLACE_ID} at 128.116.1.2`);
        await waitFor(() => fakeFs.has("/appdata/versions/version-abc/content/bloxstrap/enabled.png"));
    }

    test("does nothing for game messages while it is off", async () => {
        invokeHandlers.get_roblox_hwnd = () => "42";
        feed(titleLine);

        await new Promise((r) => setTimeout(r, 20));
        expect(invokeCalls).toHaveLength(0);
    });

    test("sets the title a game asks for once it is on", async () => {
        appState.integrations.windowControl.enabled = true;
        await join();

        feed(titleLine);

        await waitFor(() => invokeCalls.some((c) => c.cmd === "window_set_title"));
        expect(invokeCalls.find((c) => c.cmd === "window_set_title")?.args).toEqual({ hwnd: "42", title: "Funky" });
    });

    test("puts the title back when the game is left", async () => {
        appState.integrations.windowControl.enabled = true;
        await join();
        feed(titleLine);
        await waitFor(() => invokeCalls.some((c) => c.cmd === "window_set_title"));
        invokeHandlers.window_set_layer = () => null;

        feed("[FLog::Network] Sending disconnect with reason: 0");

        await waitFor(() => invokeCalls.filter((c) => c.cmd === "window_set_title").length === 2);
        expect(invokeCalls.filter((c) => c.cmd === "window_set_title")[1].args).toEqual({ hwnd: "42", title: "Roblox" });
    });

    test("ignores a message that is not JSON", async () => {
        appState.integrations.windowControl.enabled = true;
        await join();
        invokeCalls.length = 0;

        feed("[FLog::Output] [BloxstrapRPC] not json");

        await new Promise((r) => setTimeout(r, 20));
        expect(invokeCalls).toHaveLength(0);
        expect(logSpies.error).not.toHaveBeenCalled();
    });
});

describe("processLogLine: Bloxstrap RPC", () => {
    const joinLine = `[FLog::Network] ! Joining game '${GAME_ID}' place ${PLACE_ID} at 128.116.1.2`;
    const rpc = (command: string, data: unknown) => `[FLog::CreatorOutput] [BloxstrapRPC] ${JSON.stringify({ command, data })}`;
    const joined = () => waitFor(() => setActivity.mock.calls.length > 0);

    // the RPC state belongs to the game that is joined, so each test starts from a game that was left
    beforeEach(async () => {
        feed("[FLog::Network] Sending disconnect with reason: 0");
        await waitFor(() => setActivity.mock.calls.length > 0);
        setActivity.mockClear();
        addActivity.mockClear();
    });

    test("changes the activity for a game once Discord RPC is on", async () => {
        appState.integrations.discordRpc.enabled = true;
        feed(joinLine);
        await joined();

        feed(rpc("SetRichPresence", { details: "Round 3", largeImage: { assetId: 5, hoverText: "Boss" } }));

        await waitFor(() => addActivity.mock.calls.some((c) => c[0].details === "Round 3"));
        expect(addActivity).toHaveBeenCalledWith({ details: "Round 3", largeText: "Boss", largeImage: "asset.png" });
    });

    test("handles what a game says before Glimmer has finished joining it", async () => {
        appState.integrations.discordRpc.enabled = true;
        feed(joinLine);
        feed(rpc("SetRichPresence", { state: "early bird" }));

        await waitFor(() => addActivity.mock.calls.some((c) => c[0].state === "early bird"));
    });

    test("does nothing while Discord RPC is off", async () => {
        feed(joinLine);
        await joined();
        feed(rpc("SetRichPresence", { details: "Round 3" }));

        await new Promise((r) => setTimeout(r, 20));
        expect(addActivity).not.toHaveBeenCalled();
    });

    test("forgets the game when it is left", async () => {
        appState.integrations.discordRpc.enabled = true;
        feed(joinLine);
        await joined();
        feed("[FLog::Network] Sending disconnect with reason: 0");
        await waitFor(() => setActivity.mock.calls.length > 1);

        feed(rpc("SetRichPresence", { details: "after" }));

        await new Promise((r) => setTimeout(r, 20));
        expect(addActivity).not.toHaveBeenCalled();
    });

    test("the join button is a roblox:// link, and carries the launch data a game sets", async () => {
        appState.integrations.discordRpc.enabled = true;
        appState.integrations.discordRpc.join = true;
        feed(joinLine);
        await joined();

        const join = (setActivity.mock.calls[0][0] as { buttons: { label: string; url: string }[] }).buttons[1];
        expect(join.label).toBe("Join Game");
        expect(join.url).toBe(`roblox://experiences/start?placeId=${PLACE_ID}&gameInstanceId=${GAME_ID}`);

        feed(rpc("SetLaunchData", "room=7"));

        await waitFor(() => addActivity.mock.calls.length > 0);
        const buttons = (addActivity.mock.calls[0][0] as { buttons: { label: string; url: string }[] }).buttons;
        expect(buttons[1].url).toBe(`roblox://experiences/start?placeId=${PLACE_ID}&gameInstanceId=${GAME_ID}&launchData=room%3D7`);
    });

    test("has no join button unless the person allows friends to join", async () => {
        appState.integrations.discordRpc.enabled = true;
        feed(joinLine);
        await joined();

        expect((setActivity.mock.calls[0][0] as { buttons: unknown[] }).buttons).toHaveLength(1);
    });

    test("leaves the window commands to window control, and does not send Discord commands there", async () => {
        appState.integrations.discordRpc.enabled = true;
        appState.integrations.windowControl.enabled = true;
        invokeHandlers.get_roblox_hwnd = () => "42";
        invokeHandlers.window_exe_dir = () => "/appdata/versions/version-abc";
        invokeHandlers.window_set_title = () => null;
        feed(joinLine);
        await waitFor(() => fakeFs.has("/appdata/versions/version-abc/content/bloxstrap/enabled.png"));
        await joined();

        feed(rpc("SetRichPresence", { details: "Round 3" }));
        feed(rpc("SetWindowTitle", "Funky"));

        await waitFor(() => invokeCalls.some((c) => c.cmd === "window_set_title"));
        await waitFor(() => addActivity.mock.calls.some((c) => c[0].details === "Round 3"));
        expect(addActivity).toHaveBeenCalledTimes(1); // the title is not a Discord message
        expect(invokeCalls.filter((c) => c.cmd === "window_set_title")).toHaveLength(1);
    });
});

describe("processLogLine: the server in the game state", () => {
    test("a join sets the place and the server, and leaving clears them", async () => {
        feed(`[FLog::Output] ! Joining game '${GAME_ID}' place ${PLACE_ID} at 128.116.1.2`);
        await waitFor(() => gameState.gameServer === GAME_ID);
        expect(gameState.gameId).toBe(PLACE_ID);

        feed("[FLog::Network] Sending disconnect with reason: 285");
        await waitFor(() => gameState.gameServer === "");
        expect(gameState.gameId).toBe(0);
    });
});
