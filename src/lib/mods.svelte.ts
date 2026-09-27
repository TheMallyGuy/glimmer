import type { CommunityMod } from '$ts/roblox/mod/community';
import { sourceNames } from '$ts/roblox/mod/community';

export interface Mod {
  id: string;
  name: string;
  enabled: boolean;
}

function uid() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
}

/** Installed mods, highest priority first. */
export const mods = $state({ list: [] as Mod[] });

/** Install state per community mod id. */
export const installs = $state<Record<string, 'installing' | 'installed' | 'failed'>>({});

/** Built-in mod choices. */
export const prebuilt = $state({
  cursor: 'default',
  emoji: 'default',
  oldSounds: false,
  oldAvatarBackground: false,
  font: null as string | null,
  deathSound: null as string | null,
});

export async function loadMods() {
  // TODO: read the mods folder, e.g. mods.list = await invoke<Mod[]>('list_mods');
}

async function persist() {
  // TODO: save order and enabled state, e.g. await invoke('save_mods', { mods: $state.snapshot(mods.list) });
}

export function nameTaken(name: string, exceptId?: string) {
  const n = name.trim().toLowerCase();
  return mods.list.some((m) => m.id !== exceptId && m.name.toLowerCase() === n);
}

export async function createMod(name: string) {
  const mod: Mod = { id: uid(), name: name.trim(), enabled: true };
  // TODO: await invoke('create_mod', { name: mod.name });
  mods.list.unshift(mod);
  await persist();
  return mod;
}

export async function renameMod(id: string, name: string) {
  const mod = mods.list.find((m) => m.id === id);
  if (!mod) return;
  // TODO: await invoke('rename_mod', { from: mod.name, to: name.trim() });
  mod.name = name.trim();
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
  // TODO: await invoke('delete_mod', { name: mod.name });
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
  // TODO: open the mods folder (or this mod's folder), e.g. with @tauri-apps/plugin-opener
  console.log('open folder', mod?.name ?? 'mods');
}

export async function installCommunityMod(mod: CommunityMod) {
  if (installs[mod.id] === 'installing') return;
  installs[mod.id] = 'installing';

  try {
    // TODO: download mod.download and extract it.
    // Themes (mod.kind === 'theme') go to your bootstrapper themes folder,
    // mods go to a new mod folder named below.
    // e.g. await invoke('install_mod', { url: mod.download, name, kind: mod.kind });
    const name = `[${sourceNames[mod.source].replace(' library', '')}] ${mod.name}`;
    if (mod.kind === 'mod' && !nameTaken(name)) await createMod(name);
    installs[mod.id] = 'installed';
  } catch (err) {
    console.error(err);
    installs[mod.id] = 'failed';
  }
}