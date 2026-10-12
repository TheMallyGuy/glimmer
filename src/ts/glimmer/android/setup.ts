import { Shizuku } from "./shizuku/shizukuCom";

export const ROBLOX_PACKAGE = "com.roblox.client";

/** where Shizuku stands: its service is down, it waits for Glimmer's permission, or Glimmer can use it */
export type ShizukuState = "notRunning" | "needsPermission" | "ready";

export interface AndroidSetup {
  shizuku: ShizukuState;
  /** null while it can not be told, because listing packages needs Shizuku */
  roblox: boolean | null;
  robloxVersion: string | null;
}

/** the part of `Shizuku` the setup check uses, so a test can stand in for it */
export type SetupShizuku = Pick<Shizuku, "getStatus" | "listPackages" | "executeAdb" | "requestPermission">;

/** `versionName` from `dumpsys package` output */
export function parseVersionName(dump: string): string | null {
  return /versionName=(\S+)/.exec(dump)?.[1] ?? null;
}

/** the onboarding step a setup lands on: 1 start Shizuku, 2 allow Glimmer, 3 find Roblox, 4 done */
export function firstUnmetStep(setup: AndroidSetup): 1 | 2 | 3 | 4 {
  if (setup.shizuku === "notRunning") return 1;
  if (setup.shizuku === "needsPermission") return 2;
  return setup.roblox === true ? 4 : 3;
}

export function isReady(setup: AndroidSetup): boolean {
  return setup.shizuku === "ready" && setup.roblox === true;
}

export async function checkAndroidSetup(shizuku: SetupShizuku = new Shizuku()): Promise<AndroidSetup> {
  let state: ShizukuState;
  try {
    const status = await shizuku.getStatus();
    state = !status.serviceAvailable ? "notRunning" : status.permissionGranted ? "ready" : "needsPermission";
  } catch {
    state = "notRunning"; // the plugin cannot reach Shizuku at all
  }
  if (state !== "ready") return { shizuku: state, roblox: null, robloxVersion: null };

  try {
    const packages = await shizuku.listPackages({ includeSystem: false, limit: 10000 });
    if (!packages.includes(ROBLOX_PACKAGE)) return { shizuku: state, roblox: false, robloxVersion: null };
  } catch {
    return { shizuku: state, roblox: null, robloxVersion: null };
  }

  let robloxVersion: string | null = null;
  try {
    const dump = await shizuku.executeAdb(`dumpsys package ${ROBLOX_PACKAGE}`);
    if (dump.exitCode === 0) robloxVersion = parseVersionName(dump.stdout);
  } catch {
    // the version is only shown, so a failure leaves it out
  }
  return { shizuku: state, roblox: true, robloxVersion };
}

/** asks Shizuku for permission; true when it was granted, false when refused or the request failed */
export async function requestShizukuAccess(shizuku: SetupShizuku = new Shizuku()): Promise<boolean> {
  try {
    return await shizuku.requestPermission();
  } catch {
    return false;
  }
}
