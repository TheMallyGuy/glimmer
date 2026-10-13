import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/glimmer/pathManager";
import { error } from "@tauri-apps/plugin-log";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export type CursorVersion = "2013" | "2006";

const CURSOR_DIR = ["content", "textures", "Cursors", "KeyboardMouse"];
const CURSOR_FILES = ["ArrowCursor.png", "ArrowFarCursor.png"];

export const cursorModName = (version: CursorVersion) => `${version} Cursor`;

export function isCursorVersion(value: string): value is CursorVersion {
  return value === "2013" || value === "2006";
}

export async function setCursor(cursorType: CursorVersion) {
  const m = await ModificationManager.create(true, true);

  const mpath = await m.newMod(cursorModName(cursorType));
  const target = await join(mpath, ...CURSOR_DIR);
  await mkdir(target, { recursive: true });

  for (const file of CURSOR_FILES) {
    const source = await new PathManager().getBundledResource(
      `resources/Mods/Cursors/${cursorType}/${file}`,
    );

    if (!source) {
      error(`cannot find ${cursorType} cursor in resources maybe its deleted?`);
      throw new Error(`Cannot find ${cursorType} cursor in resources.`);
    }

    await copyFile(source, await join(target, file));
  }
}
