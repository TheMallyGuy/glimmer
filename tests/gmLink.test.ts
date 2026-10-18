import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { GmLink } from "$ts/roblox/gmLink";

const realFetch = globalThis.fetch;
let request: { url: string; init: RequestInit };
let reply: Response;

beforeEach(() => {
  reply = new Response(JSON.stringify({ status: "success" }));
  globalThis.fetch = (async (url: string, init: RequestInit) => {
    request = { url: String(url), init };
    return reply;
  }) as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("GmLink.share", () => {
  test("posts the username and games to the link code", async () => {
    await new GmLink("https://api.test/").share("a b", "builderman", [1, 2]);

    expect(request.url).toBe("https://api.test/link/a%20b/submit");
    expect(request.init.method).toBe("POST");
    expect(JSON.parse(String(request.init.body))).toEqual({
      username: "builderman",
      games: [1, 2],
    });
  });

  test("an error reply throws the API's message", async () => {
    reply = new Response(JSON.stringify({ status: "error", message: "Link code has expired" }));

    expect(new GmLink("https://api.test/").share("c", "u", [1])).rejects.toThrow(
      "Link code has expired",
    );
  });

  test("a reply that isn't JSON throws with the HTTP status", async () => {
    reply = new Response("oops", { status: 502 });

    expect(new GmLink("https://api.test/").share("c", "u", [1])).rejects.toThrow("502");
  });
});
