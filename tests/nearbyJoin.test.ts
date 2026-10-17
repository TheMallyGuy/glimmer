import { beforeEach, describe, expect, mock, test } from "bun:test";

const gameState: Record<string, unknown> = {};
const appState = { integrations: { nearbyServer: { enabled: true, randomize: false } } };
mock.module("$lib/appState.svelte", () => ({
    appState,
    gameState,
    setGameState: (patch: Record<string, unknown>) => void Object.assign(gameState, patch),
}));

const { movedToNearbyServer } = await import("$ts/glimmer/android/nearbyJoin");

const PLACE_ID = 1818;
const JOINED = "0a1b2c3d-0000-4000-8000-0123456789ab";
const NEARBY = "11111111-0000-4000-8000-0123456789ab";

function deps(found = NEARBY, result = "started") {
    const launches: { deeplink?: string; flags: unknown }[] = [];
    return {
        launches,
        find: async () => found,
        launch: async (options: { deeplink?: string; flags: unknown }) => {
            launches.push(options);
            return result as "started";
        },
    };
}

beforeEach(() => {
    for (const key of Object.keys(gameState)) delete gameState[key];
    appState.integrations.nearbyServer.enabled = true;
});

describe("movedToNearbyServer", () => {
    test("restarts Roblox on a link to the nearby server", async () => {
        const d = deps();
        expect(await movedToNearbyServer(PLACE_ID, JOINED, d)).toBe(true);
        expect(d.launches).toEqual([
            { deeplink: `roblox://experiences/start?placeId=${PLACE_ID}&gameInstanceId=${NEARBY}`, flags: null },
        ]);
        expect(gameState.serverJoinedTmp).toBe(true);
    });

    test("keeps the join that follows, as it is the nearby one", async () => {
        const d = deps();
        await movedToNearbyServer(PLACE_ID, JOINED, d);
        expect(await movedToNearbyServer(PLACE_ID, NEARBY, d)).toBe(false);
        expect(d.launches).toHaveLength(1);
        expect(gameState.serverJoinedTmp).toBe(false);
    });

    test("stays when the setting is off, no server is found or it is the one joined", async () => {
        appState.integrations.nearbyServer.enabled = false;
        expect(await movedToNearbyServer(PLACE_ID, JOINED, deps())).toBe(false);
        appState.integrations.nearbyServer.enabled = true;
        expect(await movedToNearbyServer(PLACE_ID, JOINED, deps(""))).toBe(false);
        expect(await movedToNearbyServer(PLACE_ID, JOINED, deps(JOINED))).toBe(false);
        expect(gameState.serverJoinedTmp).toBeUndefined();
    });

    test("stays, and tries again on the next join, when Roblox does not restart", async () => {
        expect(await movedToNearbyServer(PLACE_ID, JOINED, deps(NEARBY, "failed"))).toBe(false);
        expect(gameState.serverJoinedTmp).toBe(false);
    });
});
