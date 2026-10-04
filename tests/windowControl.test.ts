import { beforeEach, describe, expect, mock, test } from "bun:test";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";
import { fakeFs } from "./helpers/fakeFs";
import { readFile } from "@tauri-apps/plugin-fs";
import { inflateSync } from "node:zlib";

const ask = mock(async (_body: string, _options: Record<string, unknown>) => true);
mock.module("@tauri-apps/plugin-dialog", () => ({ ask }));

const { WindowControl } = await import("$ts/roblox/windowControl");

const UNIVERSE = 777;
const DIR = "/appdata/versions/version-abc/content/bloxstrap";

let allowed: number[];
let control: InstanceType<typeof WindowControl>;

/** the Rust window commands, answering for a window at 100,200 sized 800x600 */
function stubWindow() {
    invokeHandlers.get_roblox_hwnd = () => "42";
    invokeHandlers.window_exe_dir = () => "/appdata/versions/version-abc";
    invokeHandlers.window_get_rect = () => [100, 200, 800, 600];
    invokeHandlers.window_get_monitor = () => [0, 0, 1280, 720]; // the same size as the game's idea of the screen, so no scaling
    invokeHandlers.window_set_rect = () => null;
    invokeHandlers.window_set_title = () => null;
    invokeHandlers.window_set_layer = () => null;
}

const calls = (cmd: string) => invokeCalls.filter((c) => c.cmd === cmd).map((c) => c.args);

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    ask.mockClear();
    ask.mockImplementation(async () => true);
    stubWindow();

    allowed = [];
    control = new WindowControl({
        isAllowed: (id) => allowed.includes(id),
        allow: async (id) => void allowed.push(id),
        prompt: (game) => ({ title: "Allow?", body: `${game} wants the window`, allow: "Allow", deny: "Not now" }),
    });
});

describe("WindowControl: files the SDK reads", () => {
    test("tells the SDK the launcher is there, but not that the game may do anything", async () => {
        await control.join(UNIVERSE, "Obby Land");

        expect(fakeFs.has(`${DIR}/enabled.png`)).toBe(true);
        expect(fakeFs.has(`${DIR}/${UNIVERSE}.png`)).toBe(false);
    });

    test("writes the game's file when it is allowed, and drops the last game's", async () => {
        allowed.push(UNIVERSE);
        fakeFs.seed(`${DIR}/111.png`, "old");

        await control.join(UNIVERSE, "Obby Land");

        expect(fakeFs.has(`${DIR}/${UNIVERSE}.png`)).toBe(true);
        expect(fakeFs.has(`${DIR}/111.png`)).toBe(false);
    });

    test("the picture is a 6x1 PNG that is opaque for the first three flags only", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");

        const bytes = await readFile(`${DIR}/${UNIVERSE}.png`);
        const view = new DataView(bytes.buffer, bytes.byteOffset);
        expect(Buffer.from(bytes.slice(1, 4)).toString()).toBe("PNG");
        expect([view.getUint32(16), view.getUint32(20)]).toEqual([6, 1]);

        const idat = bytes.indexOf(0x49, 33); // the "I" of IDAT, after the 25 byte header chunk
        const pixels = inflateSync(bytes.slice(idat + 4, idat + 4 + view.getUint32(idat - 4)));
        const alphas = [0, 1, 2, 3, 4, 5].map((i) => pixels[1 + i * 4 + 3]); // after the filter byte
        expect(alphas).toEqual([255, 255, 255, 0, 0, 0]);
    });
});

describe("WindowControl: commands", () => {
    test("any game can set the title", async () => {
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindowTitle", data: "My Game" });

        expect(calls("window_set_title")).toEqual([{ hwnd: "42", title: "My Game" }]);
    });

    test("drops moves from a game that is not allowed", async () => {
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 5 } });
        await control.handle({ command: "SetWindowTransparency", data: { transparency: 0.5 } });

        expect(calls("window_set_rect")).toHaveLength(0);
        expect(calls("window_set_layer")).toHaveLength(0);
    });

    test("moves and resizes, keeping the values the message leaves out", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 10, width: 300 } });

        expect(calls("window_set_rect")).toEqual([{ hwnd: "42", x: 10, y: 200, width: 300, height: 600 }]);
    });

    test("only moves once the game sends a position, and uses y only with an x", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { width: 300, height: 100 } });
        await control.handle({ command: "SetWindow", data: { y: 5 } });
        expect(calls("window_set_rect")).toHaveLength(0);

        await control.handle({ command: "SetWindow", data: { x: 1 } });
        expect(calls("window_set_rect")).toEqual([{ hwnd: "42", x: 1, y: 200, width: 300, height: 100 }]);
    });

    test("scales the game's 1280x720 screen to the real one, on the screen the window is on", async () => {
        allowed.push(UNIVERSE);
        invokeHandlers.window_get_monitor = () => [1920, 0, 2560, 1440]; // a second screen, twice the size
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 10, y: 20, width: 640, height: 360 } });

        expect(calls("window_set_rect")).toEqual([{ hwnd: "42", x: 1940, y: 40, width: 1280, height: 720 }]);
    });

    test("uses the screen size the game says it was made for", async () => {
        allowed.push(UNIVERSE);
        invokeHandlers.window_get_monitor = () => [0, 0, 2560, 1440];
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 0, y: 0, width: 960, height: 540, scaleWidth: 1920, scaleHeight: 1080 } });

        expect(calls("window_set_rect")).toEqual([{ hwnd: "42", x: 0, y: 0, width: 1280, height: 720 }]);
    });

    test("puts the window back where it started on ResetWindow", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 10, y: 20 } });
        await control.handle({ command: "ResetWindow" });

        expect(calls("window_set_rect").at(-1)).toEqual({ hwnd: "42", x: 100, y: 200, width: 800, height: 600 });
    });

    test("fades the whole window in alpha mode", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindowTransparency", data: { transparency: 0.5, useAlpha: true } });

        expect(calls("window_set_layer")).toEqual([{ hwnd: "42", alpha: 127, key: 0, useAlpha: true }]);
    });

    test("keys out the colour in the default mode, with the alpha the game sent, remembering it between messages", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        // Windows reads the colour as 0x00bbggrr, and the SDK sends it already in that order
        await control.handle({ command: "SetWindowTransparency", data: { color: "0x00ff00", transparency: 0.98 } });
        await control.handle({ command: "SetWindowTransparency", data: { transparency: 0.9 } });

        expect(calls("window_set_layer")).toEqual([
            { hwnd: "42", alpha: 249, key: 0x00ff00, useAlpha: false },
            { hwnd: "42", alpha: 229, key: 0x00ff00, useAlpha: false },
        ]);
    });

    test("reads a colour without the 0x as hex too", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindowTransparency", data: { color: "ff0000", transparency: 0.5 } });

        expect(calls("window_set_layer")).toEqual([{ hwnd: "42", alpha: 127, key: 0xff0000, useAlpha: false }]);
    });

    test("a colour key does not turn into a fade: the mode only changes when the game says so", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindowTransparency", data: { transparency: 0, color: "0x00ff00" } });

        // alpha 0 is sent with useAlpha false, which Windows ignores for a key: the window must not go invisible
        expect(calls("window_set_layer")).toEqual([{ hwnd: "42", alpha: 0, key: 0x00ff00, useAlpha: false }]);
    });

    test("a mid-flight failure does not stop the commands after it", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        invokeHandlers.window_get_rect = () => {
            throw new Error("window gone");
        };

        await expect(control.handle({ command: "SetWindow", data: { x: 1 } })).rejects.toThrow("window gone");
        await control.handle({ command: "SetWindowTitle", data: "Still works" });

        expect(calls("window_set_title")).toEqual([{ hwnd: "42", title: "Still works" }]);
    });

    test("does nothing for commands it does not know", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWallpaper", data: { assetId: 1 } });

        expect(calls("window_set_rect")).toHaveLength(0);
        expect(calls("window_set_layer")).toHaveLength(0);
    });
});

describe("WindowControl: permission", () => {
    test("asks about the game by name, then remembers the answer and shows the game its file", async () => {
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "RequestWindowPermission" });

        expect(ask.mock.calls[0][0]).toBe("Obby Land wants the window");
        expect(ask.mock.calls[0][1]).toMatchObject({ title: "Allow?", okLabel: "Allow", cancelLabel: "Not now" });
        expect(allowed).toEqual([UNIVERSE]);
        expect(fakeFs.has(`${DIR}/${UNIVERSE}.png`)).toBe(true);
    });

    test("keeps the game out when the person says not now, and does not ask again this session", async () => {
        ask.mockImplementation(async () => false);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "RequestWindowPermission" });
        await control.handle({ command: "RequestWindowPermission" });

        expect(ask).toHaveBeenCalledTimes(1);
        expect(allowed).toEqual([]);
        expect(fakeFs.has(`${DIR}/${UNIVERSE}.png`)).toBe(false);
    });

    test("does not ask about a game that is already allowed", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "RequestWindowPermission" });

        expect(ask).not.toHaveBeenCalled();
    });
});

describe("WindowControl: leaving", () => {
    test("puts back the position, the colours and the title", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.handle({ command: "SetWindow", data: { x: 10 } });
        await control.handle({ command: "SetWindowTransparency", data: { transparency: 0.5 } });
        await control.handle({ command: "SetWindowTitle", data: "Hacked" });
        await control.leave();

        expect(calls("window_set_rect").at(-1)).toEqual({ hwnd: "42", x: 100, y: 200, width: 800, height: 600 });
        expect(calls("window_set_layer").at(-1)).toEqual({ hwnd: "42", alpha: 255, key: 0, useAlpha: false });
        expect(calls("window_set_title").at(-1)).toEqual({ hwnd: "42", title: "Roblox" });
    });

    test("leaves the window alone when the game never touched it", async () => {
        await control.join(UNIVERSE, "Obby Land");
        invokeCalls.length = 0;
        await control.leave();

        expect(invokeCalls).toHaveLength(0);
    });

    test("a game that leaves can no longer move the window", async () => {
        allowed.push(UNIVERSE);
        await control.join(UNIVERSE, "Obby Land");
        await control.leave();
        invokeCalls.length = 0;
        await control.handle({ command: "SetWindow", data: { x: 1 } });

        expect(calls("window_set_rect")).toHaveLength(0);
    });
});
