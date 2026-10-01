import { appDataDir, join } from "@tauri-apps/api/path";
import { copyFile, exists, mkdir, readDir, readFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { commands } from "../../bindings";
import { ModificationManager } from "./manager";

/** A BuilderIcons font found in the active Roblox install. */
export interface SourceFont {
    /** e.g. "Regular", from BuilderIcons-Regular.ttf */
    label: string;
    /** the stock copy to edit (the install's backup when mods have replaced the original) */
    path: string;
    /** where the font lives, relative to the installation root */
    rel: string[];
}

export interface IconGlyph {
    /** glyph name, the key BuildersColors uses for colors.json / icons.json */
    name: string;
    codepoint: number;
}

export interface IconEdit {
    /** one hex color is flat, two is a gradient */
    colors?: string[];
    /** artwork that replaces the icon */
    art?: { kind: "svg" | "png"; path: string };
}

export type FontEdits = Record<string, IconEdit>;

const FONT_DIR = ["ExtraContent", "LuaPackages", "Packages", "_Index", "BuilderIcons", "BuilderIcons", "Font"];
const PUA = [0xe000, 0xf8ff];

async function workDir() {
    const dir = await join(await appDataDir(), "font-editor");
    await mkdir(dir, { recursive: true });
    return dir;
}

export async function findBuilderIcons(): Promise<SourceFont[]> {
    const m = await ModificationManager.create(true, true);
    if (!m.modificationVerPath) return [];

    const dir = await join(m.modificationVerPath, ...FONT_DIR);
    if (!(await exists(dir))) return [];

    const backup = await m.backupPath();
    const found: SourceFont[] = [];
    for (const entry of await readDir(dir)) {
        if (!entry.isFile || !/^BuilderIcons-(Regular|Filled)\.ttf$/i.test(entry.name)) continue;

        const rel = [...FONT_DIR, entry.name];
        const stock = await join(backup, ...rel);
        found.push({
            label: entry.name.replace(/^BuilderIcons-/i, "").replace(/\.ttf$/i, ""),
            path: (await exists(stock)) ? stock : await join(dir, entry.name),
            rel,
        });
    }
    return found.sort((a, b) => a.label.localeCompare(b.label));
}


function tables(view: DataView) {
    const out: Record<string, { offset: number; length: number }> = {};
    const count = view.getUint16(4);
    for (let i = 0; i < count; i++) {
        const at = 12 + i * 16;
        let tag = "";
        for (let c = 0; c < 4; c++) tag += String.fromCharCode(view.getUint8(at + c));
        out[tag] = { offset: view.getUint32(at + 8), length: view.getUint32(at + 12) };
    }
    return out;
}

function readCmap(view: DataView, start: number): Map<number, number> {
    const count = view.getUint16(start + 2);
    let best: { offset: number; rank: number } | null = null;
    for (let i = 0; i < count; i++) {
        const at = start + 4 + i * 8;
        const platform = view.getUint16(at);
        const encoding = view.getUint16(at + 2);
        const offset = start + view.getUint32(at + 4);
        const format = view.getUint16(offset);
        const rank =
            format === 12 && (platform === 0 || (platform === 3 && encoding === 10))
                ? 2
                : format === 4 && (platform === 0 || (platform === 3 && encoding === 1))
                    ? 1
                    : 0;
        if (rank && (!best || rank > best.rank)) best = { offset, rank };
    }

    const map = new Map<number, number>();
    if (!best) return map;
    const o = best.offset;

    if (best.rank === 2) {
        const groups = view.getUint32(o + 12);
        for (let g = 0; g < groups; g++) {
            const at = o + 16 + g * 12;
            const first = view.getUint32(at);
            const last = view.getUint32(at + 4);
            const glyph = view.getUint32(at + 8);
            for (let cp = first; cp <= last; cp++) map.set(cp, glyph + (cp - first));
        }
        return map;
    }

    const segCount = view.getUint16(o + 6) / 2;
    const ends = o + 14;
    const starts = ends + segCount * 2 + 2;
    const deltas = starts + segCount * 2;
    const rangeOffsets = deltas + segCount * 2;

    for (let s = 0; s < segCount; s++) {
        const end = view.getUint16(ends + s * 2);
        const first = view.getUint16(starts + s * 2);
        const delta = view.getInt16(deltas + s * 2);
        const rangeOffset = view.getUint16(rangeOffsets + s * 2);
        for (let cp = first; cp <= end && cp < 0xffff; cp++) {
            let glyph: number;
            if (rangeOffset === 0) {
                glyph = (cp + delta) & 0xffff;
            } else {
                const at = rangeOffsets + s * 2 + rangeOffset + (cp - first) * 2;
                const raw = view.getUint16(at);
                glyph = raw === 0 ? 0 : (raw + delta) & 0xffff;
            }
            if (glyph) map.set(cp, glyph);
        }
    }
    return map;
}

function readGlyphNames(view: DataView, start: number, length: number): Map<number, string> {
    const names = new Map<number, string>();
    if (view.getUint32(start) !== 0x00020000) return names;

    const numGlyphs = view.getUint16(start + 32);
    const indexes: number[] = [];
    for (let i = 0; i < numGlyphs; i++) indexes.push(view.getUint16(start + 34 + i * 2));

    const strings: string[] = [];
    let at = start + 34 + numGlyphs * 2;
    while (at < start + length) {
        const len = view.getUint8(at++);
        let s = "";
        for (let c = 0; c < len; c++) s += String.fromCharCode(view.getUint8(at + c));
        strings.push(s);
        at += len;
    }

    indexes.forEach((idx, glyph) => {
        if (idx >= 258 && strings[idx - 258]) names.set(glyph, strings[idx - 258]);
    });
    return names;
}

export async function listGlyphs(fontPath: string): Promise<{ glyphs: IconGlyph[]; bytes: Uint8Array }> {
    const bytes = await readFile(fontPath);
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const t = tables(view);
    if (!t.cmap) throw new Error("This font has no character map.");

    const cmap = readCmap(view, t.cmap.offset);
    const names = t.post ? readGlyphNames(view, t.post.offset, t.post.length) : new Map<number, string>();

    const seen = new Set<string>();
    const glyphs: IconGlyph[] = [];
    for (const [codepoint, glyph] of [...cmap].sort((a, b) => a[0] - b[0])) {
        if (codepoint < PUA[0] || codepoint > PUA[1]) continue;
        const name = names.get(glyph) ?? `uni${codepoint.toString(16).toUpperCase().padStart(4, "0")}`;
        if (seen.has(name)) continue;
        seen.add(name);
        glyphs.push({ name, codepoint });
    }
    return { glyphs, bytes };
}

// ---------------------------------------------------------------- building
export const countEdits = (edits: FontEdits) => Object.keys(edits).length;

/** Runs BuildersColors over `source` with the given edits and returns the new font's path. */
export async function buildFont(source: SourceFont, edits: FontEdits): Promise<string> {
    const dir = await workDir();
    const out = await join(dir, `BuilderIcons-${source.label}.ttf`);

    const colors: Record<string, string | string[]> = {};
    const icons: Record<string, { svg: string } | { png: string }> = {};
    for (const [name, edit] of Object.entries(edits)) {
        if (edit.art) icons[name] = { [edit.art.kind]: edit.art.path } as { svg: string } | { png: string };
        else if (edit.colors?.length) colors[name] = edit.colors.length === 1 ? edit.colors[0] : edit.colors;
    }

    const args = [source.path, out];
    if (Object.keys(colors).length) {
        const file = await join(dir, "colors.json");
        await writeTextFile(file, JSON.stringify(colors, null, 2));
        args.push("--colors", file);
    }
    if (Object.keys(icons).length) {
        const file = await join(dir, "icons.json");
        await writeTextFile(file, JSON.stringify(icons, null, 2));
        args.push("--icons", file);
    }

    const result = await commands.runFontTool(args);
    if (result.status === "error") throw new Error(result.error);
    return out;
}

/** Copies a built font somewhere the person chose. */
export async function saveFont(builtPath: string, destination: string) {
    await copyFile(builtPath, destination);
}
