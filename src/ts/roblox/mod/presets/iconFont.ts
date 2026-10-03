import { dirname, join } from "@tauri-apps/api/path";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export const iconFontModName = "Custom icon font";

export interface BuiltFont {
  /** the edited font on disk */
  path: string;
  /** where it goes, relative to the installation root */
  rel: string[];
}

/** Creates a mod that swaps the BuilderIcons fonts for the edited ones. */
export async function setIconFont(fonts: BuiltFont[]) {
  const m = await ModificationManager.create(true, true);

  const mpath = await m.newMod(iconFontModName);

  try {
    for (const font of fonts) {
      const target = await join(mpath, ...font.rel);
      await mkdir(await dirname(target), { recursive: true });
      await copyFile(font.path, target);
    }
  } catch (err) {
    await m.deleteMod(iconFontModName);
    throw err;
  }
}
