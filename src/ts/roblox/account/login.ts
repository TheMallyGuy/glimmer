import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { fetch } from "@tauri-apps/plugin-http";
import { commands } from "$ts/glimmer/bindings";
import { Keyring } from "$ts/glimmer/keyring";

/** the non-secret part of a saved account. The login itself stays in the OS credential store. */
export interface Account {
  id: string;
  name: string;
  displayName: string;
}

/** what is kept in config.json */
export interface AccountsState {
  list: Account[];
  /** the account the next launch signs in as, or null to leave Roblox on its own login */
  activeId: string | null;
}

export const COOKIE_NAME = ".ROBLOSECURITY";

const LOGIN_LABEL = "loginToRoblox";
const LOGIN_URL = "https://www.roblox.com/login";
const AUTHENTICATED_URL = "https://users.roblox.com/v1/users/authenticated";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** who a login belongs to, or null when Roblox does not accept it */
export async function authenticatedUser(
  cookie: string,
): Promise<Account | null> {
  const response = await fetch(AUTHENTICATED_URL, {
    headers: { Cookie: `${COOKIE_NAME}=${cookie}` },
  });
  if (response.status === 401) return null;
  if (!response.ok) throw new Error(`Roblox answered HTTP ${response.status}`);

  const user = (await response.json()) as {
    id: number;
    name: string;
    displayName: string;
  };
  // user ids are bigger than 32 bits but still exact as a JS number; the string keeps them opaque
  return {
    id: String(user.id),
    name: user.name,
    displayName: user.displayName,
  };
}

/**
 * The login window: Roblox's own login page in a separate, private window (nothing from it is
 * kept once it closes). The login is read from the window's cookies and saved to the keyring.
 */
export class AccountLogin {
  constructor(
    private readonly keyring = new Keyring(),
    private readonly pollMs = 1000,
    private readonly timeoutMs = 10 * 60 * 1000,
  ) {}

  /**
   * Resolves with the signed-in account once its login is saved, or null when the window is
   * closed first (or `cancel()` is called, or nobody signs in within the timeout).
   */
  async run(): Promise<Account | null> {
    if (!(await WebviewWindow.getByLabel(LOGIN_LABEL))) await this.open();

    const deadline = Date.now() + this.timeoutMs;
    try {
      while (Date.now() < deadline) {
        await delay(this.pollMs);
        // closed by the person, or by cancel()
        if (!(await WebviewWindow.getByLabel(LOGIN_LABEL))) return null;

        const cookie = await this.cookie();
        if (!cookie) continue;

        // a cookie that is not a real login yet just means they are still signing in
        const account = await authenticatedUser(cookie);
        if (!account) continue;

        await this.keyring.set(account.id, cookie);
        return account;
      }
      return null;
    } finally {
      await this.close();
    }
  }

  async cancel() {
    await this.close();
  }

  private open(): Promise<WebviewWindow> {
    // created here, not in a page, and not listed in any capability, so the Roblox site gets no access to Glimmer's commands
    const window = new WebviewWindow(LOGIN_LABEL, {
      url: LOGIN_URL,
      title: "Log in to Roblox",
      width: 420,
      height: 660,
      center: true,
      incognito: true,
    });

    return new Promise((resolve, reject) => {
      window.once("tauri://created", () => resolve(window));
      window.once("tauri://error", (e) =>
        reject(new Error(String((e as { payload?: unknown }).payload ?? e))),
      );
    });
  }

  private async cookie(): Promise<string | null> {
    const result = await commands.webviewCookie(LOGIN_LABEL, COOKIE_NAME);
    if (result.status === "error") throw new Error(result.error);
    return result.data;
  }

  private async close() {
    await (await WebviewWindow.getByLabel(LOGIN_LABEL))?.close();
  }
}

/** forgets an account's saved login */
export async function removeLogin(id: string, keyring = new Keyring()) {
  await keyring.delete(id);
}

/** whether Roblox still accepts an account's saved login. A failed check counts as valid, so being offline never marks accounts as expired. */
export async function loginStillValid(
  id: string,
  keyring = new Keyring(),
): Promise<boolean> {
  try {
    const cookie = await keyring.get(id);
    if (!cookie) return false;
    return (await authenticatedUser(cookie)) !== null;
  } catch {
    return true;
  }
}

/** `raw` (the text of config.json, possibly empty) with its accounts replaced */
export function withAccounts(raw: string, accounts: AccountsState): string {
  const config = raw.trim() ? JSON.parse(raw) : {};
  config.accounts = accounts;
  return JSON.stringify(config);
}
