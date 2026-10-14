import { beforeEach, describe, expect, mock, test } from "bun:test";
import { checkForOta, type OtaDeps } from "$ts/glimmer/ota";
import { logSpies, resetTauri } from "./helpers/tauri";

const apply = mock(async () => { });
const check = mock<OtaDeps["check"]>(async () => ({ apply }));
const reload = mock(() => { });
let applied = false;
const deps = (): OtaDeps => ({ check, reload, applied: { get: () => applied, set: () => { applied = true; } } });

beforeEach(() => {
    resetTauri();
    for (const m of [apply, check, reload]) m.mockClear();
    check.mockImplementation(async () => ({ apply }));
    applied = false;
});

describe("checkForOta", () => {
    test("does nothing when the frontend is up to date", async () => {
        check.mockImplementation(async () => null);

        expect(await checkForOta(deps())).toBe(false);
        expect(apply).not.toHaveBeenCalled();
        expect(reload).not.toHaveBeenCalled();
    });

    test("applies the update, then reloads", async () => {
        expect(await checkForOta(deps())).toBe(true);

        expect(apply).toHaveBeenCalledTimes(1);
        expect(reload).toHaveBeenCalledTimes(1);
    });

    test("does not check again after an update was applied in this session", async () => {
        await checkForOta(deps());
        check.mockClear();

        expect(await checkForOta(deps())).toBe(false);
        expect(check).not.toHaveBeenCalled();
        expect(reload).toHaveBeenCalledTimes(1);
    });

    test("a failed check is logged, not thrown", async () => {
        check.mockImplementation(async () => { throw new Error("offline"); });

        expect(await checkForOta(deps())).toBe(false);
        expect(logSpies.error).toHaveBeenCalled();
    });

    test("a failed apply does not reload", async () => {
        apply.mockImplementationOnce(async () => { throw new Error("bad signature"); });

        expect(await checkForOta(deps())).toBe(false);
        expect(reload).not.toHaveBeenCalled();
        expect(applied).toBe(false);
    });
});
