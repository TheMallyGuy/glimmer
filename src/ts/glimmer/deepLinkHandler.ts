import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { info } from "@tauri-apps/plugin-log";
import { focusExistingInstance } from "$ts/windows/focus";
import { openSplashWindow } from "$ts/windows/splash";

export interface DeepLink {
  raw: string;
  scheme: string;
  /** everything after the first colon (and a leading `//`) */
  rest: string;
}

export class DeepLinkHandler {
  constructor(
    private readonly onLink: (link: DeepLink) => unknown = DeepLinkHandler.open,
    private readonly listen: typeof onOpenUrl = onOpenUrl,
    private readonly current: typeof getCurrent = getCurrent,
  ) {}

  static open(link: DeepLink) {
    const launches =
      link.scheme === "roblox-player" || (link.scheme === "roblox" && link.rest !== "");
    return launches ? openSplashWindow("player", link.raw) : focusExistingInstance();
  }

  /** splits a link, or null when it isn't one */
  static parse(raw: string): DeepLink | null {
    const match = /^([a-z][a-z0-9+.-]*):(?:\/\/)?(.*)$/is.exec(raw.trim());
    return match ? { raw: raw.trim(), scheme: match[1].toLowerCase(), rest: match[2] } : null;
  }

  /**
   * Starts listening, and handles the link Glimmer was started with, which `onOpenUrl` doesn't
   * report. Returns a function that stops listening.
   */
  async start(): Promise<() => void> {
    const stop = await this.listen((urls) => this.handle(urls));
    await this.handle((await this.current()) ?? []);
    return stop;
  }

  private async handle(urls: string[]) {
    for (const raw of urls) {
      const link = DeepLinkHandler.parse(raw);
      if (!link) continue;

      // the link can carry a one-time Roblox login ticket, so the log only gets the scheme
      info(`opened by a ${link.scheme}: link`);
      await this.onLink(link);
    }
  }
}
