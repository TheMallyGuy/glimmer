import { beforeEach, describe, expect, mock, test } from "bun:test";
import { AccountLaunchError } from "$ts/roblox/account/launcher";

// appState.svelte.ts and mods.svelte.ts use runes, so they are swapped for plain objects. A mock of a module that
// is mocked again later (logProcess.test.ts) has to name every export of the real one, or the later mock can't add it.
const appState = {
  accounts: {
    list: [] as { id: string; name: string; displayName: string }[],
    activeId: null as string | null,
  },
  integrations: {
    nearbyServer: { enabled: false, randomize: false },
  },
};
mock.module("$lib/appState.svelte", () => ({
  appState,
  gameState: {},
  setGameState: () => {},
  loadAppState: async () => {},
  rememberFleasionPath: async () => {},
}));
mock.module("$lib/mods.svelte", () => ({ loadMods: async () => {}, applyMods: async () => {} }));

const { LaunchError, launchArgs, parseLaunchLink } = await import("$ts/glimmer/launch");
const { nearbyServer, withServer } = await import("$ts/glimmer/launch/args");
import type { LaunchContext, LaunchStatus } from "$ts/glimmer/launch";

const GAME_LINK = "roblox://experiences/start?placeId=1818&gameInstanceId=abc";
const PLAYER_LINK = "roblox-player:1+launchmode:play+gameinfo:T";
const PROFILE_LINK = "roblox://navigation/profile?userId=1";

let reported: LaunchStatus[];
let launcher: { args: ReturnType<typeof mock>; gameArgs: ReturnType<typeof mock> };

const context = async (link: string | null, isStudio = false): Promise<LaunchContext> => ({
  isStudio,
  link: await parseLaunchLink(link),
  report: (status) => void reported.push(status),
});
let findServer: ReturnType<typeof mock>;
const args = async (link: string | null, isStudio = false) =>
  launchArgs(await context(link, isStudio), launcher as never, findServer as never);

function signedInAs(displayName = "Cool Person") {
  appState.accounts.list = [{ id: "7", name: "coolperson", displayName }];
  appState.accounts.activeId = "7";
}

beforeEach(() => {
  reported = [];
  appState.accounts.list = [];
  appState.accounts.activeId = null;
  appState.integrations.nearbyServer = { enabled: false, randomize: false };
  findServer = mock(async () => "near");
  launcher = {
    args: mock(async (id: string) => [`launch:${id}`]),
    gameArgs: mock(async (id: string, game: { placeId: number }) => [`game:${id}:${game.placeId}`]),
  };
});

describe("parseLaunchLink", () => {
  test("a roblox-player: link goes to the player as it is", async () => {
    expect(await parseLaunchLink(PLAYER_LINK)).toEqual({ playerLink: PLAYER_LINK, game: null });
  });

  test("a game link names a game, and is not passed on as it is", async () => {
    expect(await parseLaunchLink(GAME_LINK)).toEqual({
      playerLink: null,
      game: { placeId: 1818, jobId: "abc" },
    });
  });

  test("a private server link keeps its link code", async () => {
    expect(await parseLaunchLink("roblox://experiences/start?placeId=7&linkCode=9876")).toEqual({
      playerLink: null,
      game: { placeId: 7, linkCode: "9876" },
    });
  });

  test("a join link with a bad place id is not a game", async () => {
    const link = "roblox://experiences/start?placeId=abc";
    expect(await parseLaunchLink(link)).toEqual({ playerLink: link, game: null });
  });

  test("any other roblox:// link goes to the player as it is", async () => {
    expect(await parseLaunchLink(PROFILE_LINK)).toEqual({ playerLink: PROFILE_LINK, game: null });
  });

  test.each([null, undefined, "", "https://www.roblox.com/games/1818", "glimmer:open"])(
    "%p is no launch link",
    async (link) => {
      expect(await parseLaunchLink(link)).toEqual({ playerLink: null, game: null });
    },
  );
});

describe("launchArgs", () => {
  test("passes a roblox-player: link on as it is, without signing in", async () => {
    signedInAs();

    expect(await args(PLAYER_LINK)).toEqual([PLAYER_LINK]);
    expect(launcher.args).not.toHaveBeenCalled();
    expect(launcher.gameArgs).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
  });

  test("passes another roblox:// link on as it is, without signing in", async () => {
    signedInAs();

    expect(await args(PROFILE_LINK)).toEqual([PROFILE_LINK]);
    expect(launcher.gameArgs).not.toHaveBeenCalled();
  });

  test("signs a game link in as the active account", async () => {
    signedInAs("Cool Person");

    expect(await args(GAME_LINK)).toEqual(["game:7:1818"]);
    expect(launcher.gameArgs).toHaveBeenCalledWith("7", { placeId: 1818, jobId: "abc" });
    expect(reported).toEqual([{ step: "signingIn", name: "Cool Person" }]);
  });

  test("needs an account for a game link, since the link has no login of its own", async () => {
    const failure = await args(GAME_LINK).catch((e) => e);

    expect(failure).toBeInstanceOf(LaunchError);
    expect(failure.kind).toBe("accountNeeded");
    expect(launcher.gameArgs).not.toHaveBeenCalled();
  });

  test("a plain launch signs in as the active account", async () => {
    signedInAs();

    expect(await args(null)).toEqual(["launch:7"]);
    expect(reported).toEqual([{ step: "signingIn", name: "Cool Person" }]);
  });

  test("a plain launch with no account leaves Roblox on its own login", async () => {
    expect(await args(null)).toEqual([]);
    expect(launcher.args).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
  });

  test("an active id that matches no account counts as no account", async () => {
    signedInAs();
    appState.accounts.activeId = "gone";

    expect(await args(null)).toEqual([]);
  });

  test("Studio never signs in", async () => {
    signedInAs();

    expect(await args(null, true)).toEqual([]);
    expect(launcher.args).not.toHaveBeenCalled();
  });
});

describe("launchArgs: an account that can't sign in", () => {
  test.each([
    ["expired", "accountExpired"],
    ["missing", "accountMissing"],
    ["failed", "accountFailed"],
  ] as const)(
    "%s is told as %s, with the name of the account and what went wrong",
    async (kind, expected) => {
      signedInAs("Cool Person");
      launcher.args = mock(async () => {
        throw new AccountLaunchError(kind, "the reason");
      });

      const failure = await args(null).catch((e) => e);

      expect(failure).toBeInstanceOf(LaunchError);
      expect(failure).toMatchObject({
        kind: expected,
        account: "Cool Person",
        message: "the reason",
      });
    },
  );

  test("the same goes for a game link", async () => {
    signedInAs("Cool Person");
    launcher.gameArgs = mock(async () => {
      throw new AccountLaunchError("expired", "the reason");
    });

    await expect(args(GAME_LINK)).rejects.toMatchObject({
      kind: "accountExpired",
      account: "Cool Person",
    });
  });

  test("any other failure comes through as it is", async () => {
    signedInAs();
    const boom = new Error("network is down");
    launcher.args = mock(async () => {
      throw boom;
    });

    expect(await args(null).catch((e) => e)).toBe(boom);
  });
});

describe("launchArgs: join a nearby server", () => {
  const WEB_LINK =
    "roblox-player:1+launchmode:play+gameinfo:T+launchtime:1" +
    `+placelauncherurl:${encodeURIComponent("https://www.roblox.com/Game/PlaceLauncher.ashx?request=RequestGame&browserTrackerId=1&placeId=1818&isPlayTogetherGame=false")}` +
    "+browsertrackerid:1+robloxLocale:en_us";
  const launcherOf = (link: string) =>
    new URL(decodeURIComponent(/placelauncherurl:([^+]+)/.exec(link)![1])).searchParams;

  beforeEach(() => {
    appState.integrations.nearbyServer.enabled = true;
  });

  test("sends a game link with no server to the nearby one, found before signing in", async () => {
    signedInAs("Cool Person");

    await args("roblox://experiences/start?placeId=1818");

    expect(findServer).toHaveBeenCalledWith(1818);
    expect(launcher.gameArgs).toHaveBeenCalledWith("7", { placeId: 1818, jobId: "near" });
    expect(reported).toEqual([
      { step: "findingServer" },
      { step: "signingIn", name: "Cool Person" },
    ]);
  });

  test("keeps the server or private server a link already names", async () => {
    signedInAs();

    await args(GAME_LINK);
    await args("roblox://experiences/start?placeId=1&linkCode=9876");

    expect(findServer).not.toHaveBeenCalled();
  });

  test("joins any server when none is found", async () => {
    signedInAs();
    findServer = mock(async () => "");

    await args("roblox://experiences/start?placeId=1818");

    expect(launcher.gameArgs).toHaveBeenCalledWith("7", { placeId: 1818 });
  });

  test("turns the website's Play link into a join of the nearby server, keeping the rest", async () => {
    const [link] = await args(WEB_LINK);

    expect(findServer).toHaveBeenCalledWith(1818);
    expect(launcherOf(link).get("request")).toBe("RequestGameJob");
    expect(launcherOf(link).get("gameId")).toBe("near");
    expect(launcherOf(link).get("placeId")).toBe("1818");
    expect(
      link.startsWith("roblox-player:1+launchmode:play+gameinfo:T+launchtime:1+placelauncherurl:"),
    ).toBe(true);
    expect(link.endsWith("+browsertrackerid:1+robloxLocale:en_us")).toBe(true);
  });

  test("leaves following a friend and other links as they are", async () => {
    const follow = WEB_LINK.replace("RequestGame", "RequestFollowUser");

    expect(await args(follow)).toEqual([follow]);
    expect(await args(PLAYER_LINK)).toEqual([PLAYER_LINK]);
    expect(await args(PROFILE_LINK)).toEqual([PROFILE_LINK]);
    expect(findServer).not.toHaveBeenCalled();
  });

  test("does nothing while the setting is off", async () => {
    appState.integrations.nearbyServer.enabled = false;

    expect(await args(WEB_LINK)).toEqual([WEB_LINK]);
    expect(findServer).not.toHaveBeenCalled();
    expect(reported).toEqual([]);
  });
});

describe("nearbyServer", () => {
  const roValra = (getClosestServer: (placeId: number, randomize: boolean) => Promise<string>) =>
    ({ getClosestServer }) as never;

  test("asks RoValra with the randomize setting", async () => {
    appState.integrations.nearbyServer = { enabled: true, randomize: true };
    const get = mock(async () => "job");

    expect(await nearbyServer(1818, roValra(get))).toBe("job");
    expect(get).toHaveBeenCalledWith(1818, true);
  });

  test("gives no server when the lookup fails, so Roblox picks one", async () => {
    appState.integrations.nearbyServer.enabled = true;

    expect(
      await nearbyServer(
        1818,
        roValra(async () => {
          throw new Error("offline");
        }),
      ),
    ).toBe("");
  });

  test("asks nothing while the setting is off", async () => {
    const get = mock(async () => "job");

    expect(await nearbyServer(1818, roValra(get))).toBe("");
    expect(get).not.toHaveBeenCalled();
  });
});

describe("withServer", () => {
  test("leaves a link with no place launcher as it is", async () => {
    expect(await withServer(PLAYER_LINK, async () => "job")).toBe(PLAYER_LINK);
  });
});
