import { fetch } from "@tauri-apps/plugin-http";
import { error } from "@tauri-apps/plugin-log";

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
  const res = await fetch(
    `https://apis.roproxy.com/universes/v1/places/${placeId}/universe`,
  );
  if (!res.ok) {
    error(
      `Failed to resolve universeId for placeId ${placeId}: ${res.status} ${res.statusText}`,
    );
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

  const res = await fetch(
    `https://games.roproxy.com/v1/games?universeIds=${universeId}`,
  );
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

export async function getGameThumbnail(
  placeId: number,
): Promise<string | null> {
  const universeId = await resolveUniverseId(placeId);

  const res = await fetch(
    `https://thumbnails.roproxy.com/v1/games/multiget/thumbnails?universeIds=${universeId}&size=768x432&format=Png&isCircular=false`,
  );
  if (!res.ok) {
    error(
      `Failed to fetch game thumbnail for universeId ${universeId}: ${res.status} ${res.statusText}`,
    );
    throw new Error(
      `Failed to fetch game thumbnail for universeId ${universeId}`,
    );
  }

  const json = (await res.json()) as {
    data?: { thumbnails?: { state: string; imageUrl: string }[] }[];
  };
  const thumbnail = json.data?.[0]?.thumbnails?.find(
    (t) => t.state === "Completed",
  );
  return thumbnail?.imageUrl ?? null;
}

export async function getUserName(userId: number) {
  const res = await fetch(`https://users.roproxy.com/v1/users/${userId}/`);

  if (!res.ok) {
    error(
      `Failed to resolve user info for id ${userId}: ${res.status} ${res.statusText}`,
    );
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
  const res = await fetch(
    `https://thumbnails.roproxy.com/v1/users/avatar-headshot?userIds=${userId}&size=420x420&format=Png&isCircular=false`,
  );

  if (!res.ok) {
    error(
      `Failed to resolve user headshot for id ${userId}: ${res.status} ${res.statusText}`,
    );
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
