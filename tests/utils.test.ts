import { describe, expect, test } from "bun:test";
import { cn } from "$lib/utils";
import { delay, joinUrl } from "$ts/glimmer/utils";

describe("joinUrl", () => {
    test("joins with exactly one slash", () => {
        expect(joinUrl("https://a.com", "b")).toBe("https://a.com/b");
        expect(joinUrl("https://a.com/", "b")).toBe("https://a.com/b");
        expect(joinUrl("https://a.com", "/b")).toBe("https://a.com/b");
        expect(joinUrl("https://a.com/", "/b")).toBe("https://a.com/b");
    });

    test("collapses repeated slashes at the join", () => {
        expect(joinUrl("https://a.com///", "///b/c")).toBe("https://a.com/b/c");
    });

    test("keeps slashes inside the path and the protocol", () => {
        expect(joinUrl("https://a.com/x/", "y/z")).toBe("https://a.com/x/y/z");
    });

    test("keeps a trailing slash on the path", () => {
        expect(joinUrl("https://a.com", "b/")).toBe("https://a.com/b/");
    });
});

describe("delay", () => {
    test("resolves after roughly the requested time", async () => {
        const start = performance.now();
        await delay(30);
        expect(performance.now() - start).toBeGreaterThanOrEqual(25);
    });
});

describe("cn", () => {
    test("joins class names", () => {
        expect(cn("a", "b")).toBe("a b");
    });

    test("drops falsy values", () => {
        expect(cn("a", false, null, undefined, "", "b")).toBe("a b");
    });

    test("lets later Tailwind classes override earlier ones", () => {
        expect(cn("px-2 py-1", "px-4")).toBe("py-1 px-4");
        expect(cn("text-muted", "text-fg")).toBe("text-fg");
    });

    test("returns an empty string with nothing to join", () => {
        expect(cn()).toBe("");
        expect(cn(false, null)).toBe("");
    });
});
