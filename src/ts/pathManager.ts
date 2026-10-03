import {
    appCacheDir,
    appDataDir,
    join,
    resolveResource,
} from "@tauri-apps/api/path";
import type { InstallKind } from "./roblox/installation/installation";

const INSTALL_FOLDERS: Record<InstallKind, string> = {
    player: "versions",
    studio: "studio-versions",
};

/**
 * Where Glimmer keeps its files. Every path the app builds on disk comes from here, so a folder or
 * file name is written once. It only works out paths: creating, reading and deleting stay with
 * the code that owns the files.
 */
export class PathManager {
    /** the settings file */
    async getConfigFile(): Promise<string> {
        return join(await appDataDir(), "config.json");
    }

    /** the folder that holds every install of a kind */
    async getRobloxInstallationsDir(kind: InstallKind): Promise<string> {
        return join(await appDataDir(), INSTALL_FOLDERS[kind]);
    }

    /** the list of installs in a kind's folder, with which one is active */
    async getInstallationIndexFile(kind: InstallKind): Promise<string> {
        return join(await this.getRobloxInstallationsDir(kind), "index.json");
    }

    /** the folder with one subfolder per mod */
    async getModsDir(): Promise<string> {
        return join(await appDataDir(), "mods");
    }

    /** the list of mods in the mods folder */
    async getModsIndexFile(): Promise<string> {
        return join(await this.getModsDir(), "index.json");
    }

    /** which files each mod last wrote into the install */
    async getAppliedModsFile(): Promise<string> {
        return join(await this.getModsDir(), "applied.json");
    }

    /** where older versions kept a full copy of the install, before stock files came from the package cache */
    async getLegacyOriginalsDir(): Promise<string> {
        return join(await this.getModsDir(), ".originals");
    }

    /** the downloaded package zips, or one install's folder in it when `name` is given */
    async getPackageCacheDir(name?: string): Promise<string> {
        const root = await join(await appCacheDir(), "glimmer-downloads");
        return name ? join(root, name) : root;
    }

    /** the icon font editor's working files */
    async getFontEditorDir(): Promise<string> {
        return join(await appDataDir(), "font-editor");
    }

    /** the games joined across sessions (see GameHistory) */
    async getGameHistoryFile(): Promise<string> {
        return join(await appDataDir(), "games.json");
    }

    /** the picture used as the app background */
    async getBackgroundsDir(): Promise<string> {
        return join(await appDataDir(), "backgrounds");
    }

    /** a file shipped with the app, e.g. "resources/Mods/Sounds/x.ogg" */
    async getBundledResource(relativePath: string): Promise<string> {
        return resolveResource(relativePath);
    }
}
