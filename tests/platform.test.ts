import { afterEach, describe, expect, test } from "bun:test";
import { isAndroid } from "$ts/glimmer/android/platform";

const original = Object.getOwnPropertyDescriptor(globalThis, "navigator");

function setAgent(userAgent: string) {
    Object.defineProperty(globalThis, "navigator", { value: { userAgent }, configurable: true });
}

afterEach(() => {
    if (original) Object.defineProperty(globalThis, "navigator", original);
    else delete (globalThis as { navigator?: unknown }).navigator;
});

describe("isAndroid", () => {
    test("is true for an Android webview", () => {
        setAgent("Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 Chrome/120 Mobile Safari/537.36");
        expect(isAndroid()).toBe(true);
    });

    test("is false on desktop", () => {
        setAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36");
        expect(isAndroid()).toBe(false);
    });

    test("is false without a navigator", () => {
        delete (globalThis as { navigator?: unknown }).navigator;
        expect(isAndroid()).toBe(false);
    });
});
