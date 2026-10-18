import {
  isRegistered,
  register,
  unregister,
  type ShortcutEvent,
} from "@tauri-apps/plugin-global-shortcut";

/** hold this anywhere (Roblox included) to open the in-game menu */
export const OVERLAY_SHORTCUT = "Alt+G";

/** what the shortcut needs of the global shortcut plugin, so a test can stand in for it */
export interface ShortcutPlugin {
  register(shortcut: string, handler: (event: ShortcutEvent) => void): Promise<void>;
  unregister(shortcut: string): Promise<void>;
  isRegistered(shortcut: string): Promise<boolean>;
}

export interface ShortcutHandlers {
  /** the shortcut went down */
  press(): void;
  /** the shortcut came up */
  release(): void;
}

/**
 * The Alt + G shortcut, told as a press and a release. Windows repeats a held shortcut and can report its
 * release more than once, so the handlers get one press and then one release.
 */
export class OverlayShortcut {
  private down = false;

  constructor(
    private readonly handlers: ShortcutHandlers,
    private readonly plugin: ShortcutPlugin = { register, unregister, isRegistered },
  ) {}

  /** whether the shortcut is held right now */
  get held() {
    return this.down;
  }

  /** turns the shortcut on or off. Turning it on again is fine: the handler of this page replaces an older one. */
  async set(enabled: boolean) {
    if (await this.plugin.isRegistered(OVERLAY_SHORTCUT))
      await this.plugin.unregister(OVERLAY_SHORTCUT);
    this.down = false;
    if (enabled) await this.plugin.register(OVERLAY_SHORTCUT, (event) => this.handle(event));
  }

  private handle({ state }: ShortcutEvent) {
    if (state === "Pressed" && !this.down) {
      this.down = true;
      this.handlers.press();
    } else if (state === "Released" && this.down) {
      this.down = false;
      this.handlers.release();
    }
  }
}
