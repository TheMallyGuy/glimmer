import { beforeEach, describe, expect, test } from "bun:test";
import { OVERLAY_SHORTCUT, OverlayShortcut, type ShortcutPlugin } from "$ts/overlayShortcut";

type Handler = Parameters<ShortcutPlugin["register"]>[1];

let handler: Handler | null;
let calls: string[];
let events: string[];
let shortcut: OverlayShortcut;
let registeredBefore: boolean;

const plugin: ShortcutPlugin = {
    async register(key, onEvent) {
        calls.push(`register ${key}`);
        handler = onEvent;
    },
    async unregister(key) {
        calls.push(`unregister ${key}`);
        handler = null;
    },
    async isRegistered() {
        return handler !== null || registeredBefore;
    },
};

const send = (state: "Pressed" | "Released") => handler!({ shortcut: OVERLAY_SHORTCUT, id: 1, state });

beforeEach(() => {
    handler = null;
    calls = [];
    events = [];
    registeredBefore = false;
    shortcut = new OverlayShortcut({ press: () => events.push("press"), release: () => events.push("release") }, plugin);
});

describe("OverlayShortcut", () => {
    test("the shortcut is Alt + G", () => {
        expect(OVERLAY_SHORTCUT).toBe("Alt+G");
    });

    test("turning it on registers it, and turning it off again unregisters it", async () => {
        await shortcut.set(true);
        expect(calls).toEqual(["register Alt+G"]);

        await shortcut.set(false);
        expect(calls).toEqual(["register Alt+G", "unregister Alt+G"]);
        expect(handler).toBeNull();
    });

    test("turning it on twice replaces the handler instead of failing on the registration", async () => {
        await shortcut.set(true);
        await shortcut.set(true);

        expect(calls).toEqual(["register Alt+G", "unregister Alt+G", "register Alt+G"]);
    });

    test("turning it off when it was never on does not unregister anything", async () => {
        await shortcut.set(false);

        expect(calls).toEqual([]);
    });

    test("a press and a release reach the handlers once each", async () => {
        await shortcut.set(true);
        send("Pressed");
        send("Released");

        expect(events).toEqual(["press", "release"]);
    });

    test("a held shortcut that repeats is one press", async () => {
        await shortcut.set(true);
        send("Pressed");
        send("Pressed");
        send("Pressed");

        expect(events).toEqual(["press"]);
    });

    test("more than one report of the release is one release", async () => {
        await shortcut.set(true);
        send("Pressed");
        send("Pressed");
        send("Released");
        send("Released");

        expect(events).toEqual(["press", "release"]);
    });

    test("a release of something that was never pressed is dropped", async () => {
        await shortcut.set(true);
        send("Released");

        expect(events).toEqual([]);
    });

    test("can be pressed again after a release", async () => {
        await shortcut.set(true);
        send("Pressed");
        send("Released");
        send("Pressed");
        send("Released");

        expect(events).toEqual(["press", "release", "press", "release"]);
    });

    test("tells whether it is held", async () => {
        await shortcut.set(true);
        expect(shortcut.held).toBe(false);

        send("Pressed");
        expect(shortcut.held).toBe(true);

        send("Released");
        expect(shortcut.held).toBe(false);
    });

    test("turning it off lets go of it", async () => {
        await shortcut.set(true);
        send("Pressed");
        await shortcut.set(false);

        expect(shortcut.held).toBe(false);
    });
});
