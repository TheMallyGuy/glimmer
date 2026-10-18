import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { AccountLaunchError, AccountLauncher } from "$ts/roblox/account/launcher";
import { AccountLogin, loginStillValid, removeLogin, withAccounts } from "$ts/roblox/account/login";
import { Keyring } from "$ts/glimmer/keyring";
import { fakeWebviews, WebviewWindow } from "./helpers/webview";
import { invokeCalls, invokeHandlers, resetTauri } from "./helpers/tauri";
import { launchUri } from "$ts/glimmer/utils";
import { GameLink } from "$ts/roblox/game";

const ACCOUNT = { id: "42", name: "builderman", displayName: "Builderman" };
const realFetch = globalThis.fetch;

let sent: { url: string; headers: Record<string, string>; body?: string }[];
let saved: Record<string, string>;

/** answers like Roblox: the user for the login "GOOD", 401 for any other */
function stubRoblox(opts: { ticket?: string | null; unauthorized?: boolean } = {}) {
  globalThis.fetch = (async (
    url: string,
    init: { headers: Record<string, string>; body?: string },
  ) => {
    sent.push({ url, headers: init.headers, body: init.body });
    const headers = new Headers();

    if (url.includes("users.roblox.com")) {
      return init.headers.Cookie === ".ROBLOSECURITY=GOOD"
        ? new Response(JSON.stringify({ id: 42, name: "builderman", displayName: "Builderman" }), {
            status: 200,
            headers,
          })
        : new Response(null, { status: 401, headers });
    }

    if (opts.unauthorized) return new Response(null, { status: 401, headers });
    if (!init.headers["X-CSRF-TOKEN"]) {
      headers.set("x-csrf-token", "CSRF");
      return new Response(null, { status: 403, headers });
    }
    if (opts.ticket !== null) headers.set("rbx-authentication-ticket", opts.ticket ?? "TICKET");
    return new Response(null, { status: 200, headers });
  }) as unknown as typeof fetch;
}

beforeEach(() => {
  resetTauri();
  fakeWebviews.reset();
  sent = [];
  saved = {};
  invokeHandlers.keyring_set = (args) => {
    const { key, secret } = args as { key: string; secret: string };
    saved[key] = secret;
    return null;
  };
  invokeHandlers.keyring_get = (args) => saved[(args as { key: string }).key] ?? null;
  invokeHandlers.keyring_delete = (args) => {
    delete saved[(args as { key: string }).key];
    return null;
  };
  stubRoblox();
});

afterEach(() => {
  globalThis.fetch = realFetch;
});

describe("Keyring", () => {
  test("sets, gets and deletes through the Rust commands", async () => {
    const keyring = new Keyring();

    await keyring.set("a", "secret");
    expect(await keyring.get("a")).toBe("secret");
    await keyring.delete("a");
    expect(await keyring.get("a")).toBeNull();
  });

  test("throws the command's error", async () => {
    invokeHandlers.keyring_get = () => {
      throw "credential store locked";
    };

    await expect(new Keyring().get("a")).rejects.toThrow("credential store locked");
  });
});

describe("AccountLogin.run", () => {
  /** the cookie the login window holds, as the person signs in */
  const cookies = (...values: (string | null)[]) => {
    let i = 0;
    invokeHandlers.webview_cookie = () => values[Math.min(i++, values.length - 1)];
  };
  const login = (timeoutMs?: number) => new AccountLogin(new Keyring(), 1, timeoutMs);

  test("opens a private login window, then saves the login once it is real", async () => {
    cookies(null, "GOOD");

    const account = await login().run();

    expect(account).toEqual(ACCOUNT);
    expect(fakeWebviews.created).toHaveLength(1);
    expect(fakeWebviews.created[0].options).toMatchObject({
      url: "https://www.roblox.com/login",
      incognito: true,
    });
    expect(invokeCalls.find((c) => c.cmd === "webview_cookie")?.args).toEqual({
      label: "loginToRoblox",
      name: ".ROBLOSECURITY",
    });
    expect(saved["42"]).toBe("GOOD");
    expect(fakeWebviews.has("loginToRoblox")).toBe(false);
  });

  test("keeps waiting while the cookie is not a valid login", async () => {
    cookies("GUEST", "GUEST", "GOOD");

    expect(await login().run()).toEqual(ACCOUNT);
    expect(sent.filter((r) => r.url.includes("users.roblox.com")).length).toBe(3);
  });

  test("resolves null when the person closes the window", async () => {
    cookies(null);
    const running = login().run();
    await new Promise((r) => setTimeout(r, 5));

    fakeWebviews.close("loginToRoblox");

    expect(await running).toBeNull();
    expect(saved).toEqual({});
  });

  test("cancel() closes the window and ends the wait", async () => {
    cookies(null);
    const flow = login();
    const running = flow.run();
    await new Promise((r) => setTimeout(r, 5));

    await flow.cancel();

    expect(await running).toBeNull();
    expect(fakeWebviews.has("loginToRoblox")).toBe(false);
  });

  test("gives up after the timeout and closes the window", async () => {
    cookies(null);

    expect(await login(20).run()).toBeNull();
    expect(fakeWebviews.has("loginToRoblox")).toBe(false);
  });

  test("reuses a login window that is already open", async () => {
    cookies("GOOD");
    new WebviewWindow("loginToRoblox");
    fakeWebviews.created.length = 0;

    await login().run();

    expect(fakeWebviews.created).toHaveLength(0);
  });

  test("closes the window and throws when the cookie cannot be read", async () => {
    invokeHandlers.webview_cookie = () => {
      throw "webview gone";
    };

    await expect(login().run()).rejects.toThrow("webview gone");
    expect(fakeWebviews.has("loginToRoblox")).toBe(false);
  });
});

describe("removeLogin", () => {
  test("deletes the saved login", async () => {
    saved["42"] = "GOOD";

    await removeLogin("42");

    expect(saved).toEqual({});
  });
});

describe("loginStillValid", () => {
  test("is true while Roblox accepts the login", async () => {
    saved["42"] = "GOOD";
    expect(await loginStillValid("42")).toBe(true);
  });

  test("is false when Roblox rejects the login or none is saved", async () => {
    saved["42"] = "OLD";
    expect(await loginStillValid("42")).toBe(false);
    expect(await loginStillValid("7")).toBe(false);
  });

  test("a failed check is not treated as expired", async () => {
    saved["42"] = "GOOD";
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    expect(await loginStillValid("42")).toBe(true);
  });
});

describe("launchUri", () => {
  test("has the fields the client reads", () => {
    expect(launchUri("TICKET", 1700000000000, 12345678901)).toBe(
      "roblox-player:1+launchmode:app+gameinfo:TICKET+launchtime:1700000000000" +
        "+browsertrackerid:12345678901+robloxLocale:en_us+gameLocale:en_us+channel:+LaunchExp:InApp",
    );
  });
});

describe("AccountLauncher", () => {
  const launcher = () =>
    new AccountLauncher(
      new Keyring(),
      () => 1700000000000,
      () => 0,
    );
  const ticketRequests = () => sent.filter((r) => r.url.includes("auth.roblox.com"));

  beforeEach(() => {
    saved["42"] = "GOOD";
  });

  test("trades the saved login for a ticket and builds the launch URI", async () => {
    expect(await launcher().args("42")).toEqual([
      launchUri("TICKET", 1700000000000, 10_000_000_000),
    ]);
  });

  test("sends the cookie, a JSON body, and the CSRF token on the second request", async () => {
    await launcher().args("42");

    const [first, second] = ticketRequests();
    expect(ticketRequests()).toHaveLength(2);
    expect(first.headers.Cookie).toBe(".ROBLOSECURITY=GOOD");
    expect(first.headers["Content-Type"]).toBe("application/json");
    expect(first.body).toBe("{}");
    expect(first.headers["X-CSRF-TOKEN"]).toBeUndefined();
    expect(second.headers["X-CSRF-TOKEN"]).toBe("CSRF");
  });

  test("gameArgs builds the play URI for a game with the ticket", async () => {
    expect(await launcher().gameArgs("42", { placeId: 1818 })).toEqual([
      GameLink.launchUri(
        { placeId: 1818 },
        { ticket: "TICKET", launchTimeMs: 1700000000000, browserTrackerId: 10_000_000_000 },
      ),
    ]);
  });

  test("gameArgs reports a missing login like args does", async () => {
    delete saved["42"];

    const failure = await launcher()
      .gameArgs("42", { placeId: 1 })
      .catch((e) => e);

    expect(failure.kind).toBe("missing");
  });

  test("an expired login is reported as expired", async () => {
    stubRoblox({ unauthorized: true });

    const failure = await launcher()
      .args("42")
      .catch((e) => e);

    expect(failure).toBeInstanceOf(AccountLaunchError);
    expect(failure.kind).toBe("expired");
  });

  test("a missing saved login is reported as missing without any request", async () => {
    delete saved["42"];

    const failure = await launcher()
      .args("42")
      .catch((e) => e);

    expect(failure.kind).toBe("missing");
    expect(sent).toHaveLength(0);
  });

  test("a keyring failure is a failure, not a missing login", async () => {
    invokeHandlers.keyring_get = () => {
      throw "credential store locked";
    };

    const failure = await launcher()
      .args("42")
      .catch((e) => e);

    expect(failure.kind).toBe("failed");
    expect(failure.message).toBe("credential store locked");
  });

  test("a response without a ticket is a failure that names the status", async () => {
    stubRoblox({ ticket: null });

    const failure = await launcher()
      .args("42")
      .catch((e) => e);

    expect(failure.kind).toBe("failed");
    expect(failure.message).toBe("Roblox sent no ticket (HTTP 200)");
  });

  test("network errors become failures and never include the cookie", async () => {
    globalThis.fetch = (async () => {
      throw new Error("offline");
    }) as unknown as typeof fetch;

    const failure = await launcher()
      .args("42")
      .catch((e) => e);

    expect(failure.kind).toBe("failed");
    expect(failure.message).toBe("offline");
    expect(failure.message).not.toContain("GOOD");
  });
});

describe("withAccounts", () => {
  const accounts = { list: [ACCOUNT], activeId: "42" };

  test("replaces only the accounts of an existing config", () => {
    const raw = JSON.stringify({
      fastflags: { enabled: true },
      accounts: { list: [], activeId: null },
    });

    expect(JSON.parse(withAccounts(raw, accounts))).toEqual({
      fastflags: { enabled: true },
      accounts,
    });
  });

  test("starts a config when there is none", () => {
    expect(JSON.parse(withAccounts("", accounts))).toEqual({ accounts });
  });
});
