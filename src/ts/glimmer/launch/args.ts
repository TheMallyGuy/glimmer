import { appState } from "$lib/appState.svelte";
import {
  AccountLauncher,
  AccountLaunchError,
} from "$ts/roblox/account/launcher";
import type { GameTarget } from "$ts/roblox/game";
import { RobloxDLParser } from "$ts/vendor";
import { RoValra } from "$ts/glimmer/roValra";
import { LaunchError, type LaunchContext } from "./types";

const parser = new RobloxDLParser();

async function gameOf(link: string): Promise<GameTarget | null> {
  const parsed = await parser.parseProtocolLink(link).catch(() => null);
  if (parsed?.data.type !== "joinPlace") return null;

  const { placeId, gameInstanceId, linkCode, launchData } = parsed.data.params;
  // the parser checks the query's patterns on website links only, so a protocol link's placeId can be anything
  if (!/^\d+$/.test(placeId) || Number(placeId) <= 0) return null;
  return {
    placeId: Number(placeId),
    ...(gameInstanceId && { jobId: gameInstanceId }),
    ...(linkCode && { linkCode }),
    ...(launchData && { launchData }),
  };
}

/**
 * how a link launches: a roblox-player: link goes to the player as it is, a roblox:// join link
 * names a game to sign in to, and any other roblox:// link (a profile, the avatar page...) goes to the
 * player as it is too
 */
export async function parseLaunchLink(link: string | null | undefined) {
  if (link && /^roblox-player:/i.test(link)) return { playerLink: link, game: null };
  if (!link || !/^roblox:/i.test(link)) return { playerLink: null, game: null };

  const game = await gameOf(link);
  return { playerLink: game ? null : link, game };
}

/**
 * a server of `placeId` near the person (`integrations.nearbyServer`), or "" to let Roblox pick one:
 * when the setting is off, when RoValra knows no server, and when the lookup fails
 */
export async function nearbyServer(placeId: number, roValra = new RoValra()): Promise<string> {
  const setting = appState.integrations.nearbyServer;
  if (!setting.enabled) return "";
  try {
    return await roValra.getClosestServer(placeId, setting.randomize);
  } catch (e) {
    console.error("failed to find a nearby server, Roblox picks one:", e);
    return "";
  }
}

/**
 * a roblox-player: link from the website's Play button, sent to the server `find` gives for its place.
 * Only a plain game join (RequestGame) is changed: following a friend or a private server keeps its link.
 */
export async function withServer(link: string, find: (placeId: number) => Promise<string>): Promise<string> {
  const match = /placelauncherurl:([^+]+)/i.exec(link);
  if (!match) return link;

  const launcher = new URL(decodeURIComponent(match[1]));
  const placeId = Number(launcher.searchParams.get("placeId"));
  if (launcher.searchParams.get("request") !== "RequestGame" || !placeId) return link;

  const jobId = await find(placeId);
  if (!jobId) return link;

  launcher.searchParams.set("request", "RequestGameJob");
  launcher.searchParams.set("gameId", jobId);
  return link.replace(match[0], () => `placelauncherurl:${encodeURIComponent(launcher.toString())}`);
}

/** a failure of the account launch as one the window can word, anything else as it is */
function accountFailure(e: unknown, name: string) {
  if (!(e instanceof AccountLaunchError)) return e;
  return new LaunchError(
    e.kind === "expired"
      ? "accountExpired"
      : e.kind === "missing"
        ? "accountMissing"
        : "accountFailed",
    name,
    e.message,
  );
}

/**
 * the arguments that sign the player in as the selected account, or none to leave Roblox on its
 * own login. Built right before launching because the login ticket expires within a minute.
 */
export async function launchArgs(
  { isStudio, link, report }: LaunchContext,
  launcher: Pick<AccountLauncher, "args" | "gameArgs"> = new AccountLauncher(),
  findServer: (placeId: number) => Promise<string> = nearbyServer,
): Promise<string[]> {
  const near = async (placeId: number) => {
    if (isStudio || !appState.integrations.nearbyServer.enabled) return "";
    report({ step: "findingServer" }, null);
    return findServer(placeId);
  };

  if (link.playerLink) return [await withServer(link.playerLink, near)];

  const id = appState.accounts.activeId;
  const account = appState.accounts.list.find((a) => a.id === id);

  if (link.game) {
    // a game link carries no login ticket, so only one of Glimmer's accounts can sign it in
    if (!account) throw new LaunchError("accountNeeded", "", "");

    // a link that already names a server (or a private one) keeps it
    const jobId = link.game.jobId || link.game.linkCode ? "" : await near(link.game.placeId);
    const game = jobId ? { ...link.game, jobId } : link.game;

    // signed in after the server is found, since the ticket expires within a minute
    report({ step: "signingIn", name: account.displayName }, null);
    try {
      return await launcher.gameArgs(account.id, game);
    } catch (e) {
      throw accountFailure(e, account.displayName);
    }
  }

  if (isStudio || !account) return [];

  report({ step: "signingIn", name: account.displayName }, null);
  try {
    return await launcher.args(account.id);
  } catch (e) {
    throw accountFailure(e, account.displayName);
  }
}
