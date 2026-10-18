import { describe, expect, test } from "bun:test";
import { DEFAULT_SLOTS, SLOT_COUNT, normalizeSlots } from "$lib/boardSlots";

describe("normalizeSlots", () => {
  test("nothing saved gives the default board, as a copy", () => {
    const slots = normalizeSlots(undefined);
    expect(slots).toEqual(DEFAULT_SLOTS);
    expect(slots).not.toBe(DEFAULT_SLOTS);
  });

  test("anything that is not a list gives the default board", () => {
    expect(normalizeSlots("hop")).toEqual(DEFAULT_SLOTS);
    expect(normalizeSlots({ 0: "hop" })).toEqual(DEFAULT_SLOTS);
  });

  test("a saved board keeps its actions and blank slots", () => {
    expect(normalizeSlots([null, "hop", "copyInvite", null, null, "hop"])).toEqual([
      null,
      "hop",
      "copyInvite",
      null,
      null,
      "hop",
    ]);
  });

  test("an action this version does not know becomes a blank slot", () => {
    expect(normalizeSlots(["rejoin", 3, "hop", undefined, {}, "copyInvite"])).toEqual([
      null,
      null,
      "hop",
      null,
      null,
      "copyInvite",
    ]);
  });

  test("a short list is filled with blank slots and a long one is cut", () => {
    expect(normalizeSlots(["hop"])).toEqual(["hop", null, null, null, null, null]);
    expect(normalizeSlots(Array(10).fill("hop"))).toHaveLength(SLOT_COUNT);
  });
});

describe("normalizeSlots with game slots", () => {
  test("keeps a game slot with its name", () => {
    const game = { placeId: 920587237, name: "Adopt Me!" };
    expect(normalizeSlots([game, "hop"]).slice(0, 2)).toEqual([game, "hop"]);
  });

  test("a game slot with no name is named by its place id", () => {
    expect(normalizeSlots([{ placeId: 5 }])[0]).toEqual({ placeId: 5, name: "5" });
  });

  test.each([
    [{ placeId: 0, name: "x" }],
    [{ placeId: -1 }],
    [{ placeId: "5" }],
    [{ placeId: 1.5 }],
    [{ name: "x" }],
    [{}],
    [[]],
  ])("%p is a blank slot", (slot) => {
    expect(normalizeSlots([slot])[0]).toBeNull();
  });
});

describe("normalizeSlots with a game icon", () => {
  const game = { placeId: 7, name: "Game" };

  test("keeps the icon of a game", () => {
    const icon = "https://tr.rbxcdn.com/abc/150/150/Image/Png";
    expect(normalizeSlots([{ ...game, iconUrl: icon }])[0]).toEqual({ ...game, iconUrl: icon });
  });

  test.each([
    ["http://tr.rbxcdn.com/a.png"],
    ["javascript:alert(1)"],
    ["data:image/png;base64,AAAA"],
    [42],
    [null],
  ])("drops an icon that is %p, and keeps the game", (iconUrl) => {
    const slot = normalizeSlots([{ ...game, iconUrl }])[0];
    expect(slot).toEqual(game);
    expect(slot).not.toHaveProperty("iconUrl");
  });
});
