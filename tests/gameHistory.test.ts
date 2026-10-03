import { beforeEach, describe, expect, test } from "bun:test";
import { GameHistory, MAX_GAMES } from "$ts/roblox/gameHistory";
import { fakeFs } from "./helpers/fakeFs";
import { resetTauri } from "./helpers/tauri";

const FILE = "/appdata/games.json";

beforeEach(() => {
    resetTauri();
    fakeFs.reset();
    fakeFs.seedDir("/appdata");
});

describe("GameHistory", () => {
    test("is empty before anything was played", async () => {
        expect(await new GameHistory().list()).toEqual([]);
    });

    test("record keeps a game, and joining it again counts a play and updates the name", async () => {
        const history = new GameHistory();
        await history.record(1, "Old name", 100);
        await history.record(1, "New name", 200);

        expect(await history.list()).toEqual([{ placeId: 1, name: "New name", plays: 2, lastPlayed: 200 }]);
    });

    test("lists the last played game first", async () => {
        const history = new GameHistory();
        await history.record(1, "A", 100);
        await history.record(2, "B", 300);
        await history.record(3, "C", 200);

        expect((await history.list()).map((g) => g.placeId)).toEqual([2, 3, 1]);
    });

    test("keeps only the newest MAX_GAMES games", async () => {
        const history = new GameHistory();
        const games = Array.from({ length: MAX_GAMES + 1 }, (_, i) => ({ placeId: i + 1, name: "g", plays: 1, lastPlayed: i }));
        fakeFs.seed(FILE, JSON.stringify(games));

        await history.record(99999, "new", 10_000);

        const list = await history.list();
        expect(list).toHaveLength(MAX_GAMES);
        expect(list[0].placeId).toBe(99999);
        expect(list.some((g) => g.placeId === 1)).toBe(false);
    });

    test("a file that can't be read counts as no history", async () => {
        fakeFs.seed(FILE, "{ not json");

        expect(await new GameHistory().list()).toEqual([]);
    });

    test("clear forgets every game", async () => {
        const history = new GameHistory();
        await history.record(1, "A");
        await history.clear();

        expect(await history.list()).toEqual([]);
    });
});
