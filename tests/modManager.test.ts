import { beforeEach, describe, expect, test } from "bun:test";
import { ModificationManager } from "$ts/roblox/mod/manager";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";

const MODS = "/appdata/mods";
const INSTALL = "/appdata/versions/version-aaaa";

/** an installed, active version for the manager to resolve */
function seedActiveInstall() {
    fakeFs.seed(`${INSTALL}/AppSettings.xml`, "<Settings />");
    fakeFs.seed("/appdata/versions/index.json", JSON.stringify([{ version: "version-aaaa", path: INSTALL, active: true }]));
}

const readIndex = (): { name: string; path: string }[] => JSON.parse(fakeFs.text(`${MODS}/index.json`) ?? "[]");

beforeEach(() => {
    fakeFs.reset();
    resetTauri();
});

describe("ModificationManager.create", () => {
    test("resolves the active version", async () => {
        seedActiveInstall();

        const m = await ModificationManager.create(true, true);

        expect(m.modificationPath).toBe(MODS);
        expect(m.modificationVerPath).toBe(INSTALL);
        expect(m.activeVersionName).toBe("version-aaaa");
    });

    test("leaves the version path empty when nothing is active", async () => {
        const m = await ModificationManager.create(true, true);

        expect(m.modificationVerPath).toBe("");
        expect(m.activeVersionName).toBe("");
    });
});

describe("reIndex", () => {
    test("creates the mods folder and lists mod folders", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seedDir(`${MODS}/Cool`);
        fakeFs.seedDir(`${MODS}/Other`);

        await m.reIndex();

        expect(m.modificationPathIndex.map((e) => e.name).sort()).toEqual(["Cool", "Other"]);
        expect(readIndex()).toHaveLength(2);
    });

    test("skips hidden folders such as .originals, and loose files", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seedDir(`${MODS}/.originals`);
        fakeFs.seed(`${MODS}/applied.json`, "{}");
        fakeFs.seedDir(`${MODS}/Visible`);

        await m.reIndex();

        expect(m.modificationPathIndex.map((e) => e.name)).toEqual(["Visible"]);
    });
});

describe("newMod", () => {
    test("creates the folder and returns its path", async () => {
        const m = await ModificationManager.create(true, true);

        expect(await m.newMod("Fresh")).toBe(`${MODS}/Fresh`);
        expect(fakeFs.has(`${MODS}/Fresh`)).toBe(true);
    });

    test("refuses a name that is taken", async () => {
        const m = await ModificationManager.create(true, true);
        await m.newMod("Fresh");

        await expect(m.newMod("Fresh")).rejects.toThrow("Mod with name Fresh already exist.");
    });
});

describe("renameMod", () => {
    test("moves the folder and its contents", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seed(`${MODS}/Old/content/file.txt`, "data");

        const path = await m.renameMod("Old", "New");

        expect(path).toBe(`${MODS}/New`);
        expect(fakeFs.has(`${MODS}/Old`)).toBe(false);
        expect(fakeFs.text(`${MODS}/New/content/file.txt`)).toBe("data");
    });

    test("updates the index", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seedDir(`${MODS}/Old`);

        await m.renameMod("Old", "New");

        expect(readIndex().map((e) => e.name)).toEqual(["New"]);
    });

    test("throws when the mod does not exist", async () => {
        const m = await ModificationManager.create(true, true);

        await expect(m.renameMod("Ghost", "New")).rejects.toThrow("Mod with name Ghost doesn't exist.");
    });

    test("throws when the new name is taken", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seedDir(`${MODS}/A`);
        fakeFs.seedDir(`${MODS}/B`);

        await expect(m.renameMod("A", "B")).rejects.toThrow("Mod with name B already exist.");
        expect(fakeFs.has(`${MODS}/A`)).toBe(true);
    });
});

describe("deleteMod", () => {
    test("removes the folder and drops it from the index", async () => {
        const m = await ModificationManager.create(true, true);
        fakeFs.seed(`${MODS}/Gone/file.txt`, "x");
        fakeFs.seedDir(`${MODS}/Kept`);

        await m.deleteMod("Gone");

        expect(fakeFs.has(`${MODS}/Gone`)).toBe(false);
        expect(fakeFs.has(`${MODS}/Gone/file.txt`)).toBe(false);
        expect(readIndex().map((e) => e.name)).toEqual(["Kept"]);
    });

    test("throws when the mod does not exist", async () => {
        const m = await ModificationManager.create(true, true);

        await expect(m.deleteMod("Ghost")).rejects.toThrow("Mod with name Ghost doesn't exist.");
    });
});

describe("backupPath", () => {
    test("is scoped per version under .originals", async () => {
        seedActiveInstall();
        const m = await ModificationManager.create(true, true);

        expect(await m.backupPath()).toBe(`${MODS}/.originals/version-aaaa`);
    });
});

describe("backupCurrentVersion", () => {
    test("does nothing without an active version", async () => {
        const m = await ModificationManager.create(true, true);

        expect(await m.backupCurrentVersion()).toBe(0);
        expect(invokeCalls).toEqual([]);
    });

    test("backs the install up and returns the file count", async () => {
        seedActiveInstall();
        invokeHandlers.backup_install = () => 42;
        const m = await ModificationManager.create(true, true);

        expect(await m.backupCurrentVersion()).toBe(42);
        expect(invokeCalls).toEqual([
            { cmd: "backup_install", args: { destDir: INSTALL, backupDir: `${MODS}/.originals/version-aaaa` } },
        ]);
    });

    test("throws the command's error", async () => {
        seedActiveInstall();
        invokeHandlers.backup_install = () => {
            throw "disk full";
        };
        const m = await ModificationManager.create(true, true);

        await expect(m.backupCurrentVersion()).rejects.toThrow("disk full");
    });
});
