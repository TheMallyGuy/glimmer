import { commands } from "$ts/glimmer/bindings";
import { AndroidFlags } from "./flags";
import { ANDROID_LOGS_DIR, AndroidRoblox } from "./shizuku/roblox";
import { Shizuku } from "./shizuku/shizukuCom";

/** how a launch on Android ended; the names are keys of the `androidLaunch` dictionary */
export type AndroidLaunchResult =
  | "started"
  | "startedNoFlags"
  | "shizukuNotReady"
  | "notInstalled"
  | "failed";

export interface AndroidLaunchOptions {
  /** the Fast Flags to write first, none to leave Roblox's alone */
  flags: Record<string, string> | null;
}

export interface AndroidLaunchDeps {
  shizuku: Pick<Shizuku, "getStatus">;
  roblox: Pick<AndroidRoblox, "installedPackage" | "startLogging" | "start">;
  flags: Pick<AndroidFlags, "write">;
  /** has the log watcher follow the folder (a no-op when it already does) */
  watchLogs: (dir: string) => Promise<unknown>;
}

function realDeps(): AndroidLaunchDeps {
  const shizuku = new Shizuku();
  return {
    shizuku,
    roblox: new AndroidRoblox(shizuku),
    flags: new AndroidFlags(shizuku),
    watchLogs: (dir) => commands.watchLatestLog(dir),
  };
}

export async function launchOnAndroid(
  options: AndroidLaunchOptions,
  deps: AndroidLaunchDeps = realDeps(),
): Promise<AndroidLaunchResult> {
  const status = await deps.shizuku.getStatus().catch(() => null);
  if (!status?.serviceAvailable || !status.permissionGranted) return "shizukuNotReady";

  let pkg: string | null;
  try {
    pkg = await deps.roblox.installedPackage();
  } catch {
    return "failed";
  }
  if (!pkg) return "notInstalled";

  let flagsWritten = true;
  if (options.flags) {
    try {
      await deps.flags.write(options.flags);
    } catch {
      flagsWritten = false;
    }
  }

  try {
    // the watcher first: a log file that is already there when it starts counts as history and is not read
    await deps.watchLogs(ANDROID_LOGS_DIR);
    await deps.roblox.startLogging();
    await deps.roblox.start(pkg);
  } catch {
    return "failed";
  }

  return flagsWritten ? "started" : "startedNoFlags";
}
