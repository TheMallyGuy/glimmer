import { beforeEach, describe, expect, test } from "bun:test";
import {
    buildFont,
    countEdits,
    findBuilderIcons,
    listGlyphs,
    saveFont,
    type FontEdits,
    type SourceFont,
} from "$ts/roblox/mod/fontEditor";
import { EXTRACT_ROOTS } from "$ts/roblox/installation/download";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";
import { cmapFormat12, cmapFormat4, cmapTable, postTable, sfnt } from "./helpers/ttf";

const FONT = "/fonts/test.ttf";

beforeEach(() => {
    fakeFs.reset();
    resetTauri();
});

/** write a font to the fake disk and list its glyphs */
async function glyphsOf(tables: Record<string, Uint8Array>) {
    fakeFs.seed(FONT, sfnt(tables));
    return (await listGlyphs(FONT)).glyphs;
}

const unicodeFormat12 = (...runs: Parameters<typeof cmapFormat12>[0]) =>
    cmapTable([[3, 10, cmapFormat12(runs)]]);

describe("listGlyphs", () => {
    test("reads private-use codepoints and their post names (format 12)", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12({ first: 0xe000, last: 0xe002, glyph: 1 }),
            post: postTable([undefined, "arrow-left", "arrow-right", "home"]),
        });

        expect(glyphs).toEqual([
            { name: "arrow-left", codepoint: 0xe000 },
            { name: "arrow-right", codepoint: 0xe001 },
            { name: "home", codepoint: 0xe002 },
        ]);
    });

    test("falls back to uniXXXX when the font has no post table", async () => {
        const glyphs = await glyphsOf({ cmap: unicodeFormat12({ first: 0xe0a0, last: 0xe0a1, glyph: 1 }) });

        expect(glyphs.map((g) => g.name)).toEqual(["uniE0A0", "uniE0A1"]);
    });

    test("falls back for glyphs the post table does not name", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12({ first: 0xe000, last: 0xe001, glyph: 1 }),
            post: postTable([undefined, "named", undefined]),
        });

        expect(glyphs.map((g) => g.name)).toEqual(["named", "uniE001"]);
    });

    test("ignores a post table that is not version 2", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12({ first: 0xe000, last: 0xe000, glyph: 1 }),
            post: postTable([undefined, "ignored"], 0x00030000),
        });

        expect(glyphs.map((g) => g.name)).toEqual(["uniE000"]);
    });

    test("keeps only the private use area", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12(
                { first: 0x41, last: 0x42, glyph: 1 }, // A, B
                { first: 0xdfff, last: 0xe000, glyph: 3 },
                { first: 0xf8ff, last: 0xf900, glyph: 5 },
            ),
        });

        expect(glyphs.map((g) => g.codepoint)).toEqual([0xe000, 0xf8ff]);
    });

    test("sorts by codepoint", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12(
                { first: 0xe100, last: 0xe100, glyph: 2 },
                { first: 0xe000, last: 0xe000, glyph: 1 },
            ),
        });

        expect(glyphs.map((g) => g.codepoint)).toEqual([0xe000, 0xe100]);
    });

    test("lists a name once when several codepoints share a glyph", async () => {
        const glyphs = await glyphsOf({
            cmap: unicodeFormat12(
                { first: 0xe000, last: 0xe000, glyph: 1 },
                { first: 0xe001, last: 0xe001, glyph: 1 },
            ),
            post: postTable([undefined, "same"]),
        });

        expect(glyphs).toEqual([{ name: "same", codepoint: 0xe000 }]);
    });

    test("returns the raw font bytes alongside the glyphs", async () => {
        const font = sfnt({ cmap: unicodeFormat12({ first: 0xe000, last: 0xe000, glyph: 1 }) });
        fakeFs.seed(FONT, font);

        const { bytes } = await listGlyphs(FONT);
        expect(bytes).toEqual(font);
    });

    describe("format 4 cmaps", () => {
        const format4 = (...runs: Parameters<typeof cmapFormat4>[0]) => cmapTable([[3, 1, cmapFormat4(runs)]]);

        test("maps runs through idDelta", async () => {
            const glyphs = await glyphsOf({
                cmap: format4({ first: 0xe000, last: 0xe002, glyph: 10 }),
                post: postTable([...Array(10).fill(undefined), "a", "b", "c"]),
            });

            expect(glyphs).toEqual([
                { name: "a", codepoint: 0xe000 },
                { name: "b", codepoint: 0xe001 },
                { name: "c", codepoint: 0xe002 },
            ]);
        });

        test("maps runs through the glyphIdArray and skips unmapped (0) entries", async () => {
            const glyphs = await glyphsOf({
                cmap: format4({ first: 0xe000, last: 0xe002, glyphIds: [4, 0, 6] }),
            });

            expect(glyphs.map((g) => g.codepoint)).toEqual([0xe000, 0xe002]);
        });

        test("handles several segments", async () => {
            const glyphs = await glyphsOf({
                cmap: format4(
                    { first: 0xe000, last: 0xe000, glyph: 1 },
                    { first: 0xe800, last: 0xe801, glyph: 2 },
                ),
            });

            expect(glyphs.map((g) => g.codepoint)).toEqual([0xe000, 0xe800, 0xe801]);
        });
    });

    test("prefers a format 12 subtable over format 4", async () => {
        const glyphs = await glyphsOf({
            cmap: cmapTable([
                [3, 1, cmapFormat4([{ first: 0xe000, last: 0xe000, glyph: 1 }])],
                [3, 10, cmapFormat12([{ first: 0xe500, last: 0xe500, glyph: 1 }])],
            ]),
        });

        expect(glyphs.map((g) => g.codepoint)).toEqual([0xe500]);
    });

    test("ignores subtables for other platforms", async () => {
        const glyphs = await glyphsOf({
            cmap: cmapTable([[1, 0, cmapFormat12([{ first: 0xe000, last: 0xe000, glyph: 1 }])]]),
        });

        expect(glyphs).toEqual([]);
    });

    test("throws when the font has no cmap table", async () => {
        fakeFs.seed(FONT, sfnt({ post: postTable([]) }));

        await expect(listGlyphs(FONT)).rejects.toThrow("This font has no character map.");
    });

    test("throws when the file does not exist", async () => {
        await expect(listGlyphs("/fonts/missing.ttf")).rejects.toThrow();
    });
});

describe("countEdits", () => {
    test("counts edited icons", () => {
        const edits: FontEdits = {
            home: { colors: ["#fff"] },
            star: { art: { kind: "svg", path: "/a.svg" } },
        };

        expect(countEdits(edits)).toBe(2);
        expect(countEdits({})).toBe(0);
    });
});

describe("buildFont", () => {
    const source: SourceFont = { label: "Regular", path: "/stock/BuilderIcons-Regular.ttf", rel: [] };
    const OUT = "/appdata/font-editor/BuilderIcons-Regular.ttf";

    beforeEach(() => {
        invokeHandlers.run_font_tool = () => "ok";
    });

    test("runs the font tool with just the paths when there are no edits", async () => {
        expect(await buildFont(source, {})).toBe(OUT);

        expect(invokeCalls).toEqual([{ cmd: "run_font_tool", args: { args: [source.path, OUT] } }]);
        expect(fakeFs.has("/appdata/font-editor/colors.json")).toBe(false);
        expect(fakeFs.has("/appdata/font-editor/icons.json")).toBe(false);
    });

    test("writes colors.json: one color is flat, several are a gradient", async () => {
        await buildFont(source, {
            flat: { colors: ["#ff0000"] },
            fade: { colors: ["#ff0000", "#0000ff"] },
        });

        expect(JSON.parse(fakeFs.text("/appdata/font-editor/colors.json")!)).toEqual({
            flat: "#ff0000",
            fade: ["#ff0000", "#0000ff"],
        });
        expect(invokeCalls[0].args).toEqual({
            args: [source.path, OUT, "--colors", "/appdata/font-editor/colors.json"],
        });
    });

    test("writes icons.json for artwork", async () => {
        await buildFont(source, {
            logo: { art: { kind: "svg", path: "/logo.svg" } },
            photo: { art: { kind: "png", path: "/photo.png" } },
        });

        expect(JSON.parse(fakeFs.text("/appdata/font-editor/icons.json")!)).toEqual({
            logo: { svg: "/logo.svg" },
            photo: { png: "/photo.png" },
        });
        expect(invokeCalls[0].args).toEqual({
            args: [source.path, OUT, "--icons", "/appdata/font-editor/icons.json"],
        });
    });

    test("artwork wins over colors for the same icon", async () => {
        await buildFont(source, { both: { colors: ["#fff"], art: { kind: "svg", path: "/a.svg" } } });

        expect(fakeFs.has("/appdata/font-editor/colors.json")).toBe(false);
        expect(JSON.parse(fakeFs.text("/appdata/font-editor/icons.json")!)).toEqual({ both: { svg: "/a.svg" } });
    });

    test("ignores edits with an empty color list", async () => {
        await buildFont(source, { nothing: { colors: [] } });

        expect(invokeCalls[0].args).toEqual({ args: [source.path, OUT] });
    });

    test("passes both files when there are both kinds of edit", async () => {
        await buildFont(source, {
            tint: { colors: ["#fff"] },
            logo: { art: { kind: "svg", path: "/logo.svg" } },
        });

        expect((invokeCalls[0].args as { args: string[] }).args).toEqual([
            source.path,
            OUT,
            "--colors",
            "/appdata/font-editor/colors.json",
            "--icons",
            "/appdata/font-editor/icons.json",
        ]);
    });

    test("throws the tool's error message", async () => {
        invokeHandlers.run_font_tool = () => {
            throw "BuildersColors exited with code 1";
        };

        await expect(buildFont(source, {})).rejects.toThrow("BuildersColors exited with code 1");
    });
});

describe("saveFont", () => {
    test("copies the built font to the chosen destination", async () => {
        fakeFs.seed("/built/font.ttf", "font-bytes");

        await saveFont("/built/font.ttf", "/out/icons.ttf");

        expect(fakeFs.text("/out/icons.ttf")).toBe("font-bytes");
    });
});

describe("findBuilderIcons", () => {
    const FONT_DIR = "ExtraContent/LuaPackages/Packages/_Index/BuilderIcons/BuilderIcons/Font";

    // a complete package cache, whose "stock" extraction finds nothing unless a test says otherwise
    beforeEach(() => {
        for (const zip of Object.keys(EXTRACT_ROOTS.player)) fakeFs.seed(`/cache/glimmer-downloads/version-aaaa/${zip}`, "zip");
        invokeHandlers.extract_package_files = () => [];
    });

    test("is empty without an active install", async () => {
        expect(await findBuilderIcons()).toEqual([]);
    });

    test("lists the Regular and Filled fonts of the active install, sorted by label", async () => {
        const install = "/appdata/versions/version-aaaa";
        fakeFs.seed(`${install}/AppSettings.xml`, "<Settings />");
        fakeFs.seed(
            "/appdata/versions/index.json",
            JSON.stringify([{ version: "version-aaaa", path: install, active: true }]),
        );
        fakeFs.seed(`${install}/${FONT_DIR}/BuilderIcons-Regular.ttf`, "r");
        fakeFs.seed(`${install}/${FONT_DIR}/BuilderIcons-Filled.ttf`, "f");
        fakeFs.seed(`${install}/${FONT_DIR}/BuilderIcons-Other.ttf`, "o");

        const fonts = await findBuilderIcons();

        expect(fonts.map((f) => f.label)).toEqual(["Filled", "Regular"]);
        expect(fonts[0].path).toBe(`${install}/${FONT_DIR}/BuilderIcons-Filled.ttf`);
    });

    test("is empty when the active install has no BuilderIcons folder", async () => {
        const install = "/appdata/versions/version-aaaa";
        fakeFs.seed(`${install}/AppSettings.xml`, "<Settings />");
        fakeFs.seed("/appdata/versions/index.json", JSON.stringify([{ version: "version-aaaa", path: install, active: true }]));

        expect(await findBuilderIcons()).toEqual([]);
    });

    test("edits the stock copy of a font when mods have replaced the original", async () => {
        const install = "/appdata/versions/version-aaaa";
        fakeFs.seed(`${install}/AppSettings.xml`, "<Settings />");
        fakeFs.seed("/appdata/versions/index.json", JSON.stringify([{ version: "version-aaaa", path: install, active: true }]));
        fakeFs.seed(`${install}/${FONT_DIR}/BuilderIcons-Regular.ttf`, "modded");
        invokeHandlers.extract_package_files = (args) => {
            const { destDir, paths } = args as { destDir: string; paths: string[] };
            for (const p of paths) fakeFs.seed(`${destDir}/${p}`, "stock");
            return paths;
        };

        const [font] = await findBuilderIcons();

        expect(font.path).toBe(`/appdata/font-editor/stock/version-aaaa/${FONT_DIR}/BuilderIcons-Regular.ttf`);
        expect(fakeFs.text(font.path)).toBe("stock");
    });
});
