import { join } from "@tauri-apps/api/path";
import { exists, mkdir, remove, writeFile } from "@tauri-apps/plugin-fs";

export class FastFlagManager {
    versionPath = ""
    clientSettingsDir = ""
    clientAppSettingsPath = ""

    constructor(versionPath: string) {
        this.versionPath = versionPath
    }

    static async create(versionPath: string): Promise<FastFlagManager> {
        const ffm = new FastFlagManager(versionPath)
        ffm.clientSettingsDir = await join(versionPath, "ClientSettings")
        ffm.clientAppSettingsPath = await join(ffm.clientSettingsDir, "ClientAppSettings.json")

        return ffm
    }

    async apply(flags: Record<string, string>) {
        if (!await exists(this.clientSettingsDir)) {
            await mkdir(this.clientSettingsDir, { recursive: true })
        }

        await writeFile(
            this.clientAppSettingsPath,
            new TextEncoder().encode(JSON.stringify(flags)),
        )
    }

    async disableFlags() {
        if (!await exists(this.clientSettingsDir)) {
            await mkdir(this.clientSettingsDir, { recursive: true })
        }

        await remove(
            this.clientAppSettingsPath,
        )
    }
}
