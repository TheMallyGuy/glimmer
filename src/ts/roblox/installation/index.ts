import { join } from "@tauri-apps/api/path";
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import type { Downloader, Distribution, WindowBinaryType } from "./download";
import type { Installation } from "./installation";
import { PackageCache } from "./packageCache";

export const DEFAULT_BASE_URLS = [
    "https://setup-cfly.rbxcdn.com/",
    "https://setup-aws.rbxcdn.com/",
    "https://setup-ak.rbxcdn.com/",
    "https://setup.rbxcdn.com/",
];

export type InstallProgress =
    | { status: "fetchingManifest"; percent: null }
    | { status: "downloading" | "extracting"; done: number; total: number; percent: number }
    | { status: "finishing"; percent: null };

/**
 * the folder/index name a version is installed under. VNG installs get a `-VNG` suffix so a
 * Global and a VNG install of the same version hash don't collide or get picked up as each other.
 */
export function installName(version: string, distribution: Distribution): string {
    return distribution === "vng" ? `${version}-VNG` : version;
}

/** inverse of `installName` */
export function parseInstallName(name: string): { version: string; distribution: Distribution } {
    return name.endsWith("-VNG")
        ? { version: name.slice(0, -"-VNG".length), distribution: "vng" }
        : { version: name, distribution: "global" };
}

/**
 * downloads, extracts and installs a client version under `i`. Leaves the new
 * version out of `index.json`'s active slot -- call `i.setActiveVersion()` to switch to it.
 * `keepPackages` leaves the downloaded zips in the package cache, which mods restore stock files from.
 */
export async function installVersion(
    d: Downloader,
    i: Installation,
    version: string,
    concurrency: number,
    onProgress?: (p: InstallProgress) => void,
    binaryType: WindowBinaryType = "WindowsPlayer",
    keepPackages = false,
) {
    const name = installName(version, d.distribution);

    onProgress?.({ status: "fetchingManifest", percent: null });
    const manifest = await d.fetchManifest(version);

    const packagesDir = await (await PackageCache.create()).dir(name);
    await mkdir(packagesDir, { recursive: true });
    await i.createNewInstallation(name, d.distribution === "vng");
    const distDir = await join(i.installationPath, name);

    onProgress?.({ status: "downloading", done: 0, total: manifest.packages.length, percent: 0 });
    await d.downloadPackagesParallel(version, manifest, packagesDir, concurrency, (done, total, _pkg, percent) => {
        onProgress?.({ status: "downloading", done, total, percent });
    });

    onProgress?.({ status: "extracting", done: 0, total: manifest.packages.length, percent: 0 });
    await d.extractPackages(packagesDir, distDir, binaryType, (done, total) => {
        onProgress?.({ status: "extracting", done, total, percent: Math.round((done / total) * 100) });
    });

    onProgress?.({ status: "finishing", percent: null });
    await d.writeXml(distDir);
    if (!keepPackages) await remove(packagesDir, { recursive: true });

    await i.reIndex();
}
