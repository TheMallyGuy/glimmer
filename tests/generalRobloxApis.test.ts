import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getAssetThumbnail,
  getGameIcon,
  getGameInfo,
  getGameName,
  getGameThumbnail,
  getPublicServers,
  getUserHeadShot,
  getUserName,
  resolveUniverseId,
} from "$ts/roblox/generalRobloxApis";
import { jsonResponse, logSpies, resetTauri } from "./helpers/tauri";

const realFetch = globalThis.fetch;
let urls: string[];

/** answer requests by the first route whose key is a substring of the url */
function stubFetch(routes: Record<string, () => ReturnType<typeof jsonResponse>>) {
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    const url = String(input);
    urls.push(url);
    const key = Object.keys(routes).find((k) => url.includes(k));
    if (!key) throw new Error(`unexpected url ${url}`);
    return routes[key]();
  }) as typeof fetch;
}

beforeEach(() => {
  urls = [];
  resetTauri();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("resolveUniverseId", () => {
  test("returns the universe id for a place", async () => {
    stubFetch({ "/places/42/universe": () => jsonResponse({ universeId: 999 }) });
    expect(await resolveUniverseId(42)).toBe(999);
  });

  test("throws and logs on an HTTP error", async () => {
    stubFetch({ "/universe": () => jsonResponse({}, { status: 404, statusText: "Not Found" }) });
    await expect(resolveUniverseId(42)).rejects.toThrow(
      "Failed to resolve universeId for placeId 42",
    );
    expect(logSpies.error).toHaveBeenCalledTimes(1);
  });

  test("throws when the response has no universe id", async () => {
    stubFetch({ "/universe": () => jsonResponse({}) });
    await expect(resolveUniverseId(42)).rejects.toThrow("No universeId found for placeId 42");
  });
});

describe("getGameInfo", () => {
  const universe = { "/places/7/universe": () => jsonResponse({ universeId: 70 }) };

  test("maps the API entry onto GameInfo", async () => {
    stubFetch({
      ...universe,
      "universeIds=70": () =>
        jsonResponse({
          data: [
            {
              name: "Obby",
              description: "jump",
              creator: { name: "builder" },
              playing: 12,
              visits: 3400,
              isContentRestricted: true,
            },
          ],
        }),
    });

    expect(await getGameInfo(7)).toEqual({
      universeId: 70,
      name: "Obby",
      description: "jump",
      creatorName: "builder",
      playing: 12,
      visits: 3400,
      isContentRestricted: true,
    });
  });

  test("falls back when the creator and restriction are missing", async () => {
    stubFetch({
      ...universe,
      "universeIds=70": () =>
        jsonResponse({ data: [{ name: "Obby", description: "", playing: 0, visits: 0 }] }),
    });

    const info = await getGameInfo(7);
    expect(info.creatorName).toBe("Unknown");
    expect(info.isContentRestricted).toBe(false);
  });

  test("throws when the game is not returned", async () => {
    stubFetch({ ...universe, "universeIds=70": () => jsonResponse({ data: [] }) });
    await expect(getGameInfo(7)).rejects.toThrow("No game info found for universeId 70");
  });

  test("throws on an HTTP error", async () => {
    stubFetch({ ...universe, "universeIds=70": () => jsonResponse({}, { status: 500 }) });
    await expect(getGameInfo(7)).rejects.toThrow("Failed to fetch game info for universeId 70");
  });

  test("throws when both proxies are rate limited", async () => {
    stubFetch({ ...universe, "universeIds=70": () => jsonResponse({}, { status: 429 }) });
    await expect(getGameInfo(7)).rejects.toThrow("Cannot fetch domain");
  });

  test("falls back to the second proxy when the first is rate limited", async () => {
    const answer = {
      data: [{ name: "Obby", description: "", playing: 0, visits: 0, creator: { name: "Ann" } }],
    };
    globalThis.fetch = (async (input: RequestInfo | URL) => {
      const url = String(input);
      urls.push(url);
      if (url.includes("universeIds=70")) {
        return url.includes("roproxy.com")
          ? jsonResponse({}, { status: 429 })
          : jsonResponse(answer);
      }
      return universe["/places/7/universe"]();
    }) as typeof fetch;

    expect((await getGameInfo(7)).name).toBe("Obby");
    expect(urls.some((u) => u.includes("rotunnel.com"))).toBe(true);
  });

  test("getGameName returns just the name", async () => {
    stubFetch({
      ...universe,
      "universeIds=70": () =>
        jsonResponse({ data: [{ name: "Obby", description: "", playing: 0, visits: 0 }] }),
    });
    expect(await getGameName(7)).toBe("Obby");
  });
});

describe("getPublicServers", () => {
  test("returns the first 100 public servers of the place", async () => {
    const servers = [{ id: "a", maxPlayers: 15, playing: 3 }];
    stubFetch({ "/games/42/servers/Public": () => jsonResponse({ data: servers }) });

    expect(await getPublicServers(42)).toEqual(servers);
    expect(urls[0]).toBe("https://games.roblox.com/v1/games/42/servers/Public?limit=100");
  });

  test("is empty when Roblox sends no list", async () => {
    stubFetch({ "/servers/Public": () => jsonResponse({}) });

    expect(await getPublicServers(42)).toEqual([]);
  });

  test("throws and logs when Roblox answers with an error", async () => {
    stubFetch({
      "/servers/Public": () => jsonResponse({}, { status: 429, statusText: "Too Many Requests" }),
    });

    await expect(getPublicServers(42)).rejects.toThrow(
      "Roblox answered 429 when asked for the servers of place 42",
    );
    expect(logSpies.error).toHaveBeenCalled();
  });

  test("gives up on a request that never answers", async () => {
    let signal: AbortSignal | undefined;
    globalThis.fetch = ((_url: RequestInfo | URL, init?: RequestInit) => {
      signal = init?.signal ?? undefined;
      return new Promise(() => {});
    }) as unknown as typeof fetch;

    void getPublicServers(42);
    await new Promise((r) => setTimeout(r, 5));

    expect(signal).toBeDefined(); // a timeout is attached
  });
});

describe("getGameThumbnail", () => {
  const universe = { "/places/7/universe": () => jsonResponse({ universeId: 70 }) };

  test("returns the first completed thumbnail", async () => {
    stubFetch({
      ...universe,
      "games/multiget/thumbnails": () =>
        jsonResponse({
          data: [
            {
              thumbnails: [
                { state: "Pending", imageUrl: "pending.png" },
                { state: "Completed", imageUrl: "done.png" },
              ],
            },
          ],
        }),
    });
    expect(await getGameThumbnail(7)).toBe("done.png");
  });

  test("returns null when none are completed", async () => {
    stubFetch({
      ...universe,
      "games/multiget/thumbnails": () =>
        jsonResponse({ data: [{ thumbnails: [{ state: "Pending", imageUrl: "pending.png" }] }] }),
    });
    expect(await getGameThumbnail(7)).toBeNull();
  });

  test("returns null for an empty response", async () => {
    stubFetch({ ...universe, "games/multiget/thumbnails": () => jsonResponse({}) });
    expect(await getGameThumbnail(7)).toBeNull();
  });

  test("throws on an HTTP error", async () => {
    stubFetch({
      ...universe,
      "games/multiget/thumbnails": () => jsonResponse({}, { status: 500 }),
    });
    await expect(getGameThumbnail(7)).rejects.toThrow(
      "Failed to fetch game thumbnail for universeId 70",
    );
  });
});

describe("getAssetThumbnail", () => {
  test("returns the picture of an asset", async () => {
    stubFetch({
      "/v1/assets": () => jsonResponse({ data: [{ state: "Completed", imageUrl: "asset.png" }] }),
    });

    expect(await getAssetThumbnail(123)).toBe("asset.png");
    expect(urls[0]).toContain("assetIds=123");
  });

  test("is null while Roblox has not made the picture", async () => {
    stubFetch({ "/v1/assets": () => jsonResponse({ data: [{ state: "Pending", imageUrl: "" }] }) });

    expect(await getAssetThumbnail(123)).toBeNull();
  });

  test("throws and logs when the request fails", async () => {
    stubFetch({
      "/v1/assets": () => jsonResponse({}, { status: 500, statusText: "Server Error" }),
    });

    await expect(getAssetThumbnail(123)).rejects.toThrow(
      "Failed to fetch the thumbnail of asset 123",
    );
    expect(logSpies.error).toHaveBeenCalled();
  });
});

describe("getUserName", () => {
  test("returns the display name and the login name Roblox calls `name`", async () => {
    stubFetch({
      "/users/5/": () => jsonResponse({ displayName: "Cool Person", name: "coolperson" }),
    });
    expect(await getUserName(5)).toEqual({ displayName: "Cool Person", username: "coolperson" });
  });

  test("throws with the status on failure", async () => {
    stubFetch({ "/users/5/": () => jsonResponse({}, { status: 404, statusText: "Not Found" }) });
    await expect(getUserName(5)).rejects.toThrow(
      "Failed to resolve user info for id 5: 404 Not Found",
    );
    expect(logSpies.error).toHaveBeenCalledTimes(1);
  });
});

describe("getUserHeadShot", () => {
  test("returns the completed headshot", async () => {
    stubFetch({
      "avatar-headshot?userIds=5": () =>
        jsonResponse({
          data: [
            { state: "Blocked", imageUrl: "blocked.png" },
            { state: "Completed", imageUrl: "head.png" },
          ],
        }),
    });
    expect(await getUserHeadShot(5)).toBe("head.png");
  });

  test("returns null when nothing is completed", async () => {
    stubFetch({
      "avatar-headshot": () => jsonResponse({ data: [{ state: "Pending", imageUrl: "x.png" }] }),
    });
    expect(await getUserHeadShot(5)).toBeNull();
  });

  test("throws on an HTTP error", async () => {
    stubFetch({
      "avatar-headshot": () => jsonResponse({}, { status: 503, statusText: "Unavailable" }),
    });
    await expect(getUserHeadShot(5)).rejects.toThrow(
      "Failed to resolve user headshot for id 5: 503 Unavailable",
    );
  });
});

describe("getGameIcon", () => {
  const universe = { "/places/7/universe": () => jsonResponse({ universeId: 70 }) };

  test("returns the first completed icon, asked for by universe", async () => {
    stubFetch({
      ...universe,
      "games/icons": () =>
        jsonResponse({
          data: [
            { state: "Pending", imageUrl: "pending.png" },
            { state: "Completed", imageUrl: "done.png" },
          ],
        }),
    });
    expect(await getGameIcon(7)).toBe("done.png");
    expect(urls[1]).toContain("universeIds=70");
  });

  test("returns null when none is completed, or the answer is empty", async () => {
    stubFetch({
      ...universe,
      "games/icons": () => jsonResponse({ data: [{ state: "Pending", imageUrl: "p.png" }] }),
    });
    expect(await getGameIcon(7)).toBeNull();

    stubFetch({ ...universe, "games/icons": () => jsonResponse({}) });
    expect(await getGameIcon(7)).toBeNull();
  });

  test("throws on an HTTP error", async () => {
    stubFetch({ ...universe, "games/icons": () => jsonResponse({}, { status: 500 }) });
    await expect(getGameIcon(7)).rejects.toThrow("Failed to fetch game icon for universeId 70");
  });
});
