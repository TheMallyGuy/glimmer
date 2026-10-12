import { describe, expect, test } from "bun:test";
import { launchOnAndroid, type AndroidLaunchDeps } from "$ts/glimmer/android/launch";
import { ANDROID_LOGS_DIR } from "$ts/glimmer/android/shizuku/roblox";

const ready = { serviceAvailable: true, preV11: false, permissionGranted: true, shouldShowRequestRationale: false, canRequestPermission: true };

function deps(over: {
    status?: unknown;
    pkg?: string | null;
    fail?: "write" | "watch" | "logging" | "start";
} = {}) {
    const calls: string[] = [];
    const step = (name: "write" | "watch" | "logging" | "start") => async () => {
        calls.push(name);
        if (over.fail === name) throw new Error(`${name} failed`);
    };
    const d = {
        shizuku: { getStatus: async () => over.status ?? ready },
        roblox: {
            installedPackage: async () => (over.pkg === undefined ? "com.roblox.client" : over.pkg),
            startLogging: step("logging"),
            start: step("start"),
        },
        flags: { write: step("write") },
        watchLogs: async (dir: string) => {
            calls.push(`watch ${dir}`);
            if (over.fail === "watch") throw new Error("watch failed");
        },
    } as unknown as AndroidLaunchDeps;
    return { d, calls };
}

const options = { flags: null };
const watch = `watch ${ANDROID_LOGS_DIR}`;

describe("launchOnAndroid", () => {
    test("follows the log folder, starts the log, then Roblox, in that order", async () => {
        const { d, calls } = deps();
        expect(await launchOnAndroid(options, d)).toBe("started");
        expect(calls).toEqual([watch, "logging", "start"]);
    });

    test("writes the flags before anything else", async () => {
        const { d, calls } = deps();
        expect(await launchOnAndroid({ flags: { FFlagA: "True" } }, d)).toBe("started");
        expect(calls).toEqual(["write", watch, "logging", "start"]);
    });

    test("still starts when the flags cannot be written, and says so", async () => {
        const { d, calls } = deps({ fail: "write" });
        expect(await launchOnAndroid({ flags: { FFlagA: "True" } }, d)).toBe("startedNoFlags");
        expect(calls).toEqual(["write", watch, "logging", "start"]);
    });

    test("does nothing when Shizuku is not running or not allowed", async () => {
        const down = deps({ status: { ...ready, serviceAvailable: false } });
        expect(await launchOnAndroid(options, down.d)).toBe("shizukuNotReady");
        const denied = deps({ status: { ...ready, permissionGranted: false } });
        expect(await launchOnAndroid(options, denied.d)).toBe("shizukuNotReady");
        expect(down.calls).toEqual([]);
        expect(denied.calls).toEqual([]);
    });

    test("says so when Roblox is not installed", async () => {
        const { d, calls } = deps({ pkg: null });
        expect(await launchOnAndroid({ flags: { FFlagA: "True" } }, d)).toBe("notInstalled");
        expect(calls).toEqual([]);
    });

    test("fails, and does not start Roblox, when the log cannot be set up", async () => {
        for (const fail of ["watch", "logging"] as const) {
            const { d, calls } = deps({ fail });
            expect(await launchOnAndroid(options, d)).toBe("failed");
            expect(calls).not.toContain("start");
        }
    });

    test("fails when Roblox cannot be started", async () => {
        const { d } = deps({ fail: "start" });
        expect(await launchOnAndroid(options, d)).toBe("failed");
    });
});
