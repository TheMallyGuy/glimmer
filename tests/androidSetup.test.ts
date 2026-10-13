import { describe, expect, test } from "bun:test";
import {
    checkAndroidSetup,
    firstUnmetStep,
    isReady,
    parseVersionName,
    requestShizukuAccess,
    type SetupShizuku,
} from "$ts/glimmer/android/setup";

const deps = (over: Partial<SetupShizuku> = {}): SetupShizuku => ({
    getStatus: async () => ({ serviceAvailable: true, preV11: false, permissionGranted: true, shouldShowRequestRationale: false, canRequestPermission: true }),
    listPackages: async () => ["com.roblox.client", "moe.shizuku.privileged.api"],
    executeAdb: async () => ({ exitCode: 0, stdout: "  versionCode=1\n  versionName=2.650.700\n", stderr: "", durationMs: 1 }),
    requestPermission: async () => true,
    ...over,
});

describe("parseVersionName", () => {
    test("reads versionName from dumpsys output", () => {
        expect(parseVersionName("a\n    versionName=2.650.700\n b")).toBe("2.650.700");
    });

    test("is null without one", () => {
        expect(parseVersionName("nothing here")).toBeNull();
    });
});

describe("checkAndroidSetup", () => {
    test("is ready with Roblox and its version when everything works", async () => {
        const setup = await checkAndroidSetup(deps());
        expect(setup).toEqual({ shizuku: "ready", roblox: true, robloxVersion: "2.650.700" });
        expect(isReady(setup)).toBe(true);
    });

    test("says notRunning when the service is down, and does not look for Roblox", async () => {
        let listed = false;
        const setup = await checkAndroidSetup(deps({
            getStatus: async () => ({ serviceAvailable: false, preV11: false, permissionGranted: false, shouldShowRequestRationale: false, canRequestPermission: false }),
            listPackages: async () => { listed = true; return []; },
        }));
        expect(setup).toEqual({ shizuku: "notRunning", roblox: null, robloxVersion: null });
        expect(listed).toBe(false);
        expect(isReady(setup)).toBe(false);
    });

    test("says needsPermission when the service runs but Glimmer is not allowed", async () => {
        const setup = await checkAndroidSetup(deps({
            getStatus: async () => ({ serviceAvailable: true, preV11: false, permissionGranted: false, shouldShowRequestRationale: false, canRequestPermission: true }),
        }));
        expect(setup.shizuku).toBe("needsPermission");
        expect(setup.roblox).toBeNull();
    });

    test("treats a plugin failure as notRunning", async () => {
        const setup = await checkAndroidSetup(deps({ getStatus: async () => { throw new Error("no binder"); } }));
        expect(setup.shizuku).toBe("notRunning");
    });

    test("reports Roblox missing", async () => {
        const setup = await checkAndroidSetup(deps({ listPackages: async () => ["moe.shizuku.privileged.api"] }));
        expect(setup).toEqual({ shizuku: "ready", roblox: false, robloxVersion: null });
        expect(isReady(setup)).toBe(false);
    });

    test("finds the VNG Roblox too, and reads the version from that package", async () => {
        const commands: string[] = [];
        const setup = await checkAndroidSetup(deps({
            listPackages: async () => ["com.roblox.client.vnggames"],
            executeAdb: async (command: string) => {
                commands.push(command);
                return { exitCode: 0, stdout: "versionName=2.1.0", stderr: "", durationMs: 1 };
            },
        }));
        expect(setup).toEqual({ shizuku: "ready", roblox: true, robloxVersion: "2.1.0" });
        expect(commands).toEqual(["dumpsys package com.roblox.client.vnggames"]);
    });

    test("leaves Roblox unknown when listing packages fails", async () => {
        const setup = await checkAndroidSetup(deps({ listPackages: async () => { throw new Error("denied"); } }));
        expect(setup.roblox).toBeNull();
        expect(isReady(setup)).toBe(false);
    });

    test("still counts Roblox as installed when the version lookup fails", async () => {
        const setup = await checkAndroidSetup(deps({ executeAdb: async () => { throw new Error("timeout"); } }));
        expect(setup).toEqual({ shizuku: "ready", roblox: true, robloxVersion: null });
        expect(isReady(setup)).toBe(true);
    });

    test("leaves the version out when dumpsys fails", async () => {
        const setup = await checkAndroidSetup(deps({ executeAdb: async () => ({ exitCode: 1, stdout: "versionName=9", stderr: "", durationMs: 1 }) }));
        expect(setup.robloxVersion).toBeNull();
    });
});

describe("firstUnmetStep", () => {
    const at = (shizuku: "notRunning" | "needsPermission" | "ready", roblox: boolean | null) =>
        firstUnmetStep({ shizuku, roblox, robloxVersion: null });

    test("walks the steps in order", () => {
        expect(at("notRunning", null)).toBe(1);
        expect(at("needsPermission", null)).toBe(2);
        expect(at("ready", false)).toBe(3);
        expect(at("ready", null)).toBe(3);
        expect(at("ready", true)).toBe(4);
    });
});

describe("requestShizukuAccess", () => {
    test("is true when granted", async () => {
        expect(await requestShizukuAccess(deps())).toBe(true);
    });

    test("is false when refused or the request fails", async () => {
        expect(await requestShizukuAccess(deps({ requestPermission: async () => false }))).toBe(false);
        expect(await requestShizukuAccess(deps({ requestPermission: async () => { throw new Error("x"); } }))).toBe(false);
    });
});
