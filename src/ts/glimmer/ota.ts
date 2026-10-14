import { check } from "@crabnebula/plugin-ota-updater";
import { error, info } from "@tauri-apps/plugin-log";

/** set once an update was applied in this session, so a check that keeps finding one cannot reload the page in a loop */
const APPLIED_KEY = "glimmer-ota-applied";

interface PendingOta {
  apply(): Promise<unknown>;
}

export interface OtaDeps {
  check(): Promise<PendingOta | null>;
  reload(): void;
  applied: { get(): boolean; set(): void };
}

const plugins: OtaDeps = {
  check,
  reload: () => location.reload(),
  applied: {
    get: () => sessionStorage.getItem(APPLIED_KEY) !== null,
    set: () => sessionStorage.setItem(APPLIED_KEY, "1"),
  },
};

/**
 * Over-the-air update of the frontend (CrabNebula's ota-updater): new web assets without a new installer.
 * It needs no question, nothing native changes, so it applies and reloads this window. Other windows
 * take the new assets the next time they open. Rust changes still need a full release (see updater.ts).
 */
export async function checkForOta(deps: OtaDeps = plugins): Promise<boolean> {
  try {
    if (deps.applied.get()) return false;

    const update = await deps.check();
    if (!update) return false;

    info("a frontend update is available");
    await update.apply();
    deps.applied.set();
    deps.reload();
    return true;
  } catch (e) {
    error(`frontend update failed: ${e}`);
    return false;
  }
}
