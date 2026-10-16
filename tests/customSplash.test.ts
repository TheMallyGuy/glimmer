import { beforeEach, describe, expect, test } from "bun:test";
import { CustomSplash, drawSplash, type SplashView } from "$ts/glimmer/customSplash";
import { fakeFs } from "./helpers/fakeFs";

/** the bits of an element that drawSplash touches */
function fakeElement() {
    const classes = new Set<string>();
    const attrs = new Map<string, string>();
    return {
        textContent: "",
        hidden: false,
        style: { width: "" },
        classes,
        attrs,
        classList: { toggle: (c: string, on: boolean) => void (on ? classes.add(c) : classes.delete(c)) },
        setAttribute: (k: string, v: string) => void attrs.set(k, v),
        removeAttribute: (k: string) => void attrs.delete(k),
    };
}

const IDS = ["status", "percent", "progress-bar", "progress-track", "retry-btn", "cancel-btn"] as const;
type Fake = ReturnType<typeof fakeElement>;

function fakeDoc(ids: readonly string[] = IDS) {
    const els = Object.fromEntries(ids.map((id) => [id, fakeElement()])) as Record<string, Fake>;
    const doc = { getElementById: (id: string) => els[id] ?? null } as unknown as Document;
    return { doc, els };
}

const view = (over: Partial<SplashView> = {}): SplashView => ({
    status: "Checking for updates…",
    progress: null,
    failed: false,
    cancelLabel: "Cancel",
    ...over,
});

describe("drawSplash", () => {
    test("no number yet: indeterminate bar, no percent, no retry", () => {
        const { doc, els } = fakeDoc();

        drawSplash(doc, view());

        expect(els.status.textContent).toBe("Checking for updates…");
        expect(els.percent.hidden).toBe(true);
        expect(els["progress-bar"].classes.has("indeterminate")).toBe(true);
        expect(els["progress-bar"].style.width).toBe("");
        expect(els["progress-track"].attrs.has("aria-valuenow")).toBe(false);
        expect(els["retry-btn"].hidden).toBe(true);
        expect(els["cancel-btn"].textContent).toBe("Cancel");
    });

    test("a number fills the bar and shows the percent", () => {
        const { doc, els } = fakeDoc();

        drawSplash(doc, view());
        drawSplash(doc, view({ progress: 41.6 }));

        expect(els.percent.hidden).toBe(false);
        expect(els.percent.textContent).toBe("42%");
        expect(els["progress-bar"].classes.has("indeterminate")).toBe(false);
        expect(els["progress-bar"].style.width).toBe("41.6%");
        expect(els["progress-track"].attrs.get("aria-valuenow")).toBe("42");
    });

    test("a failure marks status and bar, fills the bar and offers retry", () => {
        const { doc, els } = fakeDoc();

        drawSplash(doc, view({ status: "Sign in again", progress: 10, failed: true, cancelLabel: "Close" }));

        expect(els.status.classes.has("error")).toBe(true);
        expect(els["progress-bar"].classes.has("error")).toBe(true);
        expect(els["progress-bar"].style.width).toBe("100%");
        expect(els.percent.hidden).toBe(true);
        expect(els["retry-btn"].hidden).toBe(false);
        expect(els["cancel-btn"].textContent).toBe("Close");
    });

    test("every element is optional", () => {
        const { doc, els } = fakeDoc(["status"]);

        drawSplash(doc, view({ progress: 5, failed: true }));

        expect(els.status.textContent).toBe("Checking for updates…");
    });
});

describe("CustomSplash", () => {
    beforeEach(() => fakeFs.reset());

    test("keeps a copy of the file, and removes it", async () => {
        fakeFs.seed("/home/me/splash.html", "<p id='status'></p>");
        const splash = new CustomSplash();

        expect(await splash.load()).toBeNull();
        await splash.save("/home/me/splash.html");
        expect(await splash.load()).toBe("<p id='status'></p>");

        await splash.remove();
        expect(await splash.load()).toBeNull();
    });

    test("refuses a file over 2 MB", async () => {
        fakeFs.seed("/big.html", "x".repeat(2 * 1024 * 1024 + 1));

        await expect(new CustomSplash().save("/big.html")).rejects.toThrow("2 MB");
    });
});
