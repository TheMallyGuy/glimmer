import { join } from "@tauri-apps/api/path";
import { exists, readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { info, warn } from "@tauri-apps/plugin-log";
import { commands } from "../../bindings";
import type { ModificationManager } from "./manager";

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
        a.appliedIndexPath = await join(manager.modificationPath, "applied.json");
        await a.loadIndex();
        return a;
    }

    async apply(order: string[]): Promise<void> {
        await this.manager.reIndex();
        await this.manager.refreshActiveVersion();

        if (!this.manager.modificationVerPath) {
            throw new Error("No active installation to apply mods to.");
        }

        const backupDir = await this.manager.backupPath();

        const previousPaths = Object.values(this.appliedIndex).flat().map((e) => e.path);
        if (previousPaths.length) {
            const reverted = await commands.revertFiles(this.manager.modificationVerPath, backupDir, previousPaths);
            if (reverted.status === "ok") {
                info(`reverted ${reverted.data} file(s) to stock before reapplying mods`);
            } else {
                warn(`failed to revert previous mod files: ${reverted.error}`);
            }
        }
        this.appliedIndex = {};

        const known = new Set(this.manager.modificationPathIndex.map((m) => m.name));
        const toApply = order.filter((name) => known.has(name)).reverse();

        for (const name of toApply) {
            const modPath = await join(this.manager.modificationPath, name);
            info(`applying mod ${name}`);

            const result = await commands.applyMod(modPath, this.manager.modificationVerPath, backupDir);
            if (result.status === "error") {
                warn(`failed to apply mod ${name}: ${result.error}`);
                continue;
            }

            this.appliedIndex[name] = result.data;
        }

        await this.saveIndex();
        info(`applied ${toApply.length} mod(s)`);
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
            new TextEncoder().encode(JSON.stringify(this.appliedIndex))
        );
    }
}
