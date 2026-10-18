// from https://github.com/TheMallyGuy/crush/blob/master/src/lib/communityAdapter.ts

import { join } from "@tauri-apps/api/path";
import { exists, mkdir, readDir, remove, rename, writeFile } from "@tauri-apps/plugin-fs";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { commands } from "$ts/glimmer/bindings";
import { PathManager } from "$ts/glimmer/pathManager";

export type CommunitySource = "froststrap" | "kliko";

export interface CommunityMod {
  id: string;
  name: string;
  author?: string;
  description?: string;
  download: string;
  thumbnail?: string;
  source: CommunitySource;
  gradient?: string;
}

export const sourceNames: Record<CommunitySource, string> = {
  froststrap: "Froststrap library",
  kliko: "Kliko library",
};

const FROSTSTRAP_URL =
  "https://raw.githubusercontent.com/RealMeddsam/config/refs/heads/main/Data.json";
const KLIKO_URL =
  "https://raw.githubusercontent.com/klikos-modloader/marketplace/refs/heads/main/index.json";

const FROSTSTRAP_THEME_TYPE = 5;

interface FroststrapEntry {
  id: string;
  name: string;
  download: string;
  author?: string;
  description?: string;
  thumbnail?: string;
  modtype?: number;
  angle?: number;
  gradient?: { offset: number; color: string }[];
}

interface KlikoEntry {
  id: string;
  name: string;
  download: string;
  author?: string;
  description?: string;
  thumbnail?: string;
}

function toGradient(angle = 90, stops: FroststrapEntry["gradient"] = []) {
  if (stops.length < 2) return undefined;
  const parts = stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(", ");
  return `linear-gradient(${angle}deg, ${parts})`;
}

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json();
}

async function fetchFroststrap(): Promise<CommunityMod[]> {
  const data = await getJson<{ communityMods?: FroststrapEntry[] }>(FROSTSTRAP_URL);
  return (data.communityMods ?? [])
    .filter((m) => m.modtype !== FROSTSTRAP_THEME_TYPE)
    .map((m) => ({
      id: `froststrap:${m.id}`,
      name: m.name,
      author: m.author,
      description: m.description,
      download: m.download,
      thumbnail: m.thumbnail,
      source: "froststrap",
      gradient: toGradient(m.angle, m.gradient),
    }));
}

async function fetchKliko(): Promise<CommunityMod[]> {
  const data = await getJson<KlikoEntry[]>(KLIKO_URL);
  return data.map((m) => ({
    id: `kliko:${m.id}`,
    name: m.name,
    author: m.author,
    description: m.description,
    download: m.download,
    thumbnail: m.thumbnail,
    source: "kliko",
  }));
}

let cache: { mods: CommunityMod[]; failed: CommunitySource[] } | null = null;

export async function fetchCommunityMods(force = false) {
  if (cache && !force) return cache;

  const sources: [CommunitySource, () => Promise<CommunityMod[]>][] = [
    ["froststrap", fetchFroststrap],
    ["kliko", fetchKliko],
  ];
  const results = await Promise.allSettled(sources.map(([, load]) => load()));

  const mods: CommunityMod[] = [];
  const failed: CommunitySource[] = [];
  results.forEach((r, i) => {
    if (r.status === "fulfilled") mods.push(...r.value);
    else failed.push(sources[i][0]);
  });

  cache = { mods, failed };
  return cache;
}

/**
 * Downloads a community mod's zip and extracts it into `modDir`. Both libraries ship zips with the
 * mod files (content/, PlatformContent/...) at the root, so they go straight into the mod folder.
 */
export async function downloadCommunityMod(mod: CommunityMod, modDir: string) {
  const res = await tauriFetch(mod.download);
  if (!res.ok) throw new Error(`Failed to download ${mod.name}: ${res.status} ${res.statusText}`);

  const dir = await new PathManager().getCommunityDownloadsDir();
  await mkdir(dir, { recursive: true });
  const zip = await join(dir, `${mod.id.replace(/[^\w-]/g, "_")}.zip`);
  await writeFile(zip, new Uint8Array(await res.arrayBuffer()));

  try {
    const result = await commands.extractZip(zip, modDir);
    if (result.status === "error") throw new Error(`Failed to extract ${mod.name}: ${result.error}`);
  } finally {
    await remove(zip);
  }
  await unwrapModFolder(modDir);
}

/** top folders of a mod as Roblox lays them out; a lone folder with any other name is a wrapper */
const MOD_ROOTS = new Set(["content", "platformcontent", "extracontent", "shaders", "ssl"]);

/**
 * Some zips put the mod in a folder of its own (`VC Robloxian/PlatformContent/...`). Moves the
 * files of such a wrapper up into `modDir`, as many levels as there are.
 */
export async function unwrapModFolder(modDir: string) {
  const macJunk = await join(modDir, "__MACOSX"); // zips made on a Mac carry it next to the wrapper
  if (await exists(macJunk)) await remove(macJunk, { recursive: true });

  for (;;) {
    const entries = await readDir(modDir);
    const [only] = entries;
    if (entries.length !== 1 || !only.isDirectory || MOD_ROOTS.has(only.name.toLowerCase())) return;

    // renamed first, so a child with the wrapper's own name can move up next to it
    const wrapper = await join(modDir, ".glimmer-unwrap");
    await rename(await join(modDir, only.name), wrapper);
    for (const child of await readDir(wrapper)) {
      await rename(await join(wrapper, child.name), await join(modDir, child.name));
    }
    await remove(wrapper, { recursive: true });
  }
}
