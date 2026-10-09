import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readTextFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { parseFlagsJson, type Flag } from "$lib/flags";

export class FastFlagManager {
  versionPath = "";
  clientSettingsDir = "";
  clientAppSettingsPath = "";

  constructor(versionPath: string) {
    this.versionPath = versionPath;
  }

  static async create(versionPath: string): Promise<FastFlagManager> {
    const ffm = new FastFlagManager(versionPath);
    ffm.clientSettingsDir = await join(versionPath, "ClientSettings");
    ffm.clientAppSettingsPath = await join(
      ffm.clientSettingsDir,
      "ClientAppSettings.json",
    );

    return ffm;
  }

  async apply(flags: Record<string, string>, hiddenFlags: Record<string, string>) {
    if (!(await exists(this.clientSettingsDir))) {
      await mkdir(this.clientSettingsDir, { recursive: true });
    }

    const merged: Record<string, string> = { ...hiddenFlags, ...flags }; // overwrites flags user stuff thing 

    await writeFile(
      this.clientAppSettingsPath,
      new TextEncoder().encode(JSON.stringify(merged)),
    );
  }

  /** the flags in ClientAppSettings.json, none when the file is not there. Throws when it is not a flag object. */
  async read(): Promise<Flag[]> {
    if (!(await exists(this.clientAppSettingsPath))) return [];
    return parseFlagsJson(await readTextFile(this.clientAppSettingsPath));
  }

  async disableFlags() {
    if (await exists(this.clientAppSettingsPath)) {
      await remove(this.clientAppSettingsPath);
    }
  }
}
