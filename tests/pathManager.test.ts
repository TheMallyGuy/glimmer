import { describe, expect, test } from "bun:test";
import { PathManager } from "$ts/glimmer/pathManager";

// the test setup puts the app data folder at /appdata and the cache at /cache

describe("PathManager defaults", () => {
    const pm = new PathManager();

    test("the settings file is in the app data folder", async () => {
        expect(await pm.getConfigFile()).toBe("/appdata/config.json");
    });

    test("player and studio installs get separate folders, each with its own index", async () => {
        expect(await pm.getRobloxInstallationsDir("player")).toBe("/appdata/versions");
        expect(await pm.getRobloxInstallationsDir("studio")).toBe("/appdata/studio-versions");
        expect(await pm.getInstallationIndexFile("player")).toBe("/appdata/versions/index.json");
        expect(await pm.getInstallationIndexFile("studio")).toBe("/appdata/studio-versions/index.json");
    });

    test("mod files live in the mods folder", async () => {
        expect(await pm.getModsDir()).toBe("/appdata/mods");
        expect(await pm.getModsIndexFile()).toBe("/appdata/mods/index.json");
        expect(await pm.getAppliedModsFile()).toBe("/appdata/mods/applied.json");
        expect(await pm.getLegacyOriginalsDir()).toBe("/appdata/mods/.originals");
    });

    test("downloaded packages stay in the cache folder, not the data folder", async () => {
        expect(await pm.getPackageCacheDir()).toBe("/cache/glimmer-downloads");
        expect(await pm.getPackageCacheDir("version-aaaa")).toBe("/cache/glimmer-downloads/version-aaaa");
    });

    test("Fleasion's folder is under the local app data, not Glimmer's own folder", async () => {
        expect(await pm.getFleasionDir()).toBe("/localdata/FleasionNT");
        expect(await pm.getFleasionSettingsFile()).toBe("/localdata/FleasionNT/settings.json");
        expect(await pm.getFleasionModificationsFile()).toBe("/localdata/FleasionNT/modifications.json");
        expect(await pm.getFleasionLogFile()).toBe("/localdata/FleasionNT/logs/fleasion.log");
    });

    test("working folders and bundled files", async () => {
        expect(await pm.getBackgroundsDir()).toBe("/appdata/backgrounds");
        expect(await pm.getGameHistoryFile()).toBe("/appdata/games.json");
        expect(await pm.getSplashDir()).toBe("/appdata/splash");
        expect(await pm.getBundledResource("resources/Mods/x.rbxl")).toBe("/resources/resources/Mods/x.rbxl");
    });
});
