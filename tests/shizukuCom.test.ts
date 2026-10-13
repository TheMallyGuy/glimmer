import { beforeEach, describe, expect, mock, test } from "bun:test";

const plugin = {
    getStatus: mock(async () => ({ serviceAvailable: true, permissionGranted: true })),
    requestPermission: mock(async () => ({ requested: true, granted: true })),
    openShizuku: mock(async () => ({ opened: true })),
    runAdbCommand: mock(async (_: { command: string; timeoutMs?: number }) => ({ exitCode: 0, stdout: "ok", stderr: "", durationMs: 3 })),
    listPackages: mock(async (_?: { includeSystem?: boolean; limit?: number }) => ({ packages: ["a.b", "c.d"] })),
};
mock.module("tauri-plugin-shizuku-api", () => plugin);

const { Shizuku } = await import("$ts/glimmer/android/shizuku/shizukuCom");

beforeEach(() => {
    for (const m of Object.values(plugin)) m.mockClear();
});

describe("Shizuku", () => {
    test("requestPermission gives back whether it was granted", async () => {
        expect(await new Shizuku().requestPermission()).toBe(true);
        plugin.requestPermission.mockImplementationOnce(async () => ({ requested: true, granted: false }));
        expect(await new Shizuku().requestPermission()).toBe(false);
    });

    test("openShizuku calls the plugin once, not itself", async () => {
        await new Shizuku().openShizuku();
        expect(plugin.openShizuku).toHaveBeenCalledTimes(1);
    });

    test("executeAdb passes the command with a 15 second default timeout and returns the result", async () => {
        const result = await new Shizuku().executeAdb("id");
        expect(plugin.runAdbCommand).toHaveBeenCalledWith({ command: "id", timeoutMs: 15000 });
        expect(result.stdout).toBe("ok");
        await new Shizuku().executeAdb("id", 500);
        expect(plugin.runAdbCommand).toHaveBeenLastCalledWith({ command: "id", timeoutMs: 500 });
    });

    test("listPackages returns the package names", async () => {
        expect(await new Shizuku().listPackages({ includeSystem: false })).toEqual(["a.b", "c.d"]);
    });

    test("a plugin failure becomes an error that says what was attempted", async () => {
        plugin.runAdbCommand.mockImplementationOnce(async () => { throw "binder died"; });
        await expect(new Shizuku().executeAdb("id")).rejects.toThrow("Error when executing ADB command through Shizuku: binder died");
        plugin.getStatus.mockImplementationOnce(async () => { throw "nope"; });
        await expect(new Shizuku().getStatus()).rejects.toThrow("Error when reading Shizuku status: nope");
    });
});
