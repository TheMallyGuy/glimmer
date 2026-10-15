import { beforeEach, describe, expect, test } from "bun:test";
import { DeepLinkHandler, type DeepLink } from "$ts/glimmer/deepLinkHandler";
import { logSpies, resetTauri } from "./helpers/tauri";
import { fakeWebviews, WebviewWindow } from "./helpers/webview";

beforeEach(() => {
    resetTauri();
    fakeWebviews.reset();
});

describe("DeepLinkHandler.parse", () => {
    test("splits the scheme from the rest", () => {
        expect(DeepLinkHandler.parse("roblox-player:1+launchmode:app+gameinfo:T")).toEqual({
            raw: "roblox-player:1+launchmode:app+gameinfo:T",
            scheme: "roblox-player",
            rest: "1+launchmode:app+gameinfo:T",
        });
    });

    test("drops the // of a url-style link and lowercases the scheme", () => {
        expect(DeepLinkHandler.parse("  GLIMMER://open?x=1 ")).toEqual({ raw: "GLIMMER://open?x=1", scheme: "glimmer", rest: "open?x=1" });
    });

    test.each(["", "not a link", "://nothing", "1abc:x"])("%p is not a link", (input) => {
        expect(DeepLinkHandler.parse(input)).toBeNull();
    });
});

describe("DeepLinkHandler.start", () => {
    /** a `listen` the test can push links into, like the OS handing over a second launch */
    function wiring(startedWith: string[] | null = null) {
        let push: (urls: string[]) => void = () => { };
        let stopped = 0;
        const listen = (async (cb: (urls: string[]) => void) => {
            push = cb;
            return () => void stopped++;
        }) as never;
        const current = (async () => startedWith) as never;
        const seen: DeepLink[] = [];
        const handler = new DeepLinkHandler(async (link) => void seen.push(link), listen, current);
        return { handler, seen, send: (...urls: string[]) => push(urls), stopped: () => stopped };
    }

    test("handles a link that arrives while Glimmer is running", async () => {
        const { handler, seen, send } = wiring();
        await handler.start();

        send("roblox-player:abc");
        await new Promise((r) => setTimeout(r, 0));

        expect(seen.map((l) => l.scheme)).toEqual(["roblox-player"]);
    });

    test("handles the link Glimmer was started with", async () => {
        const { handler, seen } = wiring(["roblox:xyz"]);

        await handler.start();

        expect(seen.map((l) => l.raw)).toEqual(["roblox:xyz"]);
    });

    test("skips anything that is not a link", async () => {
        const { handler, seen, send } = wiring();
        await handler.start();

        send("junk", "glimmer:ok");
        await new Promise((r) => setTimeout(r, 0));

        expect(seen.map((l) => l.scheme)).toEqual(["glimmer"]);
    });

    test("logs the scheme but never the link itself, which can hold a login ticket", async () => {
        const { handler } = wiring(["roblox-player:1+gameinfo:SECRETTICKET"]);

        await handler.start();

        const logged = logSpies.info.mock.calls.map((c) => String(c[0])).join("\n");
        expect(logged).toContain("roblox-player");
        expect(logged).not.toContain("SECRETTICKET");
    });

    test("returns a function that stops listening", async () => {
        const { handler, stopped } = wiring();

        (await handler.start())();

        expect(stopped()).toBe(1);
    });

    test("by default a link that is not a Roblox one brings the open window forward", async () => {
        const chooser = new WebviewWindow("main");
        const handler = new DeepLinkHandler(undefined, (async () => () => { }) as never, (async () => ["glimmer:x"]) as never);

        await handler.start();

        expect(chooser.calls).toEqual(["unminimize", "show", "setFocus"]);
    });

    test("by default a roblox-player: link opens the splash with the link", async () => {
        const handler = new DeepLinkHandler(undefined, (async () => () => { }) as never, (async () => ["roblox-player:1+launchmode:play+gameinfo:T"]) as never);

        await handler.start();

        const splash = fakeWebviews.created.find((w) => w.label === "splash");
        expect(String(splash?.options.url)).toBe("/splash?target=player&link=" + encodeURIComponent("roblox-player:1+launchmode:play+gameinfo:T"));
    });

    test("by default a roblox://experiences/start game link opens the splash with the link", async () => {
        const link = "roblox://experiences/start?placeId=1818&gameInstanceId=abc";
        const handler = new DeepLinkHandler(undefined, (async () => () => { }) as never, (async () => [link]) as never);

        await handler.start();

        const splash = fakeWebviews.created.find((w) => w.label === "splash");
        expect(String(splash?.options.url)).toBe("/splash?target=player&link=" + encodeURIComponent(link));
    });

    test.each([
        "roblox://navigation/profile?userId=1",
        "roblox://navigation/game_details?placeId=1818",
        "roblox://avatar",
        "roblox:navigation/profile?userId=1",
    ])("another roblox: link, %p, opens the splash with the link", async (link) => {
        const handler = new DeepLinkHandler(undefined, (async () => () => { }) as never, (async () => [link]) as never);

        await handler.start();

        const splash = fakeWebviews.created.find((w) => w.label === "splash");
        expect(String(splash?.options.url)).toBe("/splash?target=player&link=" + encodeURIComponent(link));
    });

    test.each(["roblox:", "roblox://"])("an empty roblox: link, %p, only brings the window forward", async (link) => {
        const chooser = new WebviewWindow("main");
        const handler = new DeepLinkHandler(undefined, (async () => () => { }) as never, (async () => [link]) as never);

        await handler.start();

        expect(chooser.calls).toEqual(["unminimize", "show", "setFocus"]);
        expect(fakeWebviews.created.find((w) => w.label === "splash")).toBeUndefined();
    });
});
