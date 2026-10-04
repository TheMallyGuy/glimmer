import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { openPath } from "@tauri-apps/plugin-opener";
import { load, type Store } from "@tauri-apps/plugin-store";
import { warn } from "@tauri-apps/plugin-log";
import { ModificationManager } from "$ts/roblox/mod/manager";
import { Applier } from "$ts/roblox/mod/apply";
import type { FillProgress } from "$ts/roblox/installation/packageCache";
import {
  cursorModName,
  isCursorVersion,
  setCursor,
} from "$ts/roblox/mod/presets/mouseCursor";
import {
  oldSoundsModName,
  setOldSounds,
} from "$ts/roblox/mod/presets/oldCharsSounds";
import {
  customDeathSoundModName,
  setCustomDeathSound,
} from "$ts/roblox/mod/presets/customDeathSound";
import {
  customFontModName,
  setCustomFont,
} from "$ts/roblox/mod/presets/customFont";
import {
  oldAvatarBackgroundModName,
  setOldAvatarBackground,
} from "$ts/roblox/mod/presets/oldAvatarBackground";
import type { CommunityMod } from "$ts/roblox/mod/community";
import { sourceNames } from "$ts/roblox/mod/community";

export interface Mod {
  id: string;
  name: string;
  enabled: boolean;
}

/** Installed mods, highest priority first. */
export const mods = $state({ list: [] as Mod[] });

/** Install state per community mod id. */
export const installs = $state<
  Record<string, "installing" | "installed" | "failed">
>({});

/** Built-in mod choices. */
export const prebuilt = $state({
  cursor: "default",
  oldSounds: false,
  oldAvatarBackground: false,
  font: null as string | null,
  deathSound: null as string | null,
});

let manager: ModificationManager | null = null;
let applier: Applier | null = null;
let configStore: Store | null = null;

async function getManager(): Promise<ModificationManager> {
  if (!manager) manager = await ModificationManager.create(true, true);
  return manager;
}

async function getConfig(): Promise<Store> {
  if (!configStore) configStore = await load("mods.json");
  return configStore;
}

/** a mod's disk folder name doubles as its id, since that's the only stable identity on disk */
export async function loadMods() {
  if (!isTauri()) return; // no disk outside Tauri

  const m = await getManager();
  await m.reIndex();

  const config = await getConfig();
  const order = (await config.get<string[]>("order")) ?? [];
  const enabled = (await config.get<Record<string, boolean>>("enabled")) ?? {};

  const diskNames = new Set(m.modificationPathIndex.map((e) => e.name));
  const orderedNames = [
    ...order.filter((n) => diskNames.has(n)),
    ...[...diskNames].filter((n) => !order.includes(n)),
  ];

  mods.list = orderedNames.map((name) => ({
    id: name,
    name,
    enabled: enabled[name] ?? true,
  }));

  await saveConfig(); // drop stale entries for mods no longer on disk
}

/** save order + enabled state, without touching the active installation's files */
async function saveConfig() {
  const config = await getConfig();
  await config.set(
    "order",
    mods.list.map((m) => m.name),
  );

  const enabled: Record<string, boolean> = {};
  for (const mod of mods.list) enabled[mod.name] = mod.enabled;
  await config.set("enabled", enabled);

  await config.save();
}

/** copy enabled mods' files into the active install, in priority order. Only the launch splash and installing a mod call this */
export async function applyMods(onProgress?: FillProgress) {
  const m = await getManager();
  if (!applier) applier = await Applier.create(m);
  const order = mods.list.filter((mo) => mo.enabled).map((mo) => mo.name);
  await applier.apply(order, onProgress);
}

/** save order, enabled state and mod files. Toggling and editing mods only stages them; the splash applies them on launch */
async function persist() {
  await saveConfig();
}

export function nameTaken(name: string, exceptId?: string) {
  const n = name.trim().toLowerCase();
  return mods.list.some((m) => m.id !== exceptId && m.name.toLowerCase() === n);
}

export async function createMod(name: string) {
  const trimmed = name.trim();
  const m = await getManager();
  await m.newMod(trimmed);

  const mod: Mod = { id: trimmed, name: trimmed, enabled: true };
  mods.list.unshift(mod);
  await persist();
  return mod;
}

export async function renameMod(id: string, name: string) {
  const mod = mods.list.find((m) => m.id === id);
  if (!mod) return;

  const trimmed = name.trim();
  const m = await getManager();
  await m.renameMod(mod.name, trimmed);

  mod.name = trimmed;
  mod.id = trimmed;
  await persist();
}

/** Takes a mod out of the list without touching its files, so it can be undone. */
export function removeMod(id: string) {
  const index = mods.list.findIndex((m) => m.id === id);
  if (index < 0) return null;
  const [mod] = mods.list.splice(index, 1);
  return { mod, index };
}

/** Puts a removed mod back where it was. */
export function restoreMod(mod: Mod, index: number) {
  mods.list.splice(Math.min(index, mods.list.length), 0, mod);
}

/** Deletes a removed mod's files for good. */
export async function commitDelete(mod: Mod) {
  const m = await getManager();
  await m.deleteMod(mod.name);
  await persist();
}

export async function deleteMod(id: string) {
  const removed = removeMod(id);
  if (removed) await commitDelete(removed.mod);
}

export async function setEnabled(id: string, enabled: boolean) {
  const mod = mods.list.find((m) => m.id === id);
  if (mod) mod.enabled = enabled;
  await persist();
}

export async function moveMod(from: number, to: number) {
  if (from === to || to < 0 || to >= mods.list.length) return;
  const [mod] = mods.list.splice(from, 1);
  mods.list.splice(to, 0, mod);
  await persist();
}

/** Replace the list order after a drag-and-drop reorder and persist it. */
export async function reorderMods(newOrder: Mod[]) {
  mods.list.splice(0, mods.list.length, ...newOrder);
  await persist();
}

export async function openModFolder(mod?: Mod) {
  const m = await getManager();
  const path = mod
    ? await join(m.modificationPath, mod.name)
    : m.modificationPath;
  await openPath(path);
}

/**
 * Swaps the mouse cursor mod for the chosen preset ('default' just removes it).
 * Throws when the preset has no bundled images, so the caller can put the old choice back.
 */
export async function applyCursor(value: string) {
  if (value !== "default" && !isCursorVersion(value)) {
    // TODO: bundle images for the purple-cross and dot cursors
    throw new Error(`no bundled images for the ${value} cursor`);
  }

  const m = await getManager();
  await m.reIndex();

  for (const version of ["2013", "2006"] as const) {
    const name = cursorModName(version);
    if (m.modificationPathIndex.some((e) => e.name === name))
      await m.deleteMod(name);
  }

  if (value !== "default") await setCursor(value);

  await loadMods();
  await persist();
}

/** Adds or removes the old character sounds mod. */
export async function applyOldSounds(enabled: boolean) {
  const m = await getManager();
  await m.reIndex();

  if (m.modificationPathIndex.some((e) => e.name === oldSoundsModName)) {
    await m.deleteMod(oldSoundsModName);
  }

  if (enabled) await setOldSounds();

  await loadMods();
  await persist();
}

/** Adds or removes the old avatar editor background mod. */
export async function applyOldAvatarBackground(enabled: boolean) {
  const m = await getManager();
  await m.reIndex();

  if (
    m.modificationPathIndex.some((e) => e.name === oldAvatarBackgroundModName)
  ) {
    await m.deleteMod(oldAvatarBackgroundModName);
  }

  if (enabled) await setOldAvatarBackground();

  await loadMods();
  await persist();
}

/** Replaces the custom font mod with one for `fontPath`, or removes it when `fontPath` is null. */
export async function applyCustomFont(fontPath: string | null) {
  const m = await getManager();
  await m.reIndex();

  if (m.modificationPathIndex.some((e) => e.name === customFontModName)) {
    await m.deleteMod(customFontModName);
  }

  if (fontPath) await setCustomFont(fontPath);

  await loadMods();
  await persist();
}

/** Replaces the death sound mod with one for `soundPath`, or removes it when `soundPath` is null. */
export async function applyDeathSound(soundPath: string | null) {
  const m = await getManager();
  await m.reIndex();

  if (m.modificationPathIndex.some((e) => e.name === customDeathSoundModName)) {
    await m.deleteMod(customDeathSoundModName);
  }

  if (soundPath) await setCustomDeathSound(soundPath);

  await loadMods();
  await persist();
}

export async function installCommunityMod(mod: CommunityMod) {
  if (installs[mod.id] === "installing") return;
  installs[mod.id] = "installing";

  try {
    // TODO: download mod.download and extract it into the new mod's folder.
    const name = `[${sourceNames[mod.source].replace(" library", "")}] ${mod.name}`;
    if (!nameTaken(name)) await createMod(name);
    await applyMods(); // an install takes effect right away
    installs[mod.id] = "installed";
  } catch (err) {
    console.error(err);
    installs[mod.id] = "failed";
  }
}
