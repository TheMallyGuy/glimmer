import { join } from "@tauri-apps/api/path";
import { PathManager } from "$ts/glimmer/pathManager";
import { error } from "@tauri-apps/plugin-log";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export const oldSoundsModName = "Old character sounds";

const SOUND_DIR = ["content", "sounds"];

const SOUND_FILES: Record<string, string> = {
  "action_footsteps_plastic.mp3": "OldWalk.mp3",
  "action_get_up.mp3": "OldGetUp.mp3",
  "action_jump.mp3": "OldJump.mp3",
  "action_jump_land.mp3": "Empty.mp3",
  "action_swim.mp3": "Empty.mp3",
  "impact_water.mp3": "Empty.mp3",
};

export async function setOldSounds() {
  const m = await ModificationManager.create(true, true);

  const mpath = await m.newMod(oldSoundsModName);
  const target = await join(mpath, ...SOUND_DIR);
  await mkdir(target, { recursive: true });

  for (const [robloxFile, bundled] of Object.entries(SOUND_FILES)) {
    const source = await new PathManager().getBundledResource(`resources/Mods/Sounds/${bundled}`);

    if (!source) {
      error(`cannot find ${bundled} in resources maybe its deleted?`);
      throw new Error(`Cannot find ${bundled} in resources.`);
    }

    await copyFile(source, await join(target, robloxFile));
  }
}
