// from https://github.com/TheMallyGuy/crush/blob/master/src/lib/communityAdapter.ts

export type CommunitySource = 'froststrap' | 'kliko';

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
    froststrap: 'Froststrap library',
    kliko: 'Kliko library',
};

const FROSTSTRAP_URL = 'https://raw.githubusercontent.com/RealMeddsam/config/refs/heads/main/Data.json';
const KLIKO_URL = 'https://raw.githubusercontent.com/klikos-modloader/marketplace/refs/heads/main/index.json';

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

function toGradient(angle = 90, stops: FroststrapEntry['gradient'] = []) {
    if (stops.length < 2) return undefined;
    const parts = stops.map((s) => `${s.color} ${Math.round(s.offset * 100)}%`).join(', ');
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
            source: 'froststrap',
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
        source: 'kliko',
    }));
}

let cache: { mods: CommunityMod[]; failed: CommunitySource[] } | null = null;

export async function fetchCommunityMods(force = false) {
    if (cache && !force) return cache;

    const sources: [CommunitySource, () => Promise<CommunityMod[]>][] = [
        ['froststrap', fetchFroststrap],
        ['kliko', fetchKliko],
    ];
    const results = await Promise.allSettled(sources.map(([, load]) => load()));

    const mods: CommunityMod[] = [];
    const failed: CommunitySource[] = [];
    results.forEach((r, i) => {
        if (r.status === 'fulfilled') mods.push(...r.value);
        else failed.push(sources[i][0]);
    });

    cache = { mods, failed };
    return cache;
}