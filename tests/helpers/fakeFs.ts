/** In-memory stand-in for `@tauri-apps/plugin-fs`. Paths are "/" separated, as produced by the `join` mock. */

export interface FakeDirEntry {
    name: string;
    isDirectory: boolean;
    isFile: boolean;
    isSymlink: boolean;
}

const files = new Map<string, Uint8Array>();
const dirs = new Set<string>();

const norm = (p: string) => p.replace(/\\/g, "/").replace(/\/+$/, "");
const parentOf = (p: string) => p.slice(0, Math.max(p.lastIndexOf("/"), 0));

function ensureParents(path: string) {
    for (let p = parentOf(path); p; p = parentOf(p)) dirs.add(p);
}

export const fakeFs = {
    reset() {
        files.clear();
        dirs.clear();
    },

    /** seed a text or binary file, creating its parent folders */
    seed(path: string, content: string | Uint8Array = "") {
        const p = norm(path);
        ensureParents(p);
        files.set(p, typeof content === "string" ? new TextEncoder().encode(content) : content);
    },

    seedDir(path: string) {
        const p = norm(path);
        ensureParents(p);
        dirs.add(p);
    },

    text(path: string): string | undefined {
        const bytes = files.get(norm(path));
        return bytes && new TextDecoder().decode(bytes);
    },

    has(path: string) {
        const p = norm(path);
        return files.has(p) || dirs.has(p);
    },
};

export const fsModule = {
    async exists(path: string) {
        return fakeFs.has(path);
    },

    async mkdir(path: string, _opts?: { recursive?: boolean }) {
        fakeFs.seedDir(path);
    },

    async readDir(path: string): Promise<FakeDirEntry[]> {
        const p = norm(path);
        if (!dirs.has(p)) throw new Error(`no such directory: ${path}`);

        const out = new Map<string, FakeDirEntry>();
        const visit = (full: string, isDirectory: boolean) => {
            if (parentOf(full) !== p) return;
            const name = full.slice(p.length + 1);
            out.set(name, { name, isDirectory, isFile: !isDirectory, isSymlink: false });
        };
        for (const d of dirs) visit(d, true);
        for (const f of files.keys()) visit(f, false);
        return [...out.values()];
    },

    async readFile(path: string) {
        const bytes = files.get(norm(path));
        if (!bytes) throw new Error(`no such file: ${path}`);
        return bytes;
    },

    async readTextFile(path: string) {
        return new TextDecoder().decode(await fsModule.readFile(path));
    },

    async writeFile(path: string, data: Uint8Array) {
        fakeFs.seed(path, data);
    },

    async writeTextFile(path: string, data: string) {
        fakeFs.seed(path, data);
    },

    async copyFile(from: string, to: string) {
        fakeFs.seed(to, await fsModule.readFile(from));
    },

    async rename(from: string, to: string) {
        const a = norm(from);
        const b = norm(to);
        if (!fakeFs.has(a)) throw new Error(`no such path: ${from}`);

        for (const [f, bytes] of [...files]) {
            if (f === a || f.startsWith(a + "/")) {
                files.delete(f);
                fakeFs.seed(b + f.slice(a.length), bytes);
            }
        }
        for (const d of [...dirs]) {
            if (d === a || d.startsWith(a + "/")) {
                dirs.delete(d);
                fakeFs.seedDir(b + d.slice(a.length));
            }
        }
    },

    async remove(path: string, _opts?: { recursive?: boolean }) {
        const p = norm(path);
        files.delete(p);
        dirs.delete(p);
        for (const f of [...files.keys()]) if (f.startsWith(p + "/")) files.delete(f);
        for (const d of [...dirs]) if (d.startsWith(p + "/")) dirs.delete(d);
    },
};
