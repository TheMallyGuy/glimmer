import { fetch } from "@tauri-apps/plugin-http";
import { error } from "@tauri-apps/plugin-log";
import { getRobloxUrl } from "./proxies";

export interface GameInfo {
  universeId: number;
  name: string;
  description: string;
  creatorName: string;
  playing: number;
  visits: number;
  isContentRestricted: boolean;
}

/** placeId -> universeId. Most Roblox game info APIs only accept universeId. */
export async function resolveUniverseId(placeId: number): Promise<number> {
  const res = await getRobloxUrl(`https://apis.roblox.com/universes/v1/places/${placeId}/universe`);

  if (!res.ok) {
    error(`Failed to resolve universeId for placeId ${placeId}: ${res.status} ${res.statusText}`);
    throw new Error(`Failed to resolve universeId for placeId ${placeId}`);
  }

  const json = (await res.json()) as { universeId?: number };
  if (!json.universeId) {
    throw new Error(`No universeId found for placeId ${placeId}`);
  }

  return json.universeId;
}

export async function getGameInfo(placeId: number): Promise<GameInfo> {
  const universeId = await resolveUniverseId(placeId);

  const res = await getRobloxUrl(`https://games.roblox.com/v1/games?universeIds=${universeId}`);
  if (!res.ok) {
    error(
      `Failed to fetch game info for universeId ${universeId}: ${res.status} ${res.statusText}`,
    );
    throw new Error(`Failed to fetch game info for universeId ${universeId}`);
  }

  const json = (await res.json()) as {
    data?: {
      name: string;
      description: string;
      creator?: { name: string };
      playing: number;
      visits: number;
      isContentRestricted?: boolean;
    }[];
  };
  const entry = json.data?.[0];
  if (!entry) {
    throw new Error(`No game info found for universeId ${universeId}`);
  }

  return {
    universeId,
    name: entry.name,
    description: entry.description,
    creatorName: entry.creator?.name ?? "Unknown",
    playing: entry.playing,
    visits: entry.visits,
    isContentRestricted: entry.isContentRestricted ?? false,
  };
}

export async function getGameName(placeId: number): Promise<string> {
  return (await getGameInfo(placeId)).name;
}

export async function getGameThumbnail(placeId: number): Promise<string | null> {
  const universeId = await resolveUniverseId(placeId);

  const res = await getRobloxUrl(
    `https://thumbnails.roblox.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
  );
  if (!res.ok) {
    error(
      `Failed to fetch game thumbnail for universeId ${universeId}: ${res.status} ${res.statusText}`,
    );
    throw new Error(`Failed to fetch game thumbnail for universeId ${universeId}`);
  }

  const json = (await res.json()) as {
    data?: { thumbnails?: { state: string; imageUrl: string }[] }[];
  };
  const thumbnail = json.data?.[0]?.thumbnails?.find((t) => t.state === "Completed");
  return thumbnail?.imageUrl ?? null;
}

/** the square icon of a game, or null when Roblox has none (yet) */
export async function getGameIcon(placeId: number): Promise<string | null> {
  const universeId = await resolveUniverseId(placeId);

  const res = await getRobloxUrl(
    `https://thumbnails.roblox.com/v1/games/icons?universeIds=${universeId}&size=150x150&format=Png&isCircular=false`,
  );
  if (!res.ok) {
    error(
      `Failed to fetch game icon for universeId ${universeId}: ${res.status} ${res.statusText}`,
    );
    throw new Error(`Failed to fetch game icon for universeId ${universeId}`);
  }

  const json = (await res.json()) as {
    data?: { state: string; imageUrl: string }[];
  };
  return json.data?.find((t) => t.state === "Completed")?.imageUrl ?? null;
}

/** the picture of an asset (the id a game gives for its Discord presence images), or null when Roblox has none (yet) */
export async function getAssetThumbnail(assetId: number): Promise<string | null> {
  const res = await getRobloxUrl(
    `https://thumbnails.roblox.com/v1/assets?assetIds=${assetId}&size=512x512&format=Png&isCircular=false`,
  );
  if (!res.ok) {
    error(`Failed to fetch the thumbnail of asset ${assetId}: ${res.status} ${res.statusText}`);
    throw new Error(`Failed to fetch the thumbnail of asset ${assetId}`);
  }

  const json = (await res.json()) as {
    data?: { state: string; imageUrl: string }[];
  };
  return json.data?.find((t) => t.state === "Completed")?.imageUrl ?? null;
}

/** a server of the public list of a game */
export interface PublicServer {
  /** the job id */
  id: string;
  maxPlayers: number;
  playing: number;
}

/** a request that never answers must not leave the caller waiting for ever */
const PUBLIC_SERVERS_TIMEOUT_MS = 10_000;

/** the first page of the public servers of a game, which is as many as one request gives (100) */
export async function getPublicServers(placeId: number): Promise<PublicServer[]> {
  const res = await fetch(`https://games.roblox.com/v1/games/${placeId}/servers/Public?limit=100`, {
    signal: AbortSignal.timeout(PUBLIC_SERVERS_TIMEOUT_MS),
  });
  if (!res.ok) {
    error(`Failed to fetch public servers for placeId ${placeId}: ${res.status} ${res.statusText}`);
    throw new Error(`Roblox answered ${res.status} when asked for the servers of place ${placeId}`);
  }

  const json = (await res.json()) as { data?: PublicServer[] };
  return json.data ?? [];
}

export async function getUserName(userId: number) {
  const res = await getRobloxUrl(`https://users.roblox.com/v1/users/${userId}/`);

  if (!res.ok) {
    error(`Failed to resolve user info for id ${userId}: ${res.status} ${res.statusText}`);
    throw new Error(
      `Failed to resolve user info for id ${userId}: ${res.status} ${res.statusText}`,
    );
  }

  const json = (await res.json()) as {
    /** the account's login name, which Roblox calls `name` */
    name: string;
    displayName: string;
  };

  return { displayName: json.displayName, username: json.name };
}

export async function getUserHeadShot(userId: number) {
  const res = await getRobloxUrl(
    `https://thumbnails.roblox.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
  );

  if (!res.ok) {
    error(`Failed to resolve user headshot for id ${userId}: ${res.status} ${res.statusText}`);
    throw new Error(
      `Failed to resolve user headshot for id ${userId}: ${res.status} ${res.statusText}`,
    );
  }

  const json = (await res.json()) as {
    data?: { state: string; imageUrl: string }[];
  };

  const thumbnail = json.data?.find((t) => t.state === "Completed");
  return thumbnail?.imageUrl ?? null;
}
