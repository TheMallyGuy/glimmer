import { beforeEach, describe, expect, test } from "bun:test";
import { Installation, type InstallEntry } from "$ts/roblox/installation/installation";
import { fakeFs } from "./helpers/fakeFs";
import { resetTauri } from "./helpers/tauri";

const ROOT = "/appdata/versions";
const INDEX = `${ROOT}/index.json`;

/** a finished install: AppSettings.xml is written last by the downloader */
const seedInstall = (name: string) => fakeFs.seed(`${ROOT}/${name}/AppSettings.xml`, "<Settings />");
const readIndex = (): InstallEntry[] => JSON.parse(fakeFs.text(INDEX) ?? "[]");

beforeEach(() => {
    fakeFs.reset();
    resetTauri();
});

describe("Installation.create", () => {
    test("points at the versions folder in app data", async () => {
        const i = await Installation.create();
        expect(i.installationPath).toBe(ROOT);
    });

    test("keeps studio installs and their index in a separate folder", async () => {
        const studioRoot = "/appdata/studio-versions";
        seedInstall("version-player");
        fakeFs.seed(`${studioRoot}/version-studio/AppSettings.xml`, "<Settings />");

        const studio = await Installation.create(true, "studio");
        await studio.reIndex();

        expect(studio.installationPath).toBe(studioRoot);
        expect(studio.installedVersions.map((v) => v.version)).toEqual(["version-studio"]);
        expect(fakeFs.has(`${studioRoot}/index.json`)).toBe(true);
        expect(readIndex()).toEqual([]);
    });
});

describe("reIndex", () => {
    test("creates the versions folder when it is missing", async () => {
        const i = await Installation.create();
        await i.reIndex();

        expect(fakeFs.has(ROOT)).toBe(true);
        expect(readIndex()).toEqual([]);
    });

    test("indexes completed installs only", async () => {
        seedInstall("version-aaaa");
        fakeFs.seed(`${ROOT}/version-partial/RobloxPlayerBeta.exe`, "partial download");
        fakeFs.seed(`${ROOT}/stray-file.txt`, "not a folder");

        const i = await Installation.create();
        await i.reIndex();

        expect(i.installedVersions.map((v) => v.version)).toEqual(["version-aaaa"]);
        expect(i.installedVersions[0].path).toBe(`${ROOT}/version-aaaa`);
        expect(readIndex().map((v) => v.version)).toEqual(["version-aaaa"]);
    });

    test("drops index entries whose folder is gone", async () => {
        seedInstall("version-aaaa");
        fakeFs.seed(INDEX, JSON.stringify([{ version: "version-gone", path: `${ROOT}/version-gone`, active: true }]));

        const i = await Installation.create();
        await i.reIndex();

        expect(i.installedVersions.map((v) => v.version)).toEqual(["version-aaaa"]);
    });

    test("keeps the active flag from the persisted index", async () => {
        seedInstall("version-aaaa");
        seedInstall("version-bbbb");
        fakeFs.seed(
            INDEX,
            JSON.stringify([
                { version: "version-aaaa", path: "", active: false },
                { version: "version-bbbb", path: "", active: true },
            ]),
        );

        const i = await Installation.create();
        await i.reIndex();

        expect(i.getActiveVersion()?.version).toBe("version-bbbb");
    });

    test("keeps the vng flag from the persisted index", async () => {
        seedInstall("version-aaaa");
        seedInstall("version-bbbb");
        fakeFs.seed(
            INDEX,
            JSON.stringify([{ version: "version-bbbb", path: "", active: false, vng: true }]),
        );

        const i = await Installation.create();
        await i.reIndex();

        const byName = Object.fromEntries(i.installedVersions.map((v) => [v.version, v.vng]));
        expect(byName).toEqual({ "version-aaaa": undefined, "version-bbbb": true });
    });

    test("in-memory state wins over what is on disk", async () => {
        seedInstall("version-aaaa");
        seedInstall("version-bbbb");
        fakeFs.seed(INDEX, JSON.stringify([{ version: "version-aaaa", path: "", active: true }]));

        const i = await Installation.create();
        i.installedVersions = [
            { version: "version-aaaa", path: "", active: false },
            { version: "version-bbbb", path: "", active: true },
        ];
        await i.reIndex();

        expect(i.getActiveVersion()?.version).toBe("version-bbbb");
    });

    test("survives a corrupt index.json", async () => {
        seedInstall("version-aaaa");
        fakeFs.seed(INDEX, "{not json");

        const i = await Installation.create();
        await i.reIndex();

        expect(i.installedVersions.map((v) => v.version)).toEqual(["version-aaaa"]);
        expect(readIndex()).toHaveLength(1);
    });
});

describe("listInstallations", () => {
    test("re-indexes by default and returns what is on disk", async () => {
        seedInstall("version-aaaa");

        const i = await Installation.create();
        const list = await i.listInstallations();

        expect(list.map((v) => v.version)).toEqual(["version-aaaa"]);
    });

    test("reads the existing index without re-indexing when told to", async () => {
        fakeFs.seed(INDEX, JSON.stringify([{ version: "version-cached", path: "/x", active: false }]));

        const i = await Installation.create();
        const list = await i.listInstallations(false);

        expect(list.map((v) => v.version)).toEqual(["version-cached"]);
    });
});

describe("createNewInstallation", () => {
    test("makes the folder and records a placeholder entry", async () => {
        const i = await Installation.create();
        await i.createNewInstallation("version-new", true);

        expect(fakeFs.has(`${ROOT}/version-new`)).toBe(true);
        expect(readIndex()).toEqual([{ version: "version-new", path: `${ROOT}/version-new`, active: false, vng: true }]);
    });

    test("does not duplicate an existing entry", async () => {
        const i = await Installation.create();
        await i.createNewInstallation("version-new");
        await i.createNewInstallation("version-new", false, false);

        expect(i.installedVersions).toHaveLength(1);
    });

    test("the vng flag survives the re-index that ends a download", async () => {
        const i = await Installation.create();
        await i.createNewInstallation("version-new", true);

        seedInstall("version-new"); // the downloader finishing
        await i.reIndex();

        expect(i.installedVersions).toEqual([
            { version: "version-new", path: `${ROOT}/version-new`, active: false, vng: true },
        ]);
    });
});

describe("setActiveVersion", () => {
    async function twoInstalls() {
        seedInstall("version-aaaa");
        seedInstall("version-bbbb");
        const i = await Installation.create();
        await i.reIndex();
        return i;
    }

    test("activates one version and deactivates the rest", async () => {
        const i = await twoInstalls();

        await i.setActiveVersion("version-aaaa");
        await i.setActiveVersion("version-bbbb");

        expect(i.installedVersions.filter((v) => v.active).map((v) => v.version)).toEqual(["version-bbbb"]);
    });

    test("persists the choice", async () => {
        const i = await twoInstalls();
        await i.setActiveVersion("version-aaaa");

        expect(readIndex().find((v) => v.active)?.version).toBe("version-aaaa");
    });

    test("throws for an unknown version", async () => {
        const i = await twoInstalls();

        await expect(i.setActiveVersion("version-nope")).rejects.toThrow('No installed version found for "version-nope"');
    });
});

describe("getActiveVersion", () => {
    test("is undefined when nothing is active", async () => {
        const i = await Installation.create();
        expect(i.getActiveVersion()).toBeUndefined();
    });
});

describe("removeInstallation", () => {
    test("deletes the folder and drops it from the index", async () => {
        seedInstall("version-aaaa");
        seedInstall("version-bbbb");
        const i = await Installation.create();
        await i.reIndex();

        await i.removeInstallation("version-aaaa");

        expect(fakeFs.has(`${ROOT}/version-aaaa`)).toBe(false);
        expect(fakeFs.has(`${ROOT}/version-aaaa/AppSettings.xml`)).toBe(false);
        expect(fakeFs.has(`${ROOT}/version-bbbb`)).toBe(true);
        expect(readIndex().map((v) => v.version)).toEqual(["version-bbbb"]);
    });

    test("throws for an unknown version", async () => {
        const i = await Installation.create();

        await expect(i.removeInstallation("version-nope")).rejects.toThrow('No installed version found for "version-nope"');
    });
});
