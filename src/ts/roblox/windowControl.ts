import { join } from "@tauri-apps/api/path";
import { ask } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, remove, writeFile } from "@tauri-apps/plugin-fs";
import { commands } from "$ts/bindings";

const FLAGS_PNG = Uint8Array.from(
  atob("iVBORw0KGgoAAAANSUhEUgAAAAYAAAABCAYAAAD9yd/wAAAADklEQVR4nGP4jwQYkAAA3TsL9WxSRxoAAAAASUVORK5CYII="),
  (c) => c.charCodeAt(0),
);

/** exists when the person has window control on, and tells the SDK that the launcher is Funkstrap compatible */
const ENABLED_FILE = "enabled.png";

/** what the permission question says, already in the person's language */
export interface WindowPrompt {
  title: string;
  body: string;
  allow: string;
  deny: string;
}

export interface WindowControlOptions {
  isAllowed(universeId: number): boolean;
  /** remembers that the person allowed the game */
  allow(universeId: number): Promise<void>;
  prompt(gameName: string): WindowPrompt;
}

/** what Funkstrap starts from: solid, keying out black until the game says otherwise */
interface Layer {
  /** 0 (gone) to 255 (solid) */
  alpha: number;
  /** 0x00bbggrr */
  color: number;
  /** fade the whole window, instead of keying out the colour */
  useAlpha: boolean;
}

type Rect = [x: number, y: number, width: number, height: number];

const noLayer = (): Layer => ({ alpha: 255, color: 0, useAlpha: false });

/** the screen size games place the window for, until they say another (scaleWidth, scaleHeight) */
const DEFAULT_SCALE = { width: 1280, height: 720 };

function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: string }): T {
  if (result.status === "error") throw new Error(result.error);
  return result.data;
}

/**
 * Funkstrap's window control: games print `[BloxstrapRPC] {"command", "data"}` lines in the Roblox log and the
 * launcher moves, retitles or fades the Roblox window. Windows only, like the Rust commands behind it.
 *
 * Only the title works for every game. Everything else needs the person to allow the game once.
 * Not supported: wallpaper, desktop, notifications, window colours and borderless.
 *
 * The rules follow Funkstrap's WindowController, as games are written for it: positions are in the game's idea of
 * the screen (1280x720 unless it sends scaleWidth/scaleHeight), and see-through is either a colour key or a fade,
 * never both (Windows applies both at once if asked, which is how a game could make the whole window vanish).
 */
export class WindowControl {
  private universeId: number | null = null;
  private gameName = "";
  private hwnd: string | null = null;
  /** where the window was before the game moved it */
  private start: Rect | null = null;
  /** where the window goes next, in screen pixels; a message that leaves a value out keeps the last one */
  private target: Rect = [0, 0, 0, 0];
  private screen: Rect = [0, 0, 0, 0];
  private scale = { ...DEFAULT_SCALE };
  private layer = noLayer();
  /** whether the game changed anything about the window, so there is something to put back */
  private touched = false;
  /** games the person was asked about this session, so a game can't ask twice */
  private asked = new Set<number>();
  /** commands run one after the other, so a move never overtakes the one before it */
  private tail: Promise<unknown> = Promise.resolve();

  constructor(private readonly options: WindowControlOptions) { }

  /** a game was joined: lets its scripts see what they may do, and forgets what the last game did */
  join(universeId: number, gameName: string) {
    this.universeId = universeId;
    this.gameName = gameName;
    this.hwnd = null;
    this.start = null;
    this.scale = { ...DEFAULT_SCALE };
    this.layer = noLayer();
    this.touched = false;
    return this.run(() => this.writeFlags());
  }

  /** puts the window back as it was */
  leave() {
    this.universeId = null;
    return this.run(async () => {
      try {
        await this.restore();
      } finally {
        this.hwnd = null; // the window is gone or about to be
      }
    });
  }

  handle(message: { command: string; data?: unknown }) {
    return this.run(() => this.apply(message.command, message.data));
  }

  private run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.tail.then(task);
    this.tail = next.catch(() => { });
    return next;
  }

  private get allowed() {
    return this.universeId !== null && this.options.isAllowed(this.universeId);
  }

  private async window() {
    this.hwnd ??= unwrap(await commands.getRobloxHwnd());
    return this.hwnd;
  }

  private async apply(command: string, data: any) {
    // these two work for any game
    if (command === "SetWindowTitle") {
      this.touched = true;
      return unwrap(await commands.windowSetTitle(await this.window(), typeof data === "string" ? data : "Roblox"));
    }
    if (command === "RequestWindowPermission") return this.request();
    if (!this.allowed) return;

    const hwnd = await this.window();
    this.touched = command === "SetWindow" || command === "SetWindowTransparency" || this.touched;
    switch (command) {
      case "SetWindow":
        return this.move(hwnd, data ?? {});
      case "ResetWindow":
        return this.restoreRect();
      case "StopWindow":
        return this.restore();
      case "SetWindowTransparency": {
        if (typeof data?.transparency === "number") {
          this.layer.alpha = Math.min(255, Math.max(0, Math.trunc(data.transparency * 255)));
        }
        if (typeof data?.color === "string") {
          const color = parseInt(data.color.replace(/^0x/i, ""), 16);
          if (!Number.isNaN(color)) this.layer.color = color;
        }
        if (typeof data?.useAlpha === "boolean") this.layer.useAlpha = data.useAlpha;
        return this.applyLayer();
      }
      // StartWindow only speeds up the log reading in Funkstrap, and the log is read as it is written here
    }
  }

  private async request() {
    const universeId = this.universeId;
    if (universeId === null || this.allowed || this.asked.has(universeId)) return;
    this.asked.add(universeId);

    const text = this.options.prompt(this.gameName);
    const yes = await ask(text.body, { title: text.title, kind: "warning", okLabel: text.allow, cancelLabel: text.deny });
    if (!yes) return;

    await this.options.allow(universeId);
    await this.writeFlags();
  }

  /** SetWindow: the first one saves where the window is, then positions are scaled from the game's screen to the real one */
  private async move(hwnd: string, data: Record<string, any>) {
    if (data.reset === true) return this.restoreRect();

    if (!this.start) {
      this.start = unwrap(await commands.windowGetRect(hwnd)) as Rect;
      this.target = [...this.start];
      this.screen = unwrap(await commands.windowGetMonitor(hwnd)) as Rect;
    }
    if (data.scaleWidth > 0) this.scale.width = data.scaleWidth;
    if (data.scaleHeight > 0) this.scale.height = data.scaleHeight;

    const scaleX = this.screen[2] / this.scale.width;
    const scaleY = this.screen[3] / this.scale.height;
    if (typeof data.width === "number") this.target[2] = Math.trunc(data.width * scaleX);
    if (typeof data.height === "number") this.target[3] = Math.trunc(data.height * scaleY);

    // like Funkstrap, the window only moves when the game sends a position (and y only counts with an x)
    if (typeof data.x !== "number") return;
    this.target[0] = Math.trunc(data.x * scaleX);
    if (typeof data.y === "number") this.target[1] = Math.trunc(data.y * scaleY);

    const [x, y, width, height] = this.target;
    unwrap(await commands.windowSetRect(hwnd, x + this.screen[0], y + this.screen[1], width, height));
  }

  private async applyLayer() {
    const { alpha, color, useAlpha } = this.layer;
    unwrap(await commands.windowSetLayer(await this.window(), alpha, color, useAlpha));
  }

  private async restoreRect() {
    if (!this.start) return;
    const [x, y, width, height] = this.start;
    this.start = null;
    unwrap(await commands.windowSetRect(await this.window(), x, y, width, height));
  }

  /** the window as Roblox made it: where it was, solid, titled "Roblox" */
  private async restore() {
    if (!this.touched) return;
    this.touched = false;
    await this.restoreRect();
    this.layer = noLayer();
    await this.applyLayer();
    unwrap(await commands.windowSetTitle(await this.window(), "Roblox"));
  }

  /** the SDK finds out what it may do from the files in the Roblox install this window belongs to */
  private async writeFlags() {
    const dir = await join(unwrap(await commands.windowExeDir(await this.window())), "content", "bloxstrap");
    await mkdir(dir, { recursive: true });

    // other games' files go, so a game never sees what another one was allowed
    for (const entry of await readDir(dir)) {
      if (entry.name !== ENABLED_FILE) await remove(await join(dir, entry.name));
    }
    await writeFile(await join(dir, ENABLED_FILE), FLAGS_PNG);
    if (this.allowed) await writeFile(await join(dir, `${this.universeId}.png`), FLAGS_PNG);
  }
}
