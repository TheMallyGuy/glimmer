import { appCacheDir, join } from "@tauri-apps/api/path";
import { mkdir, remove } from "@tauri-apps/plugin-fs";
import type { Downloader } from "./download";
import type { Installation } from "./installation";

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
 * downloads, extracts and installs a client version under `i`. Leaves the new
 * version out of `index.json`'s active slot -- call `i.setActiveVersion()` to switch to it.
 */
export async function installVersion(
    d: Downloader,
    i: Installation,
    version: string,
    concurrency: number,
    onProgress?: (p: InstallProgress) => void,
) {
    onProgress?.({ status: "fetchingManifest", percent: null });
    const manifest = await d.fetchManifest(version);

    const packagesDir = await join(await appCacheDir(), "glimmer-downloads", version);
    await mkdir(packagesDir, { recursive: true });
    await i.createNewInstallation(version);
    const distDir = await join(i.installationPath, version);

    onProgress?.({ status: "downloading", done: 0, total: manifest.packages.length, percent: 0 });
    await d.downloadPackagesParallel(version, manifest, packagesDir, concurrency, (done, total, _pkg, percent) => {
        onProgress?.({ status: "downloading", done, total, percent });
    });

    onProgress?.({ status: "extracting", done: 0, total: manifest.packages.length, percent: 0 });
    await d.extractPackages(packagesDir, distDir, "WindowsPlayer", (done, total) => {
        onProgress?.({ status: "extracting", done, total, percent: Math.round((done / total) * 100) });
    });

    onProgress?.({ status: "finishing", percent: null });
    await d.writeXml(distDir);
    await remove(packagesDir, { recursive: true });

    await i.reIndex();
}
