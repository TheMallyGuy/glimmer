import { exists, readTextFile, writeTextFile } from "@tauri-apps/plugin-fs";
import { PathManager } from "$ts/pathManager";

/** a game the person has joined */
export interface PlayedGame {
  placeId: number;
  name: string;
  /** how many times it was joined */
  plays: number;
  /** when it was last joined, as ms since 1970 */
  lastPlayed: number;
}

/** the link API takes at most this many games per person, so older games are dropped from the list */
export const MAX_GAMES = 1000;

export class GameHistory {
  constructor(private readonly paths = new PathManager()) { }

  /** the games, last played first */
  async list(): Promise<PlayedGame[]> {
    const file = await this.paths.getGameHistoryFile();
    if (!(await exists(file))) return [];

    try {
      const games = JSON.parse(await readTextFile(file)) as PlayedGame[];
      return games.sort((a, b) => b.lastPlayed - a.lastPlayed);
    } catch {
      return []; // a file that can't be read is the same as no history
    }
  }

  /** notes a join of a game */
  async record(placeId: number, name: string, now = Date.now()) {
    const games = await this.list();
    const known = games.find((g) => g.placeId === placeId);

    if (known) {
      known.name = name;
      known.plays++;
      known.lastPlayed = now;
    } else {
      games.push({ placeId, name, plays: 1, lastPlayed: now });
    }

    await this.save(games.sort((a, b) => b.lastPlayed - a.lastPlayed).slice(0, MAX_GAMES));
  }

  async clear() {
    await this.save([]);
  }

  private async save(games: PlayedGame[]) {
    await writeTextFile(await this.paths.getGameHistoryFile(), JSON.stringify(games));
  }
}
