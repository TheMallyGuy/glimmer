import { describe, expect, test } from "bun:test";
import { matchesQuery } from "$lib/search";

describe("matchesQuery", () => {
  test("an empty query matches everything", () => {
    expect(matchesQuery("", "Anything")).toBe(true);
    expect(matchesQuery("   ", undefined)).toBe(true);
  });

  test("ignores case and finds the text in any of the parts", () => {
    expect(matchesQuery("NEARBY", "Join a nearby server", "Lower ping")).toBe(true);
    expect(matchesQuery("ping", "Join a nearby server", "Lower ping")).toBe(true);
    expect(matchesQuery("rings", "Join a nearby server", "Lower ping")).toBe(false);
  });

  test("every word has to be there, in any order", () => {
    expect(matchesQuery("server nearby", "Join a nearby server")).toBe(true);
    expect(matchesQuery("server fleasion", "Join a nearby server")).toBe(false);
  });

  test("ignores accents, so Vietnamese can be typed without them", () => {
    expect(matchesQuery("tim kiem", "Tìm kiếm tất cả cài đặt")).toBe(true);
    expect(matchesQuery("dat", "Cài đặt")).toBe(true);
  });

  test("does not search the tags of rich text", () => {
    expect(matchesQuery("danger", "Runs [danger]red[/danger]")).toBe(false);
    expect(matchesQuery("red", "Runs [danger]red[/danger]")).toBe(true);
  });
});
