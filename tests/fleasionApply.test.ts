import { beforeEach, describe, expect, test } from "bun:test";
import { FleasionConfig, FleasionConfigError, applyFleasionSettings, type FleasionOptions } from "$ts/fleasion/apply";
import { fakeFs } from "./helpers/fakeFs";
import { resetTauri } from "./helpers/tauri";

const DIR = "/localdata/FleasionNT";
const SETTINGS = `${DIR}/settings.json`;
const MODIFICATIONS = `${DIR}/modifications.json`;

const SETTINGS_TEXT = JSON.stringify({
    theme: "System",
    custom_fflags: { DFIntFoo: 1 },
    upstream_socks5_password: "hunter2",
    username_spoofer: { self_verified: false, self_name: "x" },
});

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    fakeFs.seedDir(DIR);
});

describe("FleasionConfig.isInstalled", () => {
    test("is false until Fleasion has made its settings file", async () => {
        expect(await new FleasionConfig().isInstalled()).toBe(false);

        fakeFs.seed(SETTINGS, SETTINGS_TEXT);

        expect(await new FleasionConfig().isInstalled()).toBe(true);
    });
});

describe("FleasionConfig.read", () => {
    test("parses the file", async () => {
        fakeFs.seed(MODIFICATIONS, '{"entries":[],"global_settings":{"framerate_cap":240}}');

        expect(await new FleasionConfig().read("modifications")).toEqual({ entries: [], global_settings: { framerate_cap: 240 } });
    });

    test("a missing file is told as missing, with the file it was", async () => {
        const failure = await new FleasionConfig().read("settings").catch((e) => e);

        expect(failure).toBeInstanceOf(FleasionConfigError);
        expect(failure).toMatchObject({ kind: "missing", file: "settings" });
    });

    test.each(["{ not json", "[]", "null", "12", '"text"'])("%p is told as invalid", async (text) => {
        fakeFs.seed(SETTINGS, text);

        await expect(new FleasionConfig().read("settings")).rejects.toMatchObject({ kind: "invalid", file: "settings" });
    });

    test("the error never carries the content of the file", async () => {
        fakeFs.seed(SETTINGS, '{"upstream_socks5_password":"hunter2" nope');

        const failure = await new FleasionConfig().read("settings").catch((e) => e);

        expect(String(failure.message)).not.toContain("hunter2");
        expect(failure.cause).toBeUndefined();
    });
});

describe("FleasionConfig.edit", () => {
    test("changes the asked key and keeps every other one, nested keys included", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);

        await new FleasionConfig().edit("settings", (json) => {
            json.username_spoofer.self_verified = true;
        });

        expect(JSON.parse(fakeFs.text(SETTINGS)!)).toEqual({
            theme: "System",
            custom_fflags: { DFIntFoo: 1 },
            upstream_socks5_password: "hunter2",
            username_spoofer: { self_verified: true, self_name: "x" },
        });
    });

    test("writes compact JSON, as Fleasion does", async () => {
        fakeFs.seed(MODIFICATIONS, '{\n  "entries": []\n}');

        await new FleasionConfig().edit("modifications", (json) => {
            json.fast_flags_enabled = true;
        });

        expect(fakeFs.text(MODIFICATIONS)).toBe('{"entries":[],"fast_flags_enabled":true}');
    });

    test("settings and modifications are separate files", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);
        fakeFs.seed(MODIFICATIONS, '{"entries":[]}');

        await new FleasionConfig().edit("modifications", (json) => {
            json.entries.push("x");
        });

        expect(fakeFs.text(SETTINGS)).toBe(SETTINGS_TEXT);
        expect(JSON.parse(fakeFs.text(MODIFICATIONS)!)).toEqual({ entries: ["x"] });
    });

    test("the first edit keeps the file as it was, and later edits leave that copy alone", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);
        const config = new FleasionConfig();

        await config.edit("settings", (json) => void (json.theme = "Dark"));
        await config.edit("settings", (json) => void (json.theme = "Light"));

        expect(fakeFs.text(`${SETTINGS}.glimmer-backup`)).toBe(SETTINGS_TEXT);
        expect(JSON.parse(fakeFs.text(SETTINGS)!).theme).toBe("Light");
    });

    test("writes nothing, and makes no backup, when the change throws", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);

        await expect(
            new FleasionConfig().edit("settings", (json) => {
                json.theme = "Dark";
                throw new Error("nope");
            }),
        ).rejects.toThrow("nope");

        expect(fakeFs.text(SETTINGS)).toBe(SETTINGS_TEXT);
        expect(fakeFs.has(`${SETTINGS}.glimmer-backup`)).toBe(false);
    });

    test("leaves a file that can't be read as it is", async () => {
        fakeFs.seed(SETTINGS, "{ not json");

        await expect(new FleasionConfig().edit("settings", () => { })).rejects.toBeInstanceOf(FleasionConfigError);

        expect(fakeFs.text(SETTINGS)).toBe("{ not json");
        expect(fakeFs.has(`${SETTINGS}.glimmer-backup`)).toBe(false);
    });

    test("does not make a file Fleasion has not made", async () => {
        await expect(new FleasionConfig().edit("settings", () => { })).rejects.toMatchObject({ kind: "missing" });

        expect(fakeFs.has(SETTINGS)).toBe(false);
    });
});

describe("applyFleasionSettings", () => {
    const off: FleasionOptions = { mirrorGlimmerFF: false, verify: false, gameCreator: false };
    const applied = () => JSON.parse(fakeFs.text(SETTINGS)!);

    test("writes the verified and game creator options to the username spoofer, on and off", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);

        await applyFleasionSettings({ ...off, verify: true, gameCreator: true }, {});
        expect(applied().username_spoofer).toMatchObject({ self_verified: true, self_game_creator: true, self_name: "x" });

        await applyFleasionSettings(off, {});
        expect(applied().username_spoofer).toMatchObject({ self_verified: false, self_game_creator: false, self_name: "x" });
    });

    test("applies the spoofer in game while either option is on, and leaves that alone when both are off", async () => {
        fakeFs.seed(SETTINGS, JSON.stringify({ username_spoofer: { self_apply_ingame: false } }));

        await applyFleasionSettings(off, {});
        expect(applied().username_spoofer.self_apply_ingame).toBe(false);

        await applyFleasionSettings({ ...off, gameCreator: true }, {});
        expect(applied().username_spoofer.self_apply_ingame).toBe(true);
    });

    test("makes the username spoofer when Fleasion has none", async () => {
        fakeFs.seed(SETTINGS, '{"theme":"System"}');

        await applyFleasionSettings({ ...off, verify: true }, {});

        expect(applied()).toEqual({
            theme: "System",
            username_spoofer: { self_verified: true, self_game_creator: false, self_apply_ingame: true },
        });
    });

    test("mirroring replaces Fleasion's custom flags with Glimmer's and turns them on", async () => {
        fakeFs.seed(SETTINGS, JSON.stringify({ custom_fflags_enabled: false, custom_fflags: { Old: "1" } }));

        await applyFleasionSettings({ ...off, mirrorGlimmerFF: true }, { FFlagNew: "True", DFIntX: "5" });

        expect(applied()).toMatchObject({ custom_fflags_enabled: true, custom_fflags: { FFlagNew: "True", DFIntX: "5" } });
        expect(applied().custom_fflags.Old).toBeUndefined();
    });

    test("mirroring with no Glimmer flags leaves Fleasion's own custom flags alone", async () => {
        fakeFs.seed(SETTINGS, JSON.stringify({ custom_fflags_enabled: false, custom_fflags: { Old: "1" } }));

        await applyFleasionSettings({ ...off, mirrorGlimmerFF: true }, {});

        expect(applied()).toMatchObject({ custom_fflags_enabled: false, custom_fflags: { Old: "1" } });
    });

    test("without mirroring, Fleasion's own custom flags stay", async () => {
        fakeFs.seed(SETTINGS, JSON.stringify({ custom_fflags_enabled: false, custom_fflags: { Old: "1" } }));

        await applyFleasionSettings(off, { FFlagNew: "True" });

        expect(applied()).toMatchObject({ custom_fflags_enabled: false, custom_fflags: { Old: "1" } });
    });

    test("never answers Fleasion's own custom flags warning", async () => {
        fakeFs.seed(SETTINGS, '{"custom_fflags_warning_accepted":false}');

        await applyFleasionSettings({ mirrorGlimmerFF: true, verify: true, gameCreator: true }, { A: "1" });

        expect(applied().custom_fflags_warning_accepted).toBe(false);
    });

    test("keeps every key it doesn't know", async () => {
        fakeFs.seed(SETTINGS, SETTINGS_TEXT);

        await applyFleasionSettings({ mirrorGlimmerFF: true, verify: true, gameCreator: false }, { A: "1" });

        expect(applied()).toMatchObject({ theme: "System", upstream_socks5_password: "hunter2" });
    });

    test("fails as missing when Fleasion has no settings file, and makes none", async () => {
        await expect(applyFleasionSettings(off, {})).rejects.toMatchObject({ kind: "missing", file: "settings" });

        expect(fakeFs.has(SETTINGS)).toBe(false);
    });
});
