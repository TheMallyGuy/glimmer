import { join } from "@tauri-apps/api/path";
import { error } from "@tauri-apps/plugin-log";
import { copyFile, mkdir, readDir, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export const customFontModName = "Custom font";

const FONT_DIR = ["content", "fonts"];

async function processFontFamilies(inputDir: string, outputDir: string, fontFile: string) {
  const entries = await readDir(inputDir);
  await mkdir(outputDir, { recursive: true });

  for (const entry of entries) {
    if (!entry.name?.endsWith(".json")) continue;

    const raw = await readTextFile(await join(inputDir, entry.name));
    const data = JSON.parse(raw);

    if (Array.isArray(data.faces)) {
      for (const face of data.faces) {
        if (face.assetId !== undefined) {
          face.assetId = `rbxasset://fonts/${fontFile}`;
        }
      }
    }

    await writeTextFile(await join(outputDir, entry.name), JSON.stringify(data, null, 2));
  }
}

export async function setCustomFont(fontPath: string) {
  const m = await ModificationManager.create(true, true);

  if (!m.modificationVerPath) {
    throw new Error("No active installation to read font families from.");
  }

  const mpath = await m.newMod(customFontModName);

  try {
    const fontFile = fontPath.split(/[\\/]/).at(-1)!;
    const fontsDir = await join(mpath, ...FONT_DIR);
    await mkdir(fontsDir, { recursive: true });

    await copyFile(fontPath, await join(fontsDir, fontFile));
    await processFontFamilies(
      await join(m.modificationVerPath, ...FONT_DIR, "families"),
      await join(fontsDir, "families"),
      fontFile,
    );
  } catch (err) {
    error(`could not create the custom font mod: ${err}`);
    await m.deleteMod(customFontModName);
    throw err;
  }
}
