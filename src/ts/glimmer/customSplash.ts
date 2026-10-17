import { exists, mkdir, readTextFile, remove, writeTextFile } from "@tauri-apps/plugin-fs";
import { join } from "@tauri-apps/api/path";
import { PathManager } from "./pathManager";

const MAX_SPLASH_BYTES = 2 * 1024 * 1024;
const FILE = "splash.html";

/** what the splash shows, handed to `drawSplash` each time it changes */
export interface SplashView {
  /** what the launch is doing, or why it failed */
  status: string;
  /** 0 to 100, or null while there is no number to show */
  progress: number | null;
  failed: boolean;
  /** the text of the cancel button: Cancel, or Close once the launch failed */
  cancelLabel: string;
  retryLabel: string;
}

/** the launch screens shipped in `static/splash-themes/` */
export const SPLASH_THEMES = ["blush", "ember", "crimson"] as const;
export type SplashTheme = (typeof SPLASH_THEMES)[number];

export class CustomSplash {
  /** copies the HTML file at `sourcePath` into the app data folder */
  async save(sourcePath: string) {
    await this.saveHtml(await readTextFile(sourcePath));
  }

  /** copies one of the bundled themes into the app data folder */
  async saveTheme(theme: SplashTheme) {
    const response = await fetch(`/splash-themes/${theme}.html`);
    if (!response.ok) throw new Error(`The ${theme} theme is missing.`);
    await this.saveHtml(await response.text());
  }

  async saveHtml(html: string) {
    if (html.length > MAX_SPLASH_BYTES) throw new Error("That file is bigger than 2 MB.");

    const dir = await new PathManager().getSplashDir();
    await mkdir(dir, { recursive: true });
    await writeTextFile(await join(dir, FILE), html);
  }

  /** the stored HTML, or null when there is none */
  async load(): Promise<string | null> {
    const path = await join(await new PathManager().getSplashDir(), FILE);
    return (await exists(path)) ? readTextFile(path) : null;
  }

  async remove() {
    const path = await join(await new PathManager().getSplashDir(), FILE);
    if (await exists(path)) await remove(path);
  }
}

/** writes `view` into a custom splash document */
export function drawSplash(doc: Document, view: SplashView) {
  const el = (id: string) => doc.getElementById(id);
  const known = view.progress !== null && !view.failed;
  const width = view.failed ? 100 : (view.progress ?? 0);

  const status = el("status");
  if (status) {
    status.textContent = view.status;
    status.classList.toggle("error", view.failed);
  }

  const percent = el("percent");
  if (percent) {
    percent.hidden = !known;
    percent.textContent = `${Math.round(view.progress ?? 0)}%`;
  }

  const bar = el("progress-bar");
  if (bar) {
    bar.classList.toggle("indeterminate", view.progress === null && !view.failed);
    bar.classList.toggle("error", view.failed);
    bar.style.width = view.progress === null && !view.failed ? "" : `${width}%`;
  }

  const track = el("progress-track");
  if (known) track?.setAttribute("aria-valuenow", String(Math.round(width)));
  else track?.removeAttribute("aria-valuenow");

  const retry = el("retry-btn");
  if (retry) {
    retry.hidden = !view.failed;
    retry.textContent = view.retryLabel;
  }

  const cancel = el("cancel-btn");
  if (cancel) cancel.textContent = view.cancelLabel;
}

export function wireSplash(doc: Document, on: { retry: () => void; cancel: () => void; drag: () => void }) {
  doc.getElementById("retry-btn")?.addEventListener("click", on.retry);
  doc.getElementById("cancel-btn")?.addEventListener("click", on.cancel);
  doc.addEventListener("mousedown", (e) => {
    const target = e.target as Element | null;
    if (e.button === 0 && !target?.closest?.("button, a, input, select, textarea")) on.drag();
  });
}
