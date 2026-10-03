import { join } from "@tauri-apps/api/path";
import { exists, writeFile } from "@tauri-apps/plugin-fs";
import { joinUrl } from "../../utils";
import { commands } from "../../bindings";
import { fetch } from "@tauri-apps/plugin-http";
import { debug, error, info } from "@tauri-apps/plugin-log";

export type WindowBinaryType = "WindowsStudio64" | "WindowsPlayer";

// https://github.com/fishstrap/fishstrap/commit/988db40e3e259489f95e4c7ec40f8dbf5685f309
export type Distribution = "global" | "vng";

const REGION_PROBE_TIMEOUT_MS = 3000;

const DISTRIBUTION_CONFIG: Record<
  Distribution,
  { clientSettingsUrl: string; cdnExtension: string }
> = {
  global: {
    clientSettingsUrl: "https://clientsettings.roproxy.com/v2/client-version",
    cdnExtension: "",
  },
  vng: {
    clientSettingsUrl:
      "https://clientsettingscdn.robloxapp.vnggames.com/v2/client-version",
    cdnExtension: "/vng",
  },
};

interface ClientVersionResponse {
  version: string;
  clientVersionUpload: string;
  bootstrapperVersion: string;
}

export interface PackageEntry {
  fileName: string;
  md5: string;
  compressedSize: number;
  uncompressedSize: number;
}

export interface ParsedManifest {
  manifestVersion: string;
  packages: PackageEntry[];
}

/** package zip -> folder (relative to the install root) it extracts into, per binary type */
export const EXTRACT_ROOTS = {
  player: {
    "RobloxApp.zip": "",
    "redist.zip": "",
    "shaders.zip": "shaders/",
    "ssl.zip": "ssl/",

    "WebView2.zip": "",
    "WebView2RuntimeInstaller.zip": "WebView2RuntimeInstaller/",

    "content-avatar.zip": "content/avatar/",
    "content-configs.zip": "content/configs/",
    "content-fonts.zip": "content/fonts/",
    "content-sky.zip": "content/sky/",
    "content-sounds.zip": "content/sounds/",
    "content-textures2.zip": "content/textures/",
    "content-models.zip": "content/models/",

    "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
    "content-platform-dictionaries.zip":
      "PlatformContent/pc/shared_compression_dictionaries/",
    "content-terrain.zip": "PlatformContent/pc/terrain/",
    "content-textures3.zip": "PlatformContent/pc/textures/",

    "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
    "extracontent-translations.zip": "ExtraContent/translations/",
    "extracontent-models.zip": "ExtraContent/models/",
    "extracontent-textures.zip": "ExtraContent/textures/",
    "extracontent-places.zip": "ExtraContent/places/",
  },

  studio: {
    "RobloxStudio.zip": "",
    "RibbonConfig.zip": "RibbonConfig/",
    "redist.zip": "",
    "Libraries.zip": "",
    "LibrariesQt5.zip": "",

    "WebView2.zip": "",
    "WebView2RuntimeInstaller.zip": "",

    "shaders.zip": "shaders/",
    "ssl.zip": "ssl/",

    "Qml.zip": "Qml/",
    "Plugins.zip": "Plugins/",
    "StudioFonts.zip": "StudioFonts/",
    "BuiltInPlugins.zip": "BuiltInPlugins/",
    "ApplicationConfig.zip": "ApplicationConfig/",
    "BuiltInStandalonePlugins.zip": "BuiltInStandalonePlugins/",

    "content-qt_translations.zip": "content/qt_translations/",
    "content-sky.zip": "content/sky/",
    "content-fonts.zip": "content/fonts/",
    "content-avatar.zip": "content/avatar/",
    "content-models.zip": "content/models/",
    "content-sounds.zip": "content/sounds/",
    "content-configs.zip": "content/configs/",
    "content-api-docs.zip": "content/api_docs/",
    "content-textures2.zip": "content/textures/",
    "content-studio_svg_textures.zip": "content/studio_svg_textures/",

    "content-platform-fonts.zip": "PlatformContent/pc/fonts/",
    "content-platform-dictionaries.zip":
      "PlatformContent/pc/shared_compression_dictionaries/",
    "content-terrain.zip": "PlatformContent/pc/terrain/",
    "content-textures3.zip": "PlatformContent/pc/textures/",

    "extracontent-translations.zip": "ExtraContent/translations/",
    "extracontent-luapackages.zip": "ExtraContent/LuaPackages/",
    "extracontent-textures.zip": "ExtraContent/textures/",
    "extracontent-scripts.zip": "ExtraContent/scripts/",
    "extracontent-models.zip": "ExtraContent/models/",
    "studiocontent-models.zip": "StudioContent/models/",
    "studiocontent-textures.zip": "StudioContent/textures/",
  },
};

export class Downloader {
  private get clientSettingsUrl() {
    return DISTRIBUTION_CONFIG[this.distribution].clientSettingsUrl;
  }

  private get cdnExtension() {
    return DISTRIBUTION_CONFIG[this.distribution].cdnExtension;
  }

  // name each binary type is logged under in DeployHistory.txt
  private readonly deployHistoryNames: Record<WindowBinaryType, string> = {
    WindowsPlayer: "WindowsPlayer",
    WindowsStudio64: "Studio64",
  };
  readonly extractRoots = EXTRACT_ROOTS;

  baseUrl: string = "";

  private constructor(
    private baseUrls: string[],
    readonly distribution: Distribution,
  ) {}

  static async create(
    baseUrls: string[],
    distribution: Distribution = "global",
  ): Promise<Downloader> {
    const d = new Downloader(baseUrls, distribution);
    d.baseUrl = await d.bestRegion(baseUrls);
    return d;
  }

  /**
   * probes every base url at once and returns the first one to answer, which is the
   * lowest-latency one. Probing one by one cost a full round trip per url (more for a dead one).
   */
  async bestRegion(baseUrls: string[]): Promise<string> {
    debug("begging to test regions urls");

    const probe = async (url: string) => {
      const start = performance.now();
      const response = await fetch(url, {
        signal: AbortSignal.timeout(REGION_PROBE_TIMEOUT_MS),
      });

      if (response.status !== 403) {
        // 403 is expected
        throw new Error(`unexpected status ${response.status}`);
      }

      debug(`tested ${url} -> ${performance.now() - start}`);
      return url;
    };

    try {
      return await Promise.any(baseUrls.map(probe));
    } catch {
      error("No reachable base URLs");
      throw new Error("No reachable base URLs");
    }
  }

  /**
   * extract downloaded packages into dist
   * @param src - source of the packages downloaded
   * @param dist - dest
   */
  async extractPackages(
    src: string,
    dist: string,
    binaryType: WindowBinaryType,
    onProgress?: (done: number, total: number, filename: string) => void,
  ) {
    info("begging to extract packages");

    const root =
      binaryType === "WindowsStudio64"
        ? this.extractRoots.studio
        : this.extractRoots.player;
    const entries = Object.entries(root);

    let done = 0;
    for (const [filename, url] of entries) {
      debug(`extracting ${filename} to ${url}`);

      await commands.extractZip(
        await join(src, filename),
        await join(dist, url),
      );
      done++;
      onProgress?.(done, entries.length, filename);
    }
  }

  async parsePkgManifest(raw: string): Promise<ParsedManifest> {
    const lines = raw
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line.length > 0);

    if (lines.length === 0) {
      throw new Error("Empty manifest");
    }

    const manifestVersion = lines[0];
    const rest = lines.slice(1);

    if (rest.length % 4 !== 0) {
      error(
        `Malformed manifest: expected entries in groups of 4 lines, got ${rest.length} remaining lines`,
      );
      throw new Error(
        `Malformed manifest: expected entries in groups of 4 lines, got ${rest.length} remaining lines`,
      );
    }

    const packages: PackageEntry[] = [];

    for (let i = 0; i < rest.length; i += 4) {
      const [fileName, md5, compressedSizeStr, uncompressedSizeStr] =
        rest.slice(i, i + 4);

      const compressedSize = Number(compressedSizeStr);
      const uncompressedSize = Number(uncompressedSizeStr);

      if (
        !Number.isFinite(compressedSize) ||
        !Number.isFinite(uncompressedSize)
      ) {
        error(
          `Malformed size fields for entry "${fileName}": ${compressedSizeStr}, ${uncompressedSizeStr}`,
        );
        throw new Error(
          `Malformed size fields for entry "${fileName}": ${compressedSizeStr}, ${uncompressedSizeStr}`,
        );
      }

      packages.push({
        fileName,
        md5,
        compressedSize,
        uncompressedSize,
      });
    }

    return { manifestVersion, packages };
  }

  async fetchLatestVersion(
    binaryType: WindowBinaryType,
    channel: string = "LIVE",
  ): Promise<string> {
    const url = `${this.clientSettingsUrl}/${binaryType}/channel/${channel}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        error(
          `Failed to fetch version info: ${response.status} ${response.statusText}`,
        );
        throw new Error(
          `Failed to fetch version info: ${response.status} ${response.statusText}`,
        );
      }

      const versionData: ClientVersionResponse = await response.json();

      if (!versionData.clientVersionUpload) {
        error("Invalid version response: missing clientVersionUpload");
        throw new Error(
          "Invalid version response: missing clientVersionUpload",
        );
      }

      return versionData.clientVersionUpload;
    } catch (errorr) {
      if (errorr instanceof SyntaxError) {
        error("Failed to parse version response: Invalid JSON");
        throw new Error("Failed to parse version response: Invalid JSON");
      }
      error(
        `Version fetch failed: ${errorr instanceof Error ? errorr.message : "Unknown error"}`,
      );
      throw new Error(
        `Version fetch failed: ${errorr instanceof Error ? errorr.message : "Unknown error"}`,
      );
    }
  }

  /**
   * Finds the version before the current latest one in Roblox's deploy history log,
   * e.g. to roll back to it. Throws if fewer than two distinct versions are logged.
   */
  async fetchPreviousVersion(
    binaryType: WindowBinaryType,
    channel: string = "LIVE",
  ): Promise<string> {
    const channelPath =
      channel === "LIVE"
        ? this.baseUrl
        : joinUrl(this.baseUrl, `channel/${channel}`);
    const url = joinUrl(channelPath, "DeployHistory.txt");

    const response = await fetch(url);

    if (!response.ok) {
      error(
        `Failed to fetch deploy history: ${response.status} ${response.statusText}`,
      );
      throw new Error(
        `Failed to fetch deploy history: ${response.status} ${response.statusText}`,
      );
    }

    const history = await response.text();

    // trailing space stops "Studio" from also matching "Studio64"
    const name = this.deployHistoryNames[binaryType];
    const re = new RegExp(`New ${name} (version-[0-9a-f]+)`, "g");
    const versions = [...history.matchAll(re)].map((m) => m[1]);

    const distinct: string[] = [];
    for (let i = versions.length - 1; i >= 0; i--) {
      const v = versions[i];
      if (!distinct.includes(v)) distinct.push(v);
      if (distinct.length === 2) return v;
    }

    error(`Couldn't find a previous ${binaryType} version in ${url}`);
    throw new Error(`Couldn't find a previous ${binaryType} version in ${url}`);
  }

  async fetchManifest(version: string): Promise<ParsedManifest> {
    const url = joinUrl(
      this.baseUrl,
      `${this.cdnExtension}/${version}-rbxPkgManifest.txt`,
    );
    const response = await fetch(url);

    if (!response.ok) {
      error(
        `Failed to fetch rbxPkgManifest for ${version}: ${response.status} ${response.statusText}`,
      );
      throw new Error(
        `Failed to fetch rbxPkgManifest for ${version}: ${response.status} ${response.statusText}`,
      );
    }

    const raw = await response.text();
    return this.parsePkgManifest(raw);
  }

  async writeXml(dest: string) {
    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<Settings>
\t<ContentFolder>content</ContentFolder>
\t<BaseUrl>http://www.roblox.com</BaseUrl>
</Settings>`;

    await writeFile(
      await join(dest, "AppSettings.xml"),
      new TextEncoder().encode(xml),
    );
    debug("wrote AppSettings.xml");
  }

  /**
   * download a single package zip from this.baseUrl into destDir
   * @param version - client version, e.g. "version-0123456789abcdef"
   * @param pkg - the manifest entry to download
   * @param destDir - directory to write the package into
   */
  async downloadPackage(
    version: string,
    pkg: PackageEntry,
    destDir: string,
    onChunk?: (receivedBytes: number, totalBytes: number) => void,
  ): Promise<string> {
    info("beginning to download package");
    const url = joinUrl(
      this.baseUrl,
      `${this.cdnExtension}/${version}-${pkg.fileName}`,
    );
    const response = await fetch(url);

    if (!response.ok) {
      error(
        `Failed to download ${pkg.fileName}: ${response.status} ${response.statusText}`,
      );
      throw new Error(
        `Failed to download ${pkg.fileName}: ${response.status} ${response.statusText}`,
      );
    }

    const chunks: Uint8Array[] = [];
    let receivedBytes = 0;

    if (response.body) {
      const reader = response.body.getReader();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        chunks.push(value);
        receivedBytes += value.byteLength;
        onChunk?.(receivedBytes, pkg.compressedSize);
      }
    } else {
      const buf = new Uint8Array(await response.arrayBuffer());
      chunks.push(buf);
      receivedBytes = buf.byteLength;
      onChunk?.(receivedBytes, pkg.compressedSize);
    }

    const bytes = new Uint8Array(receivedBytes);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    const dest = await join(destDir, pkg.fileName);
    await writeFile(dest, bytes);

    return dest;
  }

  /**
   * true when destDir already holds a complete copy of the package, i.e. an earlier
   * attempt finished it. The md5 check also rejects files cut short by a crash.
   */
  async hasCachedPackage(pkg: PackageEntry, destDir: string): Promise<boolean> {
    const dest = await join(destDir, pkg.fileName);
    if (!(await exists(dest))) return false;

    try {
      const result = await commands.md5File(dest);
      return (
        result.status === "ok" &&
        result.data.toLowerCase() === pkg.md5.toLowerCase()
      );
    } catch {
      return false;
    }
  }

  /**
   * download every package listed in a parsed manifest into destDir, with up to
   * `concurrency` packages downloading at once. Packages already in destDir with a
   * matching md5 are kept, so a retry after a failed or cancelled install resumes
   * where it stopped.
   */
  async downloadPackagesParallel(
    version: string,
    manifest: ParsedManifest,
    destDir: string,
    concurrency: number = 4,
    onProgress?: (
      done: number,
      total: number,
      pkg: PackageEntry,
      percent: number,
    ) => void,
  ): Promise<string[]> {
    info(
      `beginning to download packages with parallel with params : ${version}, ${destDir}, ${concurrency}`,
    );

    const total = manifest.packages.length;
    const paths: string[] = new Array(total);
    const receivedByIndex: number[] = new Array(total).fill(0);
    const totalBytes = manifest.packages.reduce(
      (sum, pkg) => sum + pkg.compressedSize,
      0,
    );

    const percentDone = () => {
      const bytesDone = receivedByIndex.reduce((sum, b) => sum + b, 0);
      return totalBytes > 0 ? Math.round((bytesDone / totalBytes) * 100) : 100;
    };

    let done = 0;
    let nextIndex = 0;

    const worker = async () => {
      while (true) {
        const index = nextIndex++;
        if (index >= total) return;

        const pkg = manifest.packages[index];

        if (await this.hasCachedPackage(pkg, destDir)) {
          debug(`resuming: ${pkg.fileName} already downloaded`);
          paths[index] = await join(destDir, pkg.fileName);
          receivedByIndex[index] = pkg.compressedSize;
          done++;
          onProgress?.(done, total, pkg, percentDone());
          continue;
        }

        paths[index] = await this.downloadPackage(
          version,
          pkg,
          destDir,
          (receivedBytes) => {
            receivedByIndex[index] = receivedBytes;
            onProgress?.(done, total, pkg, percentDone());
          },
        );

        receivedByIndex[index] = pkg.compressedSize;
        done++;
      }
    };

    const workers = Array.from({ length: Math.min(concurrency, total) }, () =>
      worker(),
    );
    await Promise.all(workers);

    info(
      `download packages with parallel completed with params : ${version}, ${destDir}, ${concurrency}`,
    );

    return paths;
  }
}
