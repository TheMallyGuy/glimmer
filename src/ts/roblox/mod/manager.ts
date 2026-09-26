import { appDataDir } from "@tauri-apps/api/path";
import { join } from "node:path";
import { Installation } from "../installation/installation";
import { debug, info, warn } from "@tauri-apps/plugin-log";
import { exists, mkdir, readDir, rename, writeFile } from "@tauri-apps/plugin-fs";

interface ModEntry {
    name: string;
    path: string;
    active: boolean;
}

export class ModificationManager {
    modificationPath = ""
    modificationVerPath = ""
    modificationPathIndexPath = ""
    modificationPathIndex: ModEntry[] = []
    reIndexVar = false
    refreshActiveVersionVar = false

    private installation!: Installation

    constructor(reIndexVar: boolean, refreshActiveVersionVar: boolean) { }

    static async create(reIndex = true, refreshActiveVersionVar: boolean): Promise<ModificationManager> {
        const m = new ModificationManager(reIndex, refreshActiveVersionVar);
        m.installation = await Installation.create();
        m.reIndexVar = await reIndex

        m.modificationPath = await join(await appDataDir(), "mods");
        m.modificationPathIndexPath = await join(m.modificationPath, "index.json");

        await m.refreshActiveVersion()

        return m;
    }

    async newMod(name: string): Promise<string> {
        await this.reIndex()

        const isExist = await exists(join(this.modificationPath, name))

        if (isExist) {
            throw new Error(`Mod with name ${name} already exist.`)
        }

        const path = await join(this.modificationPath, name)

        await mkdir(path)

        return path
    }

    async renameMod(oldName: string, newName: string): Promise<string> {
        await this.reIndex()

        const oldPath = await join(this.modificationPath, oldName)
        const isOldExist = await exists(oldPath)

        if (!isOldExist) {
            throw new Error(`Mod with name ${oldName} doesn't exist.`)
        }

        const newPath = await join(this.modificationPath, newName)
        const isNewExist = await exists(newPath)

        if (isNewExist) {
            throw new Error(`Mod with name ${newName} already exist.`)
        }

        await rename(oldPath, newPath)

        const entry = this.modificationPathIndex.find((m) => m.name === oldName)
        if (entry) {
            entry.name = newName
            entry.path = newPath
        }
        await this.writeIndex()

        info(`renamed mod ${oldName} to ${newName}`)

        return newPath
    }

    async reIndex() {
        info("reindexing installations")
        const isExists = await exists(this.modificationPath);
        if (!isExists) {
            info("version folder doesnt exist, creating one")
            await mkdir(this.modificationPath, { recursive: true });
        }

        const mods = await readDir(this.modificationPath);
        const previousActive = this.modificationPathIndex.find((v) => v.active)?.name;

        this.modificationPathIndex = [];

        for (const mod of mods) {
            if (!mod.isDirectory) continue;
            debug(`found ${mod.name}`)
            this.modificationPathIndex.push({
                name: mod.name,
                path: await join(this.modificationPath, mod.name),
                active: mod.name === previousActive
            });
        }

        await this.writeIndex();

        info("wrote index.json")
    }

    private async writeIndex() {
        await writeFile(
            this.modificationPathIndexPath,
            new TextEncoder().encode(JSON.stringify(this.modificationPathIndex))
        );
    }

    private async refreshActiveVersion() {
        const activeVersion = await this.installation.getActiveVersion()

        if (activeVersion) {
            this.modificationVerPath = await join(await appDataDir(), "version", activeVersion?.version);
        } else {
            warn("warning: theres no active version, skipping modificationPath")
        }
    }

}