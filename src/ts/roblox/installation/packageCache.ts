import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/glimmer/pathManager";
import { exists, mkdir, readDir, remove } from "@tauri-apps/plugin-fs";
import type { PackageSource } from "$ts/glimmer/bindings";
import { EXTRACT_ROOTS, type Downloader } from "./download";

/** `done` of `total` packages downloaded, `percent` of the bytes */
export type FillProgress = (
  done: number,
  total: number,
  percent: number,
) => void;

/**
 * downloaded package zips, one folder per install name. They stay after an install so stock
 * files can be restored from them, instead of keeping a full copy of the install.
 */
export class PackageCache {
  root = "";

  static async create(): Promise<PackageCache> {
    const c = new PackageCache();
    c.root = await new PathManager().getPackageCacheDir();
    return c;
  }

  async dir(name: string): Promise<string> {
    return join(this.root, name);
  }

  async sources(name: string): Promise<PackageSource[]> {
    const dir = await this.dir(name);
    const roots = Object.entries(EXTRACT_ROOTS.player);
    const sources: PackageSource[] = [];

    for (const [zip, prefix] of roots) {
      const zipPath = await join(dir, zip);
      if (await exists(zipPath)) sources.push({ zipPath, prefix });
    }

    return sources.length === roots.length ? sources : [];
  }

  async fill(
    d: Downloader,
    version: string,
    name: string,
    concurrency = 4,
    onProgress?: FillProgress,
  ) {
    const dir = await this.dir(name);
    await mkdir(dir, { recursive: true });

    const manifest = await d.fetchManifest(version);
    await d.downloadPackagesParallel(
      version,
      manifest,
      dir,
      concurrency,
      (done, total, _pkg, percent) => onProgress?.(done, total, percent),
    );
  }

  async prune(keep: string) {
    if (!(await exists(this.root))) return;

    for (const entry of await readDir(this.root)) {
      if (entry.isDirectory && entry.name !== keep) {
        await remove(await join(this.root, entry.name), { recursive: true });
      }
    }
  }
}
