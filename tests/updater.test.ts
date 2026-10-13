import { beforeEach, describe, expect, mock, test } from "bun:test";
import { checkForUpdate, type UpdaterDeps, type UpdatePrompt } from "$ts/glimmer/updater";
import { logSpies, resetTauri } from "./helpers/tauri";

const prompt = (version: string): UpdatePrompt => ({
    title: "Update available",
    body: `Glimmer ${version} is ready`,
    install: "Update",
    later: "Later",
});

const downloadAndInstall = mock(async () => { });
const relaunch = mock(async () => { });
const ask = mock<UpdaterDeps["ask"]>(async () => true);
const check = mock<UpdaterDeps["check"]>(async () => ({ version: "0.2.0", downloadAndInstall }));
const deps = (): UpdaterDeps => ({ check, ask, relaunch });

beforeEach(() => {
    resetTauri();
    for (const m of [downloadAndInstall, relaunch, ask, check]) m.mockClear();
    ask.mockImplementation(async () => true);
    check.mockImplementation(async () => ({ version: "0.2.0", downloadAndInstall }));
});

describe("checkForUpdate", () => {
    test("does nothing when Glimmer is up to date", async () => {
        check.mockImplementation(async () => null);

        expect(await checkForUpdate(prompt, deps())).toBe(false);
        expect(ask).not.toHaveBeenCalled();
        expect(relaunch).not.toHaveBeenCalled();
    });

    test("asks about the new version, then installs it and restarts", async () => {
        expect(await checkForUpdate(prompt, deps())).toBe(true);

        expect(ask).toHaveBeenCalledWith("Glimmer 0.2.0 is ready", { title: "Update available", okLabel: "Update", cancelLabel: "Later" });
        expect(downloadAndInstall).toHaveBeenCalledTimes(1);
        expect(relaunch).toHaveBeenCalledTimes(1);
    });

    test("installs nothing when the person says not now", async () => {
        ask.mockImplementation(async () => false);

        expect(await checkForUpdate(prompt, deps())).toBe(false);
        expect(downloadAndInstall).not.toHaveBeenCalled();
        expect(relaunch).not.toHaveBeenCalled();
    });

    test("a failed check is logged, not thrown", async () => {
        check.mockImplementation(async () => { throw new Error("offline"); });

        expect(await checkForUpdate(prompt, deps())).toBe(false);
        expect(logSpies.error).toHaveBeenCalled();
    });

    test("a failed install does not restart", async () => {
        downloadAndInstall.mockImplementationOnce(async () => { throw new Error("disk full"); });

        expect(await checkForUpdate(prompt, deps())).toBe(false);
        expect(relaunch).not.toHaveBeenCalled();
    });
});
