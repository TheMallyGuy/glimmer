import { fetch } from "@tauri-apps/plugin-http";
import { Keyring } from "$ts/glimmer/keyring";
import { COOKIE_NAME } from "./login";
import { launchUri } from "$ts/glimmer/utils";
import { GameLink, type GameTarget } from "../game";

const TICKET_URL = "https://auth.roblox.com/v1/authentication-ticket";

/** why a launch could not sign in as an account */
export class AccountLaunchError extends Error {
  constructor(
    readonly kind: "expired" | "missing" | "failed",
    message: string,
  ) {
    super(message);
  }
}

/**
 * Starts the Roblox client as a saved account: trades the account's login for a one-time ticket
 * and builds the launch arguments from it. The ticket expires within a minute, so call `args`
 * right before launching. The login is only ever held in local variables here.
 */
export class AccountLauncher {
  constructor(
    private readonly keyring = new Keyring(),
    private readonly now: () => number = Date.now,
    private readonly random: () => number = Math.random,
  ) {}

  async args(id: string): Promise<string[]> {
    const ticket = await this.ticket(await this.cookie(id));
    return [launchUri(ticket, this.now(), this.trackerId())];
  }

  /** the arguments that start the player in a game, signed in as an account */
  async gameArgs(id: string, game: GameTarget): Promise<string[]> {
    const ticket = await this.ticket(await this.cookie(id));
    return [
      GameLink.launchUri(game, {
        ticket,
        launchTimeMs: this.now(),
        browserTrackerId: this.trackerId(),
      }),
    ];
  }

  /** the tracker id is only an analytics label, so any 11 digit number will do */
  private trackerId(): number {
    return 10_000_000_000 + Math.floor(this.random() * 90_000_000_000);
  }

  private async cookie(id: string): Promise<string> {
    let cookie: string | null;
    try {
      cookie = await this.keyring.get(id);
    } catch (e) {
      throw new AccountLaunchError(
        "failed",
        e instanceof Error ? e.message : String(e),
      );
    }
    if (!cookie)
      throw new AccountLaunchError(
        "missing",
        "No login is saved for this account.",
      );
    return cookie;
  }

  /** Roblox answers the first request with a CSRF token (403) and only issues the ticket to a request that sends it back */
  private async ticket(cookie: string): Promise<string> {
    const first = await this.request(cookie);
    const csrf = first.headers.get("x-csrf-token");
    if (!csrf)
      throw new AccountLaunchError(
        "failed",
        `Roblox sent no CSRF token (HTTP ${first.status})`,
      );

    const second = await this.request(cookie, csrf);
    const ticket = second.headers.get("rbx-authentication-ticket");
    if (!ticket)
      throw new AccountLaunchError(
        "failed",
        `Roblox sent no ticket (HTTP ${second.status})`,
      );
    return ticket;
  }

  private async request(cookie: string, csrf?: string): Promise<Response> {
    let response: Response;
    try {
      response = await fetch(TICKET_URL, {
        method: "POST",
        headers: {
          Cookie: `${COOKIE_NAME}=${cookie}`,
          Origin: "https://www.roblox.com",
          Referer: "https://www.roblox.com/games/1818/",
          "Content-Type": "application/json",
          ...(csrf ? { "X-CSRF-TOKEN": csrf } : {}),
        },
        // the endpoint rejects a request without a JSON body (HTTP 415)
        body: "{}",
      });
    } catch (e) {
      throw new AccountLaunchError(
        "failed",
        e instanceof Error ? e.message : String(e),
      );
    }

    if (response.status === 401)
      throw new AccountLaunchError(
        "expired",
        "The saved login is no longer accepted.",
      );
    return response;
  }
}
