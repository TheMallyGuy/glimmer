import { join } from "@tauri-apps/api/path";
import { exists, remove } from "@tauri-apps/plugin-fs";
import { info, warn } from "@tauri-apps/plugin-log";
import { commands, type PackageSource } from "$ts/glimmer/bindings";
import { Downloader } from "../installation/download";
import { DEFAULT_BASE_URLS, parseInstallName } from "../installation";
import { PackageCache, type FillProgress } from "../installation/packageCache";

/** files an install needs that no package ships, so restoring must never delete them */
const KEEP = new Set(["appsettings.xml"]);

/** the stock (unmodded) files of one installed version, read from its cached packages */
export class StockRestorer {
  private cache!: PackageCache;

  constructor(readonly name: string) {}

  static async create(name: string): Promise<StockRestorer> {
    const s = new StockRestorer(name);
    s.cache = await PackageCache.create();
    return s;
  }

  /**
   * extracts the stock copy of `paths` (relative to the install root) into `destDir`. Returns
   * the paths that exist in stock. A missing cache is downloaded first; a corrupt one is
   * re-verified against the manifest md5s, then retried once.
   */
  async extract(paths: string[], destDir: string, onProgress?: FillProgress): Promise<string[]> {
    if (paths.length === 0) return [];

    let sources = await this.cache.sources(this.name);
    if (sources.length === 0) {
      info(`no cached packages for ${this.name}, downloading them`);
      await this.fillCache(onProgress);
      sources = await this.cache.sources(this.name);
    }

    try {
      return await this.run(sources, paths, destDir);
    } catch (e) {
      warn(`cached packages for ${this.name} failed to extract (${e}), verifying them`);
      await this.fillCache(onProgress);
      return this.run(await this.cache.sources(this.name), paths, destDir);
    }
  }

  /**
   * puts the install back to stock for `paths`: stock files are re-extracted over the modded ones,
   * and files a mod added (not in any package) are deleted
   */
  async restore(installPath: string, paths: string[], onProgress?: FillProgress): Promise<number> {
    const restored = new Set(await this.extract(paths, installPath, onProgress));

    for (const path of paths) {
      if (restored.has(path) || KEEP.has(path.toLowerCase())) continue;

      const added = await join(installPath, path);
      if (await exists(added)) await remove(added);
    }

    return restored.size;
  }

  private async fillCache(onProgress?: FillProgress) {
    const { version, distribution } = parseInstallName(this.name);
    const d = await Downloader.create(DEFAULT_BASE_URLS, distribution);
    await this.cache.fill(d, version, this.name, undefined, onProgress);
  }

  private async run(sources: PackageSource[], paths: string[], destDir: string): Promise<string[]> {
    const result = await commands.extractPackageFiles(sources, destDir, paths);
    if (result.status === "error") throw new Error(result.error);
    return result.data;
  }
}
