import { beforeEach, describe, expect, test } from "bun:test";
import { BloxstrapRpc } from "$ts/roblox/bloxstrapRpc";
import type { ActivityOptions } from "$ts/roblox/discordRpc";

const original: ActivityOptions = {
  state: "Playing Obby Land",
  startTimestamp: 1_000,
  largeImage: "icon.png",
  largeText: "icon text",
  buttons: [{ label: "View Game", url: "https://roblox.com/games/1" }],
};

let updates: Partial<ActivityOptions>[];
let logs: string[];
let clock: number;
let accountShown: boolean;
let thumbnails: Record<number, string | null>;
let thumbnailCalls: number[];
let rpc: BloxstrapRpc;

const buttons = (launchData?: string) => [
  { label: "View Game", url: "https://roblox.com/games/1" },
  { label: "Join Game", url: `roblox://join?launchData=${launchData ?? ""}` },
];

/** each message is sent a second apart, so the rate limit stays out of the way unless a test is about it */
async function send(command: string, data: unknown) {
  clock += 1500;
  await rpc.handle(command, data);
}

beforeEach(async () => {
  updates = [];
  logs = [];
  clock = 0;
  accountShown = false;
  thumbnails = { 111: "small.png", 222: "large.png" };
  thumbnailCalls = [];
  rpc = new BloxstrapRpc({
    update: async (patch) => void updates.push(patch),
    thumbnail: async (id) => {
      thumbnailCalls.push(id);
      if (!(id in thumbnails)) throw new Error("no such asset");
      return thumbnails[id];
    },
    accountShown: () => accountShown,
    log: (message) => void logs.push(message),
    now: () => clock,
  });
  await rpc.begin(original, buttons);
});

describe("SetRichPresence: texts and times", () => {
  test("sets the details and the state", async () => {
    await send("SetRichPresence", { details: "Round 3", state: "Winning" });

    expect(updates).toEqual([{ details: "Round 3", state: "Winning" }]);
  });

  test("only changes what the message has", async () => {
    await send("SetRichPresence", { details: "Round 3" });

    expect(updates).toEqual([{ details: "Round 3" }]);
  });

  test("<reset> goes back to what Glimmer set", async () => {
    await send("SetRichPresence", { details: "<reset>", state: "<reset>" });

    expect(updates).toEqual([{ details: undefined, state: "Playing Obby Land" }]);
  });

  test("drops a text longer than 128 characters and keeps the rest of the message", async () => {
    await send("SetRichPresence", { details: "x".repeat(129), state: "ok" });

    expect(updates).toEqual([{ state: "ok" }]);
    expect(logs[0]).toContain("details cannot be longer than 128");
  });

  test("times are seconds in the message and a time of 0 takes the timestamp away", async () => {
    await send("SetRichPresence", { timeStart: 2000, timeEnd: 3000 });
    await send("SetRichPresence", { timeStart: 0, timeEnd: 0 });

    expect(updates).toEqual([
      { startTimestamp: 2_000_000, endTimestamp: 3_000_000 },
      { startTimestamp: undefined, endTimestamp: undefined },
    ]);
  });

  test("ignores a message that is not an object", async () => {
    await send("SetRichPresence", "hello");
    await send("SetRichPresence", null);

    expect(updates).toEqual([]);
  });
});

describe("SetRichPresence: pictures", () => {
  test("loads the picture of an asset and sets its hover text", async () => {
    await send("SetRichPresence", { largeImage: { assetId: 222, hoverText: "A boss" } });

    expect(updates).toEqual([{ largeText: "A boss", largeImage: "large.png" }]);
  });

  test("sets the small image too", async () => {
    await send("SetRichPresence", { smallImage: { assetId: 111, hoverText: "Level 9" } });

    expect(updates).toEqual([{ smallText: "Level 9", smallImage: "small.png" }]);
  });

  test("leaves the small image alone while the person's account is shown there", async () => {
    accountShown = true;
    await send("SetRichPresence", { smallImage: { assetId: 111 }, largeImage: { assetId: 222 } });

    expect(updates).toEqual([{ largeImage: "large.png" }]);
    expect(thumbnailCalls).toEqual([222]);
  });

  test("clear takes the picture away", async () => {
    await send("SetRichPresence", { largeImage: { clear: true } });

    expect(updates).toEqual([{ largeImage: undefined }]);
  });

  test("reset goes back to the picture and text Glimmer set", async () => {
    await send("SetRichPresence", { largeImage: { reset: true } });

    expect(updates).toEqual([{ largeImage: "icon.png", largeText: "icon text" }]);
  });

  test("asks Roblox for an asset once", async () => {
    await send("SetRichPresence", { largeImage: { assetId: 222 } });
    await send("SetRichPresence", { largeImage: { assetId: 222 } });

    expect(thumbnailCalls).toEqual([222]);
    expect(updates).toHaveLength(2);
  });

  test("keeps the rest of the message when a picture cannot be loaded", async () => {
    await send("SetRichPresence", { state: "ok", largeImage: { assetId: 999 } });

    expect(updates).toEqual([{ state: "ok" }]);
    expect(logs[0]).toContain("could not load the picture of asset 999");
  });

  test("nothing is sent for a picture Roblox has not made", async () => {
    thumbnails[222] = null;
    await send("SetRichPresence", { largeImage: { assetId: 222 } });

    expect(updates).toEqual([]);
  });

  test("a game left while a picture loads does not change the activity", async () => {
    let finish: (url: string) => void = () => {};
    rpc = new BloxstrapRpc({
      update: async (patch) => void updates.push(patch),
      thumbnail: () => new Promise((resolve) => (finish = resolve)),
      accountShown: () => false,
      log: () => {},
      now: () => ++clock * 5000,
    });
    await rpc.begin(original, buttons);

    const pending = rpc.handle("SetRichPresence", { largeImage: { assetId: 5 } });
    await new Promise((r) => setTimeout(r, 5));
    rpc.end();
    finish("late.png");
    await pending;

    expect(updates).toEqual([]);
  });
});

describe("SetLaunchData", () => {
  test("is kept and goes into the buttons", async () => {
    await send("SetLaunchData", "room=7");

    expect(rpc.launchData).toBe("room=7");
    expect(updates).toEqual([{ buttons: buttons("room=7") }]);
  });

  test("is dropped when it is not a string or longer than 200 characters", async () => {
    await send("SetLaunchData", { a: 1 });
    await send("SetLaunchData", "x".repeat(201));

    expect(rpc.launchData).toBeUndefined();
    expect(updates).toEqual([]);
    expect(logs).toHaveLength(2);
  });

  test("is forgotten when the game is left", async () => {
    await send("SetLaunchData", "room=7");
    rpc.end();

    expect(rpc.launchData).toBeUndefined();
  });
});

describe("messages", () => {
  test("drops a message that comes within a second of the last one", async () => {
    await rpc.handle("SetRichPresence", { details: "first" });
    clock += 500;
    await rpc.handle("SetRichPresence", { details: "too soon" });
    clock += 600;
    await rpc.handle("SetRichPresence", { details: "later" });

    expect(updates).toEqual([{ details: "first" }, { details: "later" }]);
  });

  test("keeps what a game sent before the game was known, and handles it at the start", async () => {
    rpc.end();
    await send("SetRichPresence", { details: "early" });
    await send("SetLaunchData", "early=1");
    expect(updates).toEqual([]);

    await rpc.begin(original, buttons);

    expect(updates).toEqual([{ details: "early" }, { buttons: buttons("early=1") }]);
  });

  test("forgets what was waiting when the game is left", async () => {
    rpc.end();
    await send("SetRichPresence", { details: "stale" });
    rpc.end();
    await rpc.begin(original, buttons);

    expect(updates).toEqual([]);
  });

  test("is not for the commands of Funkstrap's window control", async () => {
    await send("SetWindowTitle", "My Game");
    await send("SetWindow", { x: 1 });

    expect(updates).toEqual([]);
    expect(logs).toEqual([]);
  });
});
