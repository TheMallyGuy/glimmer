import { writeText } from "@tauri-apps/plugin-clipboard-manager";
import { commands } from "$ts/glimmer/bindings";
import { appState, gameState } from "$lib/appState.svelte";
import { getPublicServers } from "./generalRobloxApis";
import { GameLink, type GameTarget } from "./game";
import { Installation } from "./installation/installation";
import { nearbyServer } from "$ts/glimmer/launch/args";

/** what went wrong in an action, so the menu can say it in the person's language */
export type ServerActionFailure = "notInGame" | "noOtherServers" | "unreachable";

export class ServerActionError extends Error {
  constructor(
    readonly failure: ServerActionFailure,
    message: string,
  ) {
    super(message);
  }
}

export interface ServerActionsOptions {
  copy(text: string): Promise<void>;
  random(): number;
}

/** what the in-game menu does with the server the player is in */
export class ServerActions {
  private readonly options: ServerActionsOptions;

  /** the clipboard and the dice, which a test can replace */
  constructor(options: Partial<ServerActionsOptions> = {}) {
    this.options = {
      copy: writeText,
      random: Math.random,
      ...options,
    };
  }

  /** the link a friend can use to join this server */
  async inviteLink(): Promise<string> {
    const { placeId, jobId } = await this.server();
    return `https://glimmer.mallyy.workers.dev/join?placeId=${placeId}&jobId=${jobId}&userId=${gameState.userId ?? 0}&svg=${appState.integrations.discordRpc.customImage.svgUrl ?? ""}`; // get a JOB!!!
  }

  async copyInvite() {
    await this.options.copy(await this.inviteLink());
  }

  /** joins a random other public server of the same game that has room */
  async hop() {
    const { placeId, jobId } = await this.server();
    const others = (await this.publicServers(placeId)).filter(
      (server) => server.id !== jobId && server.playing < server.maxPlayers,
    );
    if (others.length === 0)
      throw new ServerActionError("noOtherServers", "No other servers have space");

    const next = others[Math.floor(this.options.random() * others.length)];
    await this.launch({ placeId, jobId: next.id });
  }

  /** joins a game on any server, in or out of a game: it needs no server from the game state */
  async joinGame(placeId: number) {
    const jobId = await nearbyServer(placeId);
    await this.launch(jobId ? { placeId, jobId } : { placeId });
  }

  /** runs the player with the link of the game: a player that is already open takes the join over, like Fishstrap's hop */
  private async launch(target: GameTarget) {
    // no re-index (it scans the install folders): the index of the last launch is what is needed
    const installation = await Installation.create(false);
    await installation.listInstallations();
    const result = await commands.launch(await installation.getActiveVersionExe(), [
      GameLink.format(target),
    ]);
    if (result.status === "error") throw new Error(result.error);
  }

  /** the server from the game state. A Roblox that closed or crashed never says it left, so an open window is the proof. */
  private async server() {
    const { gameId: placeId, gameServer: jobId } = gameState;
    if (!placeId || !jobId || (await commands.getRobloxHwnd()).status === "error") {
      throw new ServerActionError("notInGame", "You’re not in a game");
    }
    return { placeId, jobId };
  }

  /** the public servers, with any failure to get them said as "unreachable" */
  private async publicServers(placeId: number) {
    try {
      return await getPublicServers(placeId);
    } catch (err) {
      throw new ServerActionError("unreachable", err instanceof Error ? err.message : String(err));
    }
  }
}
