import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/glimmer/pathManager";
import { Installation } from "../installation/installation";
import { debug, info, warn } from "@tauri-apps/plugin-log";
import {
  exists,
  mkdir,
  readDir,
  remove,
  rename,
  writeFile,
} from "@tauri-apps/plugin-fs";

interface ModEntry {
  name: string;
  path: string;
  active: boolean;
}

export class ModificationManager {
  modificationPath = "";
  modificationVerPath = "";
  activeVersionName = "";
  modificationPathIndexPath = "";
  modificationPathIndex: ModEntry[] = [];
  reIndexVar = false;
  refreshActiveVersionVar = false;

  private installation!: Installation;

  constructor(reIndexVar: boolean, refreshActiveVersionVar: boolean) {}

  static async create(
    reIndex = true,
    refreshActiveVersionVar: boolean,
  ): Promise<ModificationManager> {
    const m = new ModificationManager(reIndex, refreshActiveVersionVar);
    m.installation = await Installation.create();
    m.reIndexVar = await reIndex;

    const pm = new PathManager();
    m.modificationPath = await pm.getModsDir();
    m.modificationPathIndexPath = await pm.getModsIndexFile();

    await m.refreshActiveVersion();

    return m;
  }

  async newMod(name: string): Promise<string> {
    await this.reIndex();

    const isExist = await exists(await join(this.modificationPath, name));

    if (isExist) {
      throw new Error(`Mod with name ${name} already exist.`);
    }

    const path = await join(this.modificationPath, name);

    await mkdir(path);

    return path;
  }

  async renameMod(oldName: string, newName: string): Promise<string> {
    await this.reIndex();

    const oldPath = await join(this.modificationPath, oldName);
    const isOldExist = await exists(oldPath);

    if (!isOldExist) {
      throw new Error(`Mod with name ${oldName} doesn't exist.`);
    }

    const newPath = await join(this.modificationPath, newName);
    const isNewExist = await exists(newPath);

    if (isNewExist) {
      throw new Error(`Mod with name ${newName} already exist.`);
    }

    await rename(oldPath, newPath);

    const entry = this.modificationPathIndex.find((m) => m.name === oldName);
    if (entry) {
      entry.name = newName;
      entry.path = newPath;
    }
    await this.writeIndex();

    info(`renamed mod ${oldName} to ${newName}`);

    return newPath;
  }

  async deleteMod(name: string): Promise<void> {
    await this.reIndex();

    const path = await join(this.modificationPath, name);
    const isExist = await exists(path);

    if (!isExist) {
      throw new Error(`Mod with name ${name} doesn't exist.`);
    }

    await remove(path, { recursive: true });

    this.modificationPathIndex = this.modificationPathIndex.filter(
      (m) => m.name !== name,
    );
    await this.writeIndex();

    info(`deleted mod ${name}`);
  }

  async reIndex() {
    info("reindexing installations");
    const isExists = await exists(this.modificationPath);
    if (!isExists) {
      info("version folder doesnt exist, creating one");
      await mkdir(this.modificationPath, { recursive: true });
    }

    const mods = await readDir(this.modificationPath);
    const previousActive = this.modificationPathIndex.find(
      (v) => v.active,
    )?.name;

    this.modificationPathIndex = [];

    for (const mod of mods) {
      if (!mod.isDirectory || mod.name.startsWith(".")) continue;
      debug(`found ${mod.name}`);
      this.modificationPathIndex.push({
        name: mod.name,
        path: await join(this.modificationPath, mod.name),
        active: mod.name === previousActive,
      });
    }

    await this.writeIndex();

    info("wrote index.json");
  }

  private async writeIndex() {
    await writeFile(
      this.modificationPathIndexPath,
      new TextEncoder().encode(JSON.stringify(this.modificationPathIndex)),
    );
  }

  async refreshActiveVersion() {
    await this.installation.listInstallations();
    const activeVersion = this.installation.getActiveVersion();

    if (activeVersion) {
      this.modificationVerPath = activeVersion.path;
      this.activeVersionName = activeVersion.version;
    } else {
      warn("warning: theres no active version, skipping modificationPath");
    }
  }
}
