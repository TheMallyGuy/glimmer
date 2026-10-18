/** In-memory stand-in for `@tauri-apps/api/webviewWindow`: windows exist from `new` until `close()`. */

const windows = new Map<string, WebviewWindow>();

export const fakeWebviews = {
  /** the options every window was created with, in order */
  created: [] as { label: string; options: Record<string, unknown> }[],

  reset() {
    windows.clear();
    fakeWebviews.created.length = 0;
  },

  has(label: string) {
    return windows.has(label);
  },

  /** the person closing the window */
  close(label: string) {
    windows.delete(label);
  },
};

export class WebviewWindow {
  constructor(
    readonly label: string,
    readonly options: Record<string, unknown> = {},
  ) {
    windows.set(label, this);
    fakeWebviews.created.push({ label, options });
  }

  static async getByLabel(label: string) {
    return windows.get(label) ?? null;
  }

  async once(event: string, callback: (e: unknown) => void) {
    if (event === "tauri://created") queueMicrotask(() => callback({}));
    return () => {};
  }

  /** the focus-related calls made on this window, in order */
  calls: string[] = [];

  async unminimize() {
    this.calls.push("unminimize");
  }

  async show() {
    this.calls.push("show");
  }

  async setFocus() {
    this.calls.push("setFocus");
  }

  async close() {
    windows.delete(this.label);
  }
}
