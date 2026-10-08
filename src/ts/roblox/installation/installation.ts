import { PathManager } from "$ts/pathManager";
import { join } from "@tauri-apps/api/path";
import {
  exists,
  mkdir,
  readDir,
  readTextFile,
  remove,
  writeFile,
} from "@tauri-apps/plugin-fs";
import { debug, error, info } from "@tauri-apps/plugin-log";

export interface InstallEntry {
  version: string;
  path: string;
  active: boolean;
  vng?: boolean;
  /** launches use this version and skip updates while it is set; only the active version is ever pinned */
  pinned?: boolean;
}

export type InstallKind = "player" | "studio";



export class Installation {
  installationPath = "";
  installedVersions: InstallEntry[] = [];
  reIndexVar = false;
  private indexFile = "";
  constructor(reIndexVar: boolean) { }

  static async create(
    reIndex = true,
    kind: InstallKind = "player",
  ): Promise<Installation> {
    const i = new Installation(reIndex);
    const pm = new PathManager();
    i.installationPath = await pm.getRobloxInstallationsDir(kind);
    i.indexFile = await pm.getInstallationIndexFile(kind);
    i.reIndexVar = await reIndex;
    return i;
  }

  async listInstallations(reIndex = this.reIndexVar): Promise<InstallEntry[]> {
    debug("listing all installations");
    if (reIndex) {
      await this.reIndex();
    }

    const index = await readTextFile(this.indexFile);
    this.installedVersions = JSON.parse(index);

    return this.installedVersions;
  }

  /** creates the install's folder and records a placeholder index entry, so its `vng` flag survives the `reIndex()` at the end of a download */
  async createNewInstallation(name: string, vng = false, reIndex = true) {
    if (reIndex) {
      await this.reIndex();
    }

    const path = await join(this.installationPath, name);
    await mkdir(path, { recursive: true });

    if (!this.installedVersions.some((v) => v.version === name)) {
      this.installedVersions.push({ version: name, path, active: false, vng });
      await this.writeIndex();
    }
  }

  async reIndex() {
    info("reindexing installations");
    const isExists = await exists(this.installationPath);
    if (!isExists) {
      info("version folder doesnt exist, creating one");
      await mkdir(this.installationPath, { recursive: true });
    }

    const versions = await readDir(this.installationPath);
    const persisted = await this.readPersistedEntries();
    const previousByVersion = new Map(
      persisted.map((v) => [v.version, v] as const),
    );
    for (const v of this.installedVersions) previousByVersion.set(v.version, v); // in-memory wins

    const previousActive =
      this.installedVersions.find((v) => v.active)?.version ??
      persisted.find((v) => v.active)?.version;

    this.installedVersions = [];

    for (const version of versions) {
      if (!version.isDirectory) continue;

      const path = await join(this.installationPath, version.name);
      // AppSettings.xml is written last by the downloader, so its presence means
      // the install actually finished; skip stray/partial folders otherwise
      const isComplete = await exists(await join(path, "AppSettings.xml"));
      if (!isComplete) {
        debug(`skipping incomplete install ${version.name}`);
        continue;
      }

      debug(`found ${version.name}`);
      this.installedVersions.push({
        version: version.name,
        path,
        active: version.name === previousActive,
        vng: previousByVersion.get(version.name)?.vng,
        pinned: previousByVersion.get(version.name)?.pinned,
      });
    }

    await this.writeIndex();

    info("wrote index.json");
  }

  /** the installed version currently marked as active, if any */
  getActiveVersion(): InstallEntry | undefined {
    return this.installedVersions.find((v) => v.active);
  }

  /** the version launches stay on, if one is pinned */
  getPinnedVersion(): InstallEntry | undefined {
    return this.installedVersions.find((v) => v.pinned);
  }

  async getActiveVersionExe() {
    const actIn = this.installedVersions.find((v) => v.active)?.path

    if (!actIn) {
      error(`cannot find active version folder`)
      throw new Error("Cannot find active version folder")
    }

    const rbxexePath = await join(actIn, "RobloxPlayerBeta.exe")

    if (!(await exists(rbxexePath))) {
      error(`cannot find active version exe`)
      throw new Error("Cannot find active version exe")
    }

    return rbxexePath;
  }

  /**
   * mark one installed version as active, deactivating every other one, and persist it.
   * A pin on any other version is dropped, since only the active version can be pinned
   */
  async setActiveVersion(version: string) {
    const entry = this.installedVersions.find((v) => v.version === version);

    if (!entry) {
      throw new Error(`No installed version found for "${version}"`);
    }

    for (const v of this.installedVersions) {
      v.active = v.version === version;
      if (!v.active) delete v.pinned;
    }

    await this.writeIndex();
    info(`set active version to ${version}`);
  }

  /** pins a version (making it the active one), so launches use it and skip updates; null unpins */
  async setPinnedVersion(version: string | null) {
    if (version === null) {
      for (const v of this.installedVersions) delete v.pinned;
      await this.writeIndex();
      info("unpinned the installed version");
      return;
    }

    await this.setActiveVersion(version);
    this.installedVersions.find((v) => v.version === version)!.pinned = true;
    await this.writeIndex();
    info(`pinned version ${version}`);
  }

  /** deletes an installed version's files and drops it from the index */
  async removeInstallation(version: string) {
    const entry = this.installedVersions.find((v) => v.version === version);
    if (!entry) {
      throw new Error(`No installed version found for "${version}"`);
    }

    await remove(entry.path, { recursive: true });
    this.installedVersions = this.installedVersions.filter(
      (v) => v.version !== version,
    );

    await this.writeIndex();
    info(`removed installation ${version}`);
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
      new TextEncoder().encode(JSON.stringify(this.installedVersions)),
    );
  }
}
