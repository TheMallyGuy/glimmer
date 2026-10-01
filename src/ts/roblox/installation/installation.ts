import { appDataDir, join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, readTextFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { debug, info } from "@tauri-apps/plugin-log";

export interface InstallEntry {
    version: string;
    path: string;
    active: boolean;
    vng?: boolean;
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
        this.installedVersions = JSON.parse(index)

        return this.installedVersions
    }

    /** creates the install's folder and records a placeholder index entry, so its `vng` flag survives the `reIndex()` at the end of a download */
    async createNewInstallation(name: string, vng = false, reIndex = true) {
        if (reIndex) {
            await this.reIndex()
        }

        const path = await join(this.installationPath, name)
        await mkdir(path, { recursive: true })

        if (!this.installedVersions.some((v) => v.version === name)) {
            this.installedVersions.push({ version: name, path, active: false, vng });
            await this.writeIndex();
        }
    }

    async reIndex() {
        info("reindexing installations")
        const isExists = await exists(this.installationPath);
        if (!isExists) {
            info("version folder doesnt exist, creating one")
            await mkdir(this.installationPath, { recursive: true });
        }

        const versions = await readDir(this.installationPath);
        const persisted = await this.readPersistedEntries();
        const previousByVersion = new Map(persisted.map((v) => [v.version, v] as const));
        for (const v of this.installedVersions) previousByVersion.set(v.version, v); // in-memory wins

        const previousActive =
            this.installedVersions.find((v) => v.active)?.version
            ?? persisted.find((v) => v.active)?.version;

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
                active: version.name === previousActive,
                vng: previousByVersion.get(version.name)?.vng,
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

    /** deletes an installed version's files and drops it from the index */
    async removeInstallation(version: string) {
        const entry = this.installedVersions.find((v) => v.version === version);
        if (!entry) {
            throw new Error(`No installed version found for "${version}"`);
        }

        await remove(entry.path, { recursive: true });
        this.installedVersions = this.installedVersions.filter((v) => v.version !== version);

        await this.writeIndex();
        info(`removed installation ${version}`)
    }

    /** read index.json from disk without touching in-memory state */
    private async readPersistedEntries(): Promise<InstallEntry[]> {
        try {
            const raw = await readTextFile(this.indexFile);
            return JSON.parse(raw);
        } catch {
            return [];
        }
    }

    private async writeIndex() {
        await writeFile(
            this.indexFile,
            new TextEncoder().encode(JSON.stringify(this.installedVersions))
        );
    }
}