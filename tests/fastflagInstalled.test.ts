import { beforeEach, describe, expect, test } from "bun:test";
import { InstalledFlagsError, applyInstalledFlags, readInstalledFlags } from "$ts/roblox/fastflag/installed";
import { newFlag } from "$lib/flags";
import { fakeFs } from "./helpers/fakeFs";
import { resetTauri } from "./helpers/tauri";

const ROOT = "/appdata/versions";
const ACTIVE = `${ROOT}/version-active/ClientSettings/ClientAppSettings.json`;
const OTHER = `${ROOT}/version-other/ClientSettings/ClientAppSettings.json`;

const seedIndex = (entries: { version: string; active: boolean }[]) =>
    fakeFs.seed(`${ROOT}/index.json`, JSON.stringify(entries.map((e) => ({ ...e, path: `${ROOT}/${e.version}` }))));

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    seedIndex([
        { version: "version-other", active: false },
        { version: "version-active", active: true },
    ]);
});

describe("applyInstalledFlags", () => {
    test("writes to the active version, with the hidden flags under the person's", async () => {
        await applyInstalledFlags([newFlag("FFlagA", "True")], { FFlagA: "False", FFlagH: "True" });

        expect(JSON.parse(fakeFs.text(ACTIVE)!)).toEqual({ FFlagA: "True", FFlagH: "True" });
        expect(fakeFs.has(OTHER)).toBe(false);
    });

    test("falls back to the first version when none is active", async () => {
        seedIndex([{ version: "version-other", active: false }]);

        await applyInstalledFlags([newFlag("FFlagA", "True")]);

        expect(JSON.parse(fakeFs.text(OTHER)!)).toEqual({ FFlagA: "True" });
    });

    test("says there is no install when nothing is installed", async () => {
        seedIndex([]);

        await expect(applyInstalledFlags([])).rejects.toMatchObject({ kind: "noInstall" });
    });

    test("says there is no install when the index is missing", async () => {
        fakeFs.reset();

        const failure = await applyInstalledFlags([]).catch((e) => e);

        expect(failure).toBeInstanceOf(InstalledFlagsError);
        expect(failure.kind).toBe("noInstall");
    });
});

describe("readInstalledFlags", () => {
    test("reads the flags of the active version", async () => {
        fakeFs.seed(ACTIVE, '{"FFlagA":"True","FIntB":"7"}');

        expect((await readInstalledFlags()).map(({ name, value }) => [name, value])).toEqual([
            ["FFlagA", "True"],
            ["FIntB", "7"],
        ]);
    });

    test("leaves out a hidden flag that still has the value Glimmer wrote, and keeps one the person changed", async () => {
        fakeFs.seed(ACTIVE, '{"FFlagHidden":"True","FFlagMine":"True","FFlagChanged":"False"}');

        const flags = await readInstalledFlags({ FFlagHidden: "True", FFlagChanged: "True" });

        expect(flags.map((f) => f.name)).toEqual(["FFlagMine", "FFlagChanged"]);
    });

    test("gives no flags when the version has none", async () => {
        expect(await readInstalledFlags()).toEqual([]);
    });

    test("says the file is invalid when it is not a flag object", async () => {
        fakeFs.seed(ACTIVE, "{ nope");

        await expect(readInstalledFlags()).rejects.toMatchObject({ kind: "invalid" });
    });

    test("says there is no install when nothing is installed", async () => {
        seedIndex([]);

        await expect(readInstalledFlags()).rejects.toMatchObject({ kind: "noInstall" });
    });
});
