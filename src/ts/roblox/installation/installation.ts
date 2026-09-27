import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, writeFile } from "@tauri-apps/plugin-fs";
import { debug, info } from "@tauri-apps/plugin-log";

export interface InstallEntry {
    version: string;
    path: string;
    active: boolean;
}

export class Installation {
    installationPath = "";
    installedVersions: InstallEntry[] = [];
    reIndexVar = false
    private indexFile = ""
    constructor(reIndexVar: boolean) { }

    static async create(reIndex = true): Promise<Installation> {
        const i = new Installation(reIndex);
        i.installationPath = await join(await appDataDir(), "versions");
        i.indexFile = await join(i.installationPath, "index.json")
        i.reIndexVar = await reIndex
        return i;
    }

    async listInstallations(reIndex = this.reIndexVar): Promise<InstallEntry[]> {
        debug("listing all installations")
        if (reIndex) {
            await this.reIndex()
        }

        const index = await readTextFile(this.indexFile)

        return JSON.parse(index)
    }

    async createNewInstallation(name: string, reIndex = true) {
        if (reIndex) {
            await this.reIndex()
        }

        const path = await join(this.installationPath, name)
        const res = await mkdir(path, { recursive: true })

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
        const previousActive = this.installedVersions.find((v) => v.active)?.version;

        this.installedVersions = [];

        for (const version of versions) {
            if (!version.isDirectory) continue;

            const path = await join(this.installationPath, version.name);
            // AppSettings.xml is written last by the downloader, so its presence means
            // the install actually finished; skip stray/partial folders otherwise
            const isComplete = await exists(await join(path, "AppSettings.xml"));
            if (!isComplete) {
                debug(`skipping incomplete install ${version.name}`)
                continue;
            }

            debug(`found ${version.name}`)
            this.installedVersions.push({
                version: version.name,
                path,
                active: version.name === previousActive
            });
        }

        await this.writeIndex();

        info("wrote index.json")
    }

    /** the installed version currently marked as active, if any */
    getActiveVersion(): InstallEntry | undefined {
        return this.installedVersions.find((v) => v.active);
    }

    /**
     * mark one installed version as active, deactivating every other one, and persist it
     */
    async setActiveVersion(version: string) {
        const entry = this.installedVersions.find((v) => v.version === version);

        if (!entry) {
            throw new Error(`No installed version found for "${version}"`);
        }

        for (const v of this.installedVersions) {
            v.active = v.version === version;
        }

        await this.writeIndex();
        info(`set active version to ${version}`)
    }

    private async writeIndex() {
        await writeFile(
            this.indexFile,
            new TextEncoder().encode(JSON.stringify(this.installedVersions))
        );
    }
}