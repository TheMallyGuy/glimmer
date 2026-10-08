import { beforeEach, describe, expect, test } from "bun:test";
import { restartFleasion } from "$ts/fleasion/restart";
import type { FleasionOptions } from "$ts/fleasion/apply";
import type { LaunchStatus } from "$ts/launch";
import { fakeFs } from "./helpers/fakeFs";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";

const DIR = "/localdata/FleasionNT";
const SETTINGS = `${DIR}/settings.json`;
const LOG = `${DIR}/logs/fleasion.log`;
const READY = "[23:09:23] [Info] Fleasion Proxy Active\n";
const FAST = { timeoutMs: 60, pollMs: 5 };

const options: FleasionOptions = { mirrorGlimmerFF: false, verify: true, gameCreator: false, name: "" };

let steps: string[];
let reported: LaunchStatus[];
const report = (status: LaunchStatus) => void reported.push(status);
const settings = () => JSON.parse(fakeFs.text(SETTINGS)!);

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    fakeFs.seedDir(DIR);
    fakeFs.seed(SETTINGS, '{"theme":"System","username_spoofer":{"self_verified":false}}');
    fakeFs.seed(LOG, "[21:09:23] [Info] Fleasion Proxy Active\n[21:10:00] [Cache] something\n");
    steps = [];
    reported = [];

    invokeHandlers.fleasion_stop = () => void steps.push("stop");
    invokeHandlers.fleasion_start = () => {
        // what Fleasion does: it starts from the settings file, and says so in its log once it is ready
        steps.push(`start with verified=${settings().username_spoofer.self_verified}`);
        fakeFs.seed(LOG, fakeFs.text(LOG)! + READY);
    };
});

describe("restartFleasion", () => {
    test("closes Fleasion, writes the settings while it is down, and opens it again", async () => {
        await restartFleasion(options, {}, report, FAST);

        expect(steps).toEqual(["stop", "start with verified=true"]);
    });

    test("tells the launch what it is doing", async () => {
        await restartFleasion(options, {}, report, FAST);

        expect(reported).toEqual([{ step: "stoppingFleasion" }, { step: "startingFleasion" }]);
    });

    test("waits until Fleasion says it is ready again, not for a ready line of an earlier run", async () => {
        let polls = 0;
        invokeHandlers.fleasion_start = () => {
            steps.push("start");
            // ready only a little later, as a real start is
            const timer = setInterval(() => {
                if (++polls >= 3) {
                    clearInterval(timer);
                    fakeFs.seed(LOG, fakeFs.text(LOG)! + READY);
                }
            }, 5);
        };

        await restartFleasion(options, {}, report, { timeoutMs: 500, pollMs: 5 });

        expect(polls).toBeGreaterThanOrEqual(3);
        expect(fakeFs.text(LOG)!.split("Fleasion Proxy Active").length - 1).toBe(2);
    });

    test("works when Fleasion has no log yet", async () => {
        fakeFs.reset();
        fakeFs.seed(SETTINGS, '{"username_spoofer":{}}');
        invokeHandlers.fleasion_start = () => void fakeFs.seed(LOG, READY);

        await restartFleasion(options, {}, report, FAST);

        expect(settings().username_spoofer.self_verified).toBe(true);
    });

    test("fails when Fleasion never says it is ready", async () => {
        invokeHandlers.fleasion_start = () => void steps.push("start");

        await expect(restartFleasion(options, {}, report, FAST)).rejects.toThrow("Fleasion did not finish starting");
    });

    test("when Fleasion can't be closed, the settings are still written and it is not started again", async () => {
        invokeHandlers.fleasion_stop = () => {
            throw "The administrator prompt was declined";
        };

        await expect(restartFleasion(options, {}, report, FAST)).rejects.toThrow("The administrator prompt was declined");

        expect(settings().username_spoofer.self_verified).toBe(true);
        expect(invokeCalls.some((c) => c.cmd === "fleasion_start")).toBe(false);
    });

    test("fails with what Windows said when Fleasion can't be opened", async () => {
        invokeHandlers.fleasion_start = () => {
            throw "Fleasion has no Start menu shortcut yet";
        };

        await expect(restartFleasion(options, {}, report, FAST)).rejects.toThrow("Fleasion has no Start menu shortcut yet");
    });

    test("does not open Fleasion when it has no settings file", async () => {
        fakeFs.reset();
        fakeFs.seedDir(DIR);

        await expect(restartFleasion(options, {}, report, FAST)).rejects.toMatchObject({ kind: "missing" });

        expect(invokeCalls.some((c) => c.cmd === "fleasion_start")).toBe(false);
    });

    describe("where Fleasion is opened from", () => {
        const startedFrom = () => invokeCalls.find((c) => c.cmd === "fleasion_start")?.args;

        test("is the saved path", async () => {
            await restartFleasion(options, {}, report, { ...FAST, path: "/apps/Fleasion-v2.4.0" });

            expect(startedFrom()).toEqual({ path: "/apps/Fleasion-v2.4.0" });
        });

        test("is nothing when there is no saved path and Fleasion was not seen, which leaves it to the system", async () => {
            await restartFleasion(options, {}, report, { ...FAST, path: "" });

            expect(startedFrom()).toEqual({ path: null });
        });

        test("is where Fleasion was seen running, which is kept for the next launch", async () => {
            invokeHandlers.fleasion_stop = () => "/apps/Fleasion-v2.5.0";
            const kept: string[] = [];

            await restartFleasion(options, {}, report, { ...FAST, path: "/apps/Fleasion-v2.4.0", onPathFound: (p) => void kept.push(p) });

            expect(startedFrom()).toEqual({ path: "/apps/Fleasion-v2.5.0" });
            expect(kept).toEqual(["/apps/Fleasion-v2.5.0"]);
        });

        test("is not kept again when it is the saved one", async () => {
            invokeHandlers.fleasion_stop = () => "/apps/Fleasion-v2.4.0";
            const kept: string[] = [];

            await restartFleasion(options, {}, report, { ...FAST, path: "/apps/Fleasion-v2.4.0", onPathFound: (p) => void kept.push(p) });

            expect(kept).toEqual([]);
        });

        test("is kept even when Fleasion then can't be opened", async () => {
            invokeHandlers.fleasion_stop = () => "/apps/Fleasion-v2.4.0";
            invokeHandlers.fleasion_start = () => {
                throw "declined";
            };
            const kept: string[] = [];

            await expect(restartFleasion(options, {}, report, { ...FAST, onPathFound: (p) => void kept.push(p) })).rejects.toThrow("declined");

            expect(kept).toEqual(["/apps/Fleasion-v2.4.0"]);
        });
    });

    test("mirrors the flags it is given", async () => {
        await restartFleasion({ ...options, mirrorGlimmerFF: true }, { FFlagX: "True" }, report, FAST);

        expect(settings()).toMatchObject({ custom_fflags_enabled: true, custom_fflags: { FFlagX: "True" } });
    });
});
