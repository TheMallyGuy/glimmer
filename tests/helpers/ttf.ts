/**
 * Builds the smallest TrueType files that `listGlyphs` can read: a table directory plus
 * a `cmap` (format 4 or 12) and an optional `post` (format 2) table. Not valid fonts, just valid enough.
 */

class Writer {
    private bytes: number[] = [];

    u8(v: number) {
        this.bytes.push(v & 0xff);
        return this;
    }
    u16(v: number) {
        return this.u8(v >> 8).u8(v);
    }
    u32(v: number) {
        return this.u16(v >>> 16).u16(v);
    }
    raw(data: ArrayLike<number>) {
        for (let i = 0; i < data.length; i++) this.bytes.push(data[i]);
        return this;
    }
    get length() {
        return this.bytes.length;
    }
    done() {
        return Uint8Array.from(this.bytes);
    }
}

/** a run of codepoints: `glyph` is the glyph of `first`, the rest follow in order */
export interface Run {
    first: number;
    last: number;
    glyph: number;
}

/** format 12 subtable: one group per run */
export function cmapFormat12(runs: Run[]): Uint8Array {
    const w = new Writer().u16(12).u16(0).u32(16 + runs.length * 12).u32(0).u32(runs.length);
    for (const r of runs) w.u32(r.first).u32(r.last).u32(r.glyph);
    return w.done();
}

/**
 * format 4 subtable. A run with `glyphIds` is looked up through the glyphIdArray (idRangeOffset path),
 * any other run uses idDelta. The terminating 0xFFFF segment is added for you.
 */
export function cmapFormat4(runs: (Omit<Run, "glyph"> & { glyph?: number; glyphIds?: number[] })[]): Uint8Array {
    const segs = [...runs, { first: 0xffff, last: 0xffff, glyph: 0 }];
    const segCount = segs.length;

    const array: number[] = [];
    const rangeOffsets: number[] = [];
    segs.forEach((s, i) => {
        if ("glyphIds" in s && s.glyphIds) {
            rangeOffsets.push((segCount - i) * 2 + array.length * 2);
            array.push(...s.glyphIds);
        } else {
            rangeOffsets.push(0);
        }
    });

    const w = new Writer().u16(4).u16(16 + segCount * 8 + array.length * 2).u16(0).u16(segCount * 2).u16(0).u16(0).u16(0);
    for (const s of segs) w.u16(s.last);
    w.u16(0); // reservedPad
    for (const s of segs) w.u16(s.first);
    for (const s of segs) w.u16(("glyphIds" in s && s.glyphIds ? 0 : (s.glyph ?? 0) - s.first) & 0xffff);
    for (const o of rangeOffsets) w.u16(o);
    for (const g of array) w.u16(g);
    return w.done();
}

/** cmap table holding the given subtables, each as `[platformId, encodingId, subtable]` */
export function cmapTable(subtables: [platform: number, encoding: number, data: Uint8Array][]): Uint8Array {
    const w = new Writer().u16(0).u16(subtables.length);
    let offset = 4 + subtables.length * 8;
    for (const [platform, encoding, data] of subtables) {
        w.u16(platform).u16(encoding).u32(offset);
        offset += data.length;
    }
    for (const [, , data] of subtables) w.raw(data);
    return w.done();
}

/** post table version 2.0; `names[glyphId]` is the glyph's custom name, if it has one */
export function postTable(names: (string | undefined)[], version = 0x00020000): Uint8Array {
    const w = new Writer().u32(version);
    for (let i = 0; i < 28; i++) w.u8(0); // italicAngle .. maxMemType1
    w.u16(names.length);

    const strings: string[] = [];
    for (const name of names) {
        if (name === undefined) {
            w.u16(0); // a standard Mac glyph name
        } else {
            w.u16(258 + strings.length);
            strings.push(name);
        }
    }
    for (const s of strings) {
        w.u8(s.length);
        for (const ch of s) w.u8(ch.charCodeAt(0));
    }
    return w.done();
}

/** sfnt wrapper with a table directory pointing at the given tables */
export function sfnt(tables: Record<string, Uint8Array>): Uint8Array {
    const tags = Object.keys(tables);
    const w = new Writer().u32(0x00010000).u16(tags.length).u16(0).u16(0).u16(0);

    let offset = 12 + tags.length * 16;
    for (const tag of tags) {
        for (const ch of tag.padEnd(4, " ")) w.u8(ch.charCodeAt(0));
        w.u32(0).u32(offset).u32(tables[tag].length);
        offset += tables[tag].length;
    }
    for (const tag of tags) w.raw(tables[tag]);
    return w.done();
}
