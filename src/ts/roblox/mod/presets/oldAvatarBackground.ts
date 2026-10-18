import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/glimmer/pathManager";
import { error } from "@tauri-apps/plugin-log";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export const oldAvatarBackgroundModName = "Old avatar editor background";

const PLACE_DIR = ["ExtraContent", "places"];
const PLACE_FILE = "Mobile.rbxl";

export async function setOldAvatarBackground() {
  const m = await ModificationManager.create(true, true);

  const source = await new PathManager().getBundledResource(
    "resources/Mods/OldAvatarBackground.rbxl",
  );

  if (!source) {
    error("cannot find OldAvatarBackground.rbxl in resources maybe its deleted?");
    throw new Error("Cannot find OldAvatarBackground.rbxl in resources.");
  }

  const mpath = await m.newMod(oldAvatarBackgroundModName);
  const target = await join(mpath, ...PLACE_DIR);
  await mkdir(target, { recursive: true });

  await copyFile(source, await join(target, PLACE_FILE));
}
