import { beforeEach, describe, expect, test } from "bun:test";
import { BACKGROUND_PRESETS, BackgroundImage, BackgroundTheme, DEFAULT_BACKGROUND } from "$ts/glimmer/background";
import { fakeFs } from "./helpers/fakeFs";

/** the bit of <html> that `apply` touches */
function fakeRoot() {
    const vars = new Map<string, string>();
    const root = {
        style: {
            setProperty: (k: string, v: string) => vars.set(k, v),
            removeProperty: (k: string) => vars.delete(k),
        },
    } as unknown as HTMLElement;
    return { vars, root };
}

describe("BackgroundTheme.surfaces", () => {
    test("the default background reproduces the surfaces of theme.css", () => {
        const s = BackgroundTheme.surfaces(DEFAULT_BACKGROUND);

        // theme.css: surface #111111, row #151515, tonal #1f1f1f, footer #0b0b0b. Equal within a rounding step.
        const near = (a: string, b: string) => Math.abs(parseInt(a.slice(1, 3), 16) - parseInt(b.slice(1, 3), 16)) <= 1;
        expect(near(s["--color-surface"], "#111111")).toBe(true);
        expect(near(s["--color-row"], "#151515")).toBe(true);
        expect(near(s["--color-tonal"], "#1f1f1f")).toBe(true);
        expect(near(s["--color-footer"], "#0b0b0b")).toBe(true);
        expect(near(s["--color-field-hover"], "#222222")).toBe(true);
    });

    test("a tinted background tints every surface and keeps their order", () => {
        const s = BackgroundTheme.surfaces("#0d140f");
        const green = (hex: string) => parseInt(hex.slice(3, 5), 16);

        expect(green(s["--color-row"])).toBeGreaterThan(parseInt(s["--color-row"].slice(1, 3), 16));
        expect(green(s["--color-surface"])).toBeLessThan(green(s["--color-row"]));
        expect(green(s["--color-row"])).toBeLessThan(green(s["--color-tonal-hover"]));
    });
});

describe("BackgroundTheme.isUsable", () => {
    test("every preset is usable", () => {
        for (const preset of BACKGROUND_PRESETS) expect(BackgroundTheme.isUsable(preset)).toBe(true);
    });

    test("light colours are not, because the muted text would fade into them", () => {
        expect(BackgroundTheme.isUsable("#ffffff")).toBe(false);
        expect(BackgroundTheme.isUsable("#808080")).toBe(false);
    });
});

describe("BackgroundTheme.apply", () => {
    test("without a picture the window background is the opaque colour and no picture is set", () => {
        const { vars, root } = fakeRoot();
        vars.set("--app-background-image", "stale");

        BackgroundTheme.apply(root, "#0d140f", null, 0.7);

        expect(vars.get("--color-app")).toBe("#0d140f");
        expect(vars.has("--app-background-image")).toBe(false);
        expect(vars.get("--color-row")).toMatch(/^#[0-9a-f]{6}$/);
    });

    test("with a picture the window is see-through and surfaces gain some transparency", () => {
        const { vars, root } = fakeRoot();

        BackgroundTheme.apply(root, "#0d0d0d", "blob:abc", 0.5);

        expect(vars.get("--color-app")).toBe("transparent");
        expect(vars.get("--color-canvas")).toBe("#0d0d0d");
        expect(vars.get("--color-row")).toMatch(/^rgb\(\d+ \d+ \d+ \/ 0\.82\)$/);
        expect(vars.get("--app-background-image")).toContain('url("blob:abc")');
        expect(vars.get("--app-background-image")).toContain("/ 0.5)");
    });

    test("the dimming is kept between 0 and the maximum", () => {
        const { vars, root } = fakeRoot();

        BackgroundTheme.apply(root, "#0d0d0d", "blob:abc", 5);
        expect(vars.get("--app-background-image")).toContain("/ 0.9)");

        BackgroundTheme.apply(root, "#0d0d0d", "blob:abc", -1);
        expect(vars.get("--app-background-image")).toContain("/ 0)");
    });

    test("something that is not a colour falls back to the default", () => {
        const { vars, root } = fakeRoot();

        BackgroundTheme.apply(root, "nope", null, 0.7);

        expect(vars.get("--color-app")).toBe(DEFAULT_BACKGROUND);
    });
});

describe("BackgroundImage", () => {
    const PNG = new Uint8Array([137, 80, 78, 71]);

    beforeEach(() => fakeFs.reset());

    test("extensionOf only accepts supported pictures", () => {
        expect(BackgroundImage.extensionOf("C:\\pics\\Cat.JPG")).toBe("jpg");
        expect(BackgroundImage.extensionOf("/a/b.webp")).toBe("webp");
        expect(BackgroundImage.extensionOf("/a/b.svg")).toBeNull();
        expect(BackgroundImage.extensionOf("/a/noext")).toBeNull();
    });

    test("save copies the picture into the app data folder", async () => {
        fakeFs.seed("/home/pics/cat.png", PNG);

        const name = await new BackgroundImage().save("/home/pics/cat.png");

        expect(name).toBe("background.png");
        expect(fakeFs.has("/appdata/backgrounds/background.png")).toBe(true);
    });

    test("a new picture replaces the old one, even in another format", async () => {
        fakeFs.seed("/pics/a.png", PNG);
        fakeFs.seed("/pics/b.jpg", PNG);
        const images = new BackgroundImage();

        await images.save("/pics/a.png");
        await images.save("/pics/b.jpg");

        expect(fakeFs.has("/appdata/backgrounds/background.png")).toBe(false);
        expect(fakeFs.has("/appdata/backgrounds/background.jpg")).toBe(true);
    });

    test("save refuses a file that is not a supported picture", async () => {
        fakeFs.seed("/pics/doc.pdf", PNG);

        await expect(new BackgroundImage().save("/pics/doc.pdf")).rejects.toThrow("Use one of");
    });

    test("save refuses a picture over 20 MB", async () => {
        fakeFs.seed("/pics/huge.png", new Uint8Array(20 * 1024 * 1024 + 1));

        await expect(new BackgroundImage().save("/pics/huge.png")).rejects.toThrow("bigger than 20 MB");
    });

    test("load returns a blob url for a stored picture, and null when it is gone", async () => {
        fakeFs.seed("/appdata/backgrounds/background.png", PNG);
        const images = new BackgroundImage();

        expect(await images.load("background.png")).toMatch(/^blob:/);
        expect(await images.load("background.jpg")).toBeNull();
    });

    test("remove deletes the stored picture", async () => {
        fakeFs.seed("/appdata/backgrounds/background.png", PNG);

        await new BackgroundImage().remove("background.png");

        expect(fakeFs.has("/appdata/backgrounds/background.png")).toBe(false);
    });
});
