import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { debug, info } from "@tauri-apps/plugin-log";

interface InstallEntry {
    version: string;
    path: string;
}

export class Installation {
    installationPath = "";
    installedVersions: InstallEntry[] = [];
    private indexFile = ""

    static async create(): Promise<Installation> {
        const i = new Installation();
        i.installationPath = await join(await appDataDir(), "versions");
        i.indexFile = await join(i.installationPath, "index.json")
        return i;
    }

    async listInstallations(reIndex = true): Promise<InstallEntry> {
        debug("listing all installations")
        if (reIndex) {
            this.reIndex()
        }

        const index = await readTextFile(this.indexFile)

        return JSON.parse(index)
    }

    async createNewInstallation(name: string, reIndex = true) {
        if (reIndex) {
            this.reIndex()
        }

        const path = await join(this.installationPath, name)
        const res = await mkdir(path)

        return res
    }

    async reIndex() {
        info("reindexing installations")
        const isExists = await exists(this.installationPath);
        if (!isExists) {
            info("version folder doesnt exist, creating one")
            await mkdir(this.installationPath, { recursive: true });
        }

        const versions = await readDir(this.installationPath);

        this.installedVersions = [];

        for (const version of versions) {
            if (!version.isDirectory) continue;
            debug(`found ${version.name}`)
            this.installedVersions.push({
                version: version.name,
                path: await join(this.installationPath, version.name),
            });
        }

        await writeFile(
            this.indexFile,
            new TextEncoder().encode(JSON.stringify(this.installedVersions))
        );

        info("wrote index.json")
    }
}