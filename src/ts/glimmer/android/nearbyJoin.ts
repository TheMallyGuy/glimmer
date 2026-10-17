import { appState, gameState, setGameState } from "$lib/appState.svelte";
import { GameLink } from "$ts/roblox/game";
import { nearbyServer } from "$ts/glimmer/launch/args";
import { launchOnAndroid } from "./launch";
import { confirm } from "@tauri-apps/plugin-dialog";
import { notify } from "../notify";
import { info } from "@tauri-apps/plugin-log";

export interface NearbyJoinDeps {
  find: (placeId: number) => Promise<string>;
  launch: typeof launchOnAndroid;
}


export async function movedToNearbyServer(
  placeId: number,
  joinedServer: string,
  deps: NearbyJoinDeps = { find: nearbyServer, launch: launchOnAndroid },
): Promise<boolean> {
  if (!appState.integrations.nearbyServer.enabled) return false;
  if (gameState.serverJoinedTmp) {
    setGameState({ serverJoinedTmp: false });
    return false;
  }

  const jobId = await deps.find(placeId);
  if (!jobId || jobId === joinedServer) return false;

  // set before the restart, so the next join line can't come in first
  setGameState({ serverJoinedTmp: true });
  info("changing server onto a better one")
  // the flags were written at launch and stay on the phone, so they are left alone
  const result = await deps.launch({ deeplink: GameLink.format({ placeId, jobId }), flags: null });
  await notify({"title" :  "Server Changed", body: "We're moved you to a better server!"})
  if (result === "started" || result === "startedNoFlags") return true;

  setGameState({ serverJoinedTmp: false });
  console.error(`could not move to a nearby server: ${result}`);
  return false;
}
