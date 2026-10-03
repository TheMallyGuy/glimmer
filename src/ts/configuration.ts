import { appDataDir, join } from "@tauri-apps/api/path";
import { readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { load, Store } from "@tauri-apps/plugin-store";

export class Configuration {
  autoSave = true;
  configStore!: Store; // this actually save mem
  constructor(autoSave = true) {}

  static async create(autoSave = true): Promise<Configuration> {
    const c = new Configuration(autoSave);
    c.configStore = await load("config.json");
    return c;
  }

  async getAsText(): Promise<string> {
    const content = await readTextFile(
      await join(await appDataDir(), "config.json"),
    ); // i mean surely nothing can go wrong right?
    return content;
  }

  async saveRaw(conf: string) {
    await writeTextFile(await join(await appDataDir(), "config.json"), conf); // i mean surely nothing can go wrong right?
  }

  async get(key: string): Promise<any> {
    // hazard
    return await this.configStore.get(key);
  }

  async set(key: string, value: string) {
    await this.configStore.set(key, value);
  }
}
