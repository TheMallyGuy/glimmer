import { appState } from "$lib/appState.svelte";
import {
  AccountLauncher,
  AccountLaunchError,
} from "$ts/roblox/account/launcher";
import type { GameTarget } from "$ts/roblox/game";
import { RobloxDLParser } from "$ts/vendor";
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
): Promise<string[]> {
  if (link.playerLink) return [link.playerLink];

  const id = appState.accounts.activeId;
  const account = appState.accounts.list.find((a) => a.id === id);

  if (link.game) {
    // a game link carries no login ticket, so only one of Glimmer's accounts can sign it in
    if (!account) throw new LaunchError("accountNeeded", "", "");

    report({ step: "signingIn", name: account.displayName }, null);
    try {
      return await launcher.gameArgs(account.id, link.game);
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
