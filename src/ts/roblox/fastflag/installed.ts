import { flagsToObject, type Flag } from "$lib/flags";
import { Installation } from "$ts/roblox/installation/installation";
import { isAndroid } from "$ts/glimmer/android/platform";
import { AndroidFlags } from "$ts/glimmer/android/flags";
import { Shizuku } from "$ts/glimmer/android/shizuku/shizukuCom";
import { FastFlagManager } from "./flags";

export class InstalledFlagsError extends Error {
  constructor(
    readonly kind: "noInstall" | "noShizuku" | "invalid",
    message: string,
  ) {
    super(message);
  }
}

/** Android has no install folder: the flags go to a file Roblox reads, written through Shizuku */
async function androidFlags(): Promise<AndroidFlags> {
  const status = await new Shizuku().getStatus().catch(() => null);
  if (!status?.serviceAvailable || !status.permissionGranted) {
    throw new InstalledFlagsError("noShizuku", "Shizuku is not running or Glimmer is not allowed to use it");
  }
  return new AndroidFlags();
}

/** the flag manager of the version a launch would start: the active one, or the first installed */
async function activeManager(): Promise<FastFlagManager> {
  const installation = await Installation.create(false);
  try {
    await installation.listInstallations();
  } catch {
    throw new InstalledFlagsError("noInstall", "No Roblox version is installed");
  }

  const active = installation.getActiveVersion() ?? installation.installedVersions[0];
  if (!active) throw new InstalledFlagsError("noInstall", "No Roblox version is installed");

  return FastFlagManager.create(active.path);
}

/**
 * the flags in the installed Roblox's ClientAppSettings.json. A hidden flag that still has the value Glimmer
 * wrote is left out, so loading the file never turns what Glimmer adds by itself into flags of the person's.
 */
export async function readInstalledFlags(hidden: Record<string, string> = {}): Promise<Flag[]> {
  const reader = isAndroid() ? await androidFlags() : await activeManager();

  let flags: Flag[];
  try {
    flags = await reader.read();
  } catch {
    throw new InstalledFlagsError("invalid", "ClientAppSettings.json is not a flag object");
  }

  return flags.filter((f) => hidden[f.name.trim()] !== f.value);
}

/** writes the flags to the installed Roblox now, as a launch would (hidden flags first, the person's on top) */
export async function applyInstalledFlags(flags: Flag[], hidden: Record<string, string> = {}) {
  if (isAndroid()) {
    await (await androidFlags()).write({ ...hidden, ...flagsToObject(flags) });
    return;
  }
  const manager = await activeManager();
  await manager.apply(flagsToObject(flags), hidden);
}
