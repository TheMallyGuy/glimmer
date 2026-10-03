import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/pathManager";
import { exists, readTextFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { info, warn } from "@tauri-apps/plugin-log";
import { commands } from "../../bindings";
import type { ModificationManager } from "./manager";
import { StockRestorer } from "./stock";
import type { FillProgress } from "../installation/packageCache";

interface AppliedFileEntry {
  /** path of the applied file, relative to the installation root */
  path: string;
  /** md5 hash of the applied file, so a future apply can detect drift */
  hash: string;
}

interface AppliedIndex {
  [modName: string]: AppliedFileEntry[];
}

export class Applier {
  private manager: ModificationManager;
  private appliedIndexPath = "";
  private appliedIndex: AppliedIndex = {};

  constructor(manager: ModificationManager) {
    this.manager = manager;
  }

  static async create(manager: ModificationManager): Promise<Applier> {
    const a = new Applier(manager);
    a.appliedIndexPath = await new PathManager().getAppliedModsFile();
    await a.loadIndex();
    return a;
  }

  /** `onProgress` reports the stock package download, which only happens when the cache is missing or corrupt */
  async apply(order: string[], onProgress?: FillProgress): Promise<void> {
    await this.manager.reIndex();
    await this.manager.refreshActiveVersion();

    if (!this.manager.modificationVerPath) {
      throw new Error("No active installation to apply mods to.");
    }

    await this.dropLegacyBackups();

    const previousPaths = [
      ...new Set(
        Object.values(this.appliedIndex)
          .flat()
          .map((e) => e.path),
      ),
    ];
    if (previousPaths.length) {
      try {
        const stock = await StockRestorer.create(
          this.manager.activeVersionName,
        );
        const restored = await stock.restore(
          this.manager.modificationVerPath,
          previousPaths,
          onProgress,
        );
        info(`restored ${restored} file(s) to stock before reapplying mods`);
      } catch (e) {
        warn(`failed to restore stock files: ${e}`);
      }
    }
    this.appliedIndex = {};

    const known = new Set(
      this.manager.modificationPathIndex.map((m) => m.name),
    );
    const toApply = order.filter((name) => known.has(name)).reverse();

    for (const name of toApply) {
      const modPath = await join(this.manager.modificationPath, name);
      info(`applying mod ${name}`);

      const result = await commands.applyMod(
        modPath,
        this.manager.modificationVerPath,
      );
      if (result.status === "error") {
        warn(`failed to apply mod ${name}: ${result.error}`);
        continue;
      }

      this.appliedIndex[name] = result.data;
    }

    await this.saveIndex();
    info(`applied ${toApply.length} mod(s)`);
  }

  /** older versions kept a full copy of the install under mods/.originals; stock files now come from the package cache */
  private async dropLegacyBackups() {
    const legacy = await new PathManager().getLegacyOriginalsDir();
    if (await exists(legacy)) await remove(legacy, { recursive: true });
  }

  private async loadIndex() {
    const isExists = await exists(this.appliedIndexPath);
    if (!isExists) {
      this.appliedIndex = {};
      return;
    }

    const raw = await readTextFile(this.appliedIndexPath);
    this.appliedIndex = JSON.parse(raw);
  }

  private async saveIndex() {
    await writeFile(
      this.appliedIndexPath,
      new TextEncoder().encode(JSON.stringify(this.appliedIndex)),
    );
  }
}
