import { join } from "@tauri-apps/api/path";
import { copyFile, mkdir } from "@tauri-apps/plugin-fs";
import { ModificationManager } from "../manager";

export const customDeathSoundModName = "Custom death sound";

const SOUND_DIR = ["content", "sounds"];
const SOUND_FILE = "ouch.ogg";

export async function setCustomDeathSound(soundPath: string) {
    const m = await ModificationManager.create(true, true)

    const mpath = await m.newMod(customDeathSoundModName)

    try {
        const target = await join(mpath, ...SOUND_DIR)
        await mkdir(target, { recursive: true })

        await copyFile(soundPath, await join(target, SOUND_FILE))
    } catch (err) {
        await m.deleteMod(customDeathSoundModName)
        throw err
    }
}
