import { copyFile, exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { PathManager } from "$ts/pathManager";

export type FleasionFile = "settings" | "modifications";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type FleasionJson = { [key: string]: any };

/** A file that can't be edited. The message names only the file, never its content: settings.json can hold proxy passwords. */
export class FleasionConfigError extends Error {
    constructor(
        readonly kind: "missing" | "invalid",
        readonly file: FleasionFile,
    ) {
        super(`Fleasion ${file}.json is ${kind === "missing" ? "missing" : "not a JSON object"}`);
    }
}


export class FleasionConfig {
    constructor(private readonly paths = new PathManager()) { }

    /** Fleasion has made its settings file, so it was installed and run at least once */
    async isInstalled(): Promise<boolean> {
        return exists(await this.paths.getFleasionSettingsFile());
    }

    async read(file: FleasionFile): Promise<FleasionJson> {
        const path = await this.pathOf(file);
        if (!(await exists(path))) throw new FleasionConfigError("missing", file);

        let json: unknown;
        try {
            json = JSON.parse(await readTextFile(path));
        } catch {
            throw new FleasionConfigError("invalid", file); // not the parse error: it can quote the text
        }
        if (!json || typeof json !== "object" || Array.isArray(json)) throw new FleasionConfigError("invalid", file);
        return json;
    }

    /**
     * Reads the file, lets `change` edit it in place and writes it back. Nothing is written when the file
     * can't be read or `change` throws. The first edit keeps a copy of the file as it was (`.glimmer-backup`).
     */
    async edit(file: FleasionFile, change: (json: FleasionJson) => void): Promise<void> {
        const json = await this.read(file);
        change(json);

        const path = await this.pathOf(file);
        const backup = `${path}.glimmer-backup`;
        if (!(await exists(backup))) await copyFile(path, backup);

        await writeTextFile(path, JSON.stringify(json)); // compact, as Fleasion writes it
    }

    private pathOf(file: FleasionFile): Promise<string> {
        return file === "settings" ? this.paths.getFleasionSettingsFile() : this.paths.getFleasionModificationsFile();
    }
}

export interface FleasionOptions {
    mirrorGlimmerFF: boolean;
    verify: boolean;
    gameCreator: boolean;
}


export async function applyFleasionSettings(
    options: FleasionOptions,
    flags: Record<string, string>,
    fleasion = new FleasionConfig(),
): Promise<void> {
    await fleasion.edit("settings", (json) => {
        const spoofer = (json.username_spoofer ??= {});
        spoofer.self_verified = options.verify;
        spoofer.self_game_creator = options.gameCreator;
        if (options.verify || options.gameCreator) spoofer.self_apply_ingame = true;

        if (options.mirrorGlimmerFF && Object.keys(flags).length > 0) {
            json.custom_fflags_enabled = true;
            json.custom_fflags = { ...flags };
        }
    });
}
