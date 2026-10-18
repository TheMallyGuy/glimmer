import type { ActivityOptions } from "./discordRpc";

type Button = NonNullable<ActivityOptions["buttons"]>[number];

export interface BloxstrapRpcOptions {
  /** merges fields into the Discord activity */
  update(patch: Partial<ActivityOptions>): Promise<void>;
  /** the picture of a Roblox asset, or null when it has none */
  thumbnail(assetId: number): Promise<string | null>;
  /** whether the person's account is shown as the small image, which a game may not replace */
  accountShown(): boolean;
  log(message: string): void;
  now?(): number;
}

/** a game's picture request in a `SetRichPresence` message */
interface PresenceImage {
  assetId?: number;
  hoverText?: string;
  clear?: boolean;
  reset?: boolean;
}

interface Presence {
  details?: string;
  state?: string;
  timeStart?: number;
  timeEnd?: number;
  smallImage?: PresenceImage;
  largeImage?: PresenceImage;
}

/** the commands that are about Discord. Everything else a game prints (the Funkstrap window commands) is not for this class. */
export const PRESENCE_COMMANDS = ["SetRichPresence", "SetLaunchData"];

const MAX_TEXT = 128;
const MAX_LAUNCH_DATA = 200;
const MAX_QUEUED = 20;
/** Bloxstrap drops a message that comes less than this long after the last one */
const RATE_LIMIT_MS = 1000;

/**
 * Bloxstrap's game RPC (https://github.com/bloxstraplabs/bloxstrap/tree/main/Bloxstrap/Models/BloxstrapRPC):
 * a game prints `[BloxstrapRPC] {"command", "data"}` in the Roblox log to change the person's Discord activity.
 * `SetRichPresence` changes the texts, timestamps and pictures, `SetLaunchData` is what an invite link hands to the
 * game. The rules follow Bloxstrap's DiscordRichPresence, as games are written for it.
 */
export class BloxstrapRpc {
  /** the activity Glimmer made for the game, which "<reset>" and `reset` go back to */
  private original: ActivityOptions | null = null;
  private buttons: (launchData?: string) => Button[] = () => [];
  private queue: { command: string; data: unknown }[] = [];
  private lastAccepted = Number.NEGATIVE_INFINITY;
  private thumbnails = new Map<number, string>();
  /** the game was left (or another joined) while pictures were loading, so what was loading is dropped */
  private generation = 0;
  /** commands run one after the other, so an older message never lands after a newer one */
  private tail: Promise<unknown> = Promise.resolve();

  /** what a game set with `SetLaunchData` in this session */
  launchData: string | undefined;

  constructor(private readonly options: BloxstrapRpcOptions) {}

  /**
   * a game was joined and Glimmer set `original` as the activity. `buttons` makes the buttons of an activity, given
   * the game's launch data, so an invite link can carry it. Messages the game sent before this are handled now.
   */
  begin(original: ActivityOptions, buttons: (launchData?: string) => Button[]) {
    this.original = original;
    this.buttons = buttons;
    this.launchData = undefined;
    this.lastAccepted = Number.NEGATIVE_INFINITY;
    this.generation++;

    const waiting = this.queue.splice(0);
    return this.run(async () => {
      for (const message of waiting) await this.apply(message.command, message.data);
    });
  }

  /** the game was left: what it set is forgotten */
  end() {
    this.original = null;
    this.launchData = undefined;
    this.queue.length = 0;
    this.lastAccepted = Number.NEGATIVE_INFINITY;
    this.generation++;
  }

  handle(command: string, data: unknown) {
    return this.run(async () => {
      if (!PRESENCE_COMMANDS.includes(command)) return;

      if (!this.original) {
        // the game can speak before Glimmer knows which game it is
        if (this.queue.length < MAX_QUEUED) this.queue.push({ command, data });
        return;
      }

      const now = (this.options.now ?? Date.now)();
      if (now - this.lastAccepted < RATE_LIMIT_MS) {
        this.options.log("BloxstrapRPC: dropped a message, the game sends them too fast");
        return;
      }
      this.lastAccepted = now;

      await this.apply(command, data);
    });
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task);
    this.tail = next.catch(() => {});
    return next;
  }

  private async apply(command: string, data: unknown) {
    if (command === "SetLaunchData") return this.setLaunchData(data);
    if (command === "SetRichPresence") return this.setRichPresence(data as Presence | null);
  }

  private async setLaunchData(data: unknown) {
    if (typeof data !== "string")
      return this.options.log("BloxstrapRPC: launch data is not a string");
    if (data.length > MAX_LAUNCH_DATA) {
      return this.options.log(
        `BloxstrapRPC: launch data cannot be longer than ${MAX_LAUNCH_DATA} characters`,
      );
    }

    this.launchData = data;
    await this.options.update({ buttons: this.buttons(data) });
  }

  private async setRichPresence(data: Presence | null) {
    const original = this.original;
    if (!original || typeof data !== "object" || data === null) return;

    const patch: Partial<ActivityOptions> = {};
    const generation = ++this.generation;

    for (const key of ["details", "state"] as const) {
      const value = data[key];
      if (typeof value !== "string") continue;
      if (value.length > MAX_TEXT)
        this.options.log(`BloxstrapRPC: ${key} cannot be longer than ${MAX_TEXT} characters`);
      else patch[key] = value === "<reset>" ? original[key] : value;
    }

    // a time of 0 takes the timestamp away. Games send seconds, Discord activity here is in ms
    if (typeof data.timeStart === "number")
      patch.startTimestamp = data.timeStart === 0 ? undefined : data.timeStart * 1000;
    if (typeof data.timeEnd === "number")
      patch.endTimestamp = data.timeEnd === 0 ? undefined : data.timeEnd * 1000;

    // the person's own picture stays when their account is shown, as it makes no sense to replace it
    const loading: Promise<void>[] = [];
    if (data.smallImage && !this.options.accountShown()) {
      loading.push(this.image(data.smallImage, "small", original, patch));
    }
    if (data.largeImage) loading.push(this.image(data.largeImage, "large", original, patch));

    await Promise.all(loading);
    if (generation !== this.generation) return;
    if (Object.keys(patch).length) await this.options.update(patch);
  }

  /** `image` of a message, as the fields it changes in `patch` */
  private async image(
    image: PresenceImage,
    size: "small" | "large",
    original: ActivityOptions,
    patch: Partial<ActivityOptions>,
  ) {
    const [key, text] =
      size === "small"
        ? (["smallImage", "smallText"] as const)
        : (["largeImage", "largeText"] as const);

    if (image.clear) {
      patch[key] = undefined;
      return;
    }
    if (image.reset) {
      patch[key] = original[key];
      patch[text] = original[text];
      return;
    }

    if (typeof image.hoverText === "string") patch[text] = image.hoverText;
    if (typeof image.assetId !== "number") return;

    let url = this.thumbnails.get(image.assetId);
    if (!url) {
      try {
        url = (await this.options.thumbnail(image.assetId)) ?? undefined;
      } catch (err) {
        this.options.log(
          `BloxstrapRPC: could not load the picture of asset ${image.assetId}: ${err}`,
        );
      }
      if (url) this.thumbnails.set(image.assetId, url);
    }
    if (url) patch[key] = url;
  }
}
