import { join } from "@tauri-apps/api/path";
import { PathManager } from "./pathManager";
import { exists, mkdir, readFile, remove, writeFile } from "@tauri-apps/plugin-fs";
import { AccentTheme, type Rgb } from "./theme";

/** the app's default background, the canvas in theme.css */
export const DEFAULT_BACKGROUND = "#0d0d0d";

/** how much of the picture the dark layer on top hides, 0 to 0.9. 0.7 keeps text readable on most pictures. */
export const DEFAULT_DIM = 0.7;
export const MAX_DIM = 0.9;

/** how opaque rows, the header and menus are while a picture shows behind them */
const OVER_IMAGE_ALPHA = 0.82;

/** background colours offered as one-click swatches. All of them are dark enough for the app's text. */
export const BACKGROUND_PRESETS = [
  "#0d0d0d", // default
  "#000000", // black
  "#0d0f14", // slate
  "#0d1114", // teal
  "#0d140f", // forest
  "#140d0d", // wine
  "#130d16", // plum
] as const;

/** picture formats a background can be, with their mime type */
const IMAGE_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};
export const IMAGE_EXTENSIONS = Object.keys(IMAGE_TYPES);

const MAX_IMAGE_BYTES = 20 * 1024 * 1024;

/** grey level (0-255) of each surface token in theme.css, next to the canvas at 13 */
const SURFACES: Record<string, number> = {
  "--color-footer": 11,
  "--color-surface": 17,
  "--color-row": 21,
  "--color-field": 22,
  "--color-dialog": 22,
  "--color-hover": 26,
  "--color-menu": 28,
  "--color-tonal": 31,
  "--color-progress-track": 34,
  "--color-field-hover": 34,
  "--color-menu-active": 38,
  "--color-tonal-hover": 41,
  "--color-track": 42,
};
const DEFAULT_LEVEL = 13;

/** the lightest text on a surface, `text-muted` in theme.css. It has to stay readable, so the background can't get too light. */
const MUTED_TEXT = "#8f8f8f";

const rgbCss = (rgb: Rgb, alpha = 1) =>
  alpha === 1 ? AccentTheme.hex(rgb) : `rgb(${rgb.map(Math.round).join(" ")} / ${alpha})`;

/**
 * Turns a background colour into the surface tokens of theme.css: each surface keeps its place
 * in the scale, tinted with the colour. With a picture, the surfaces turn slightly see-through
 * and the canvas turns fully transparent so the picture shows through.
 */
export class BackgroundTheme {
  /** whether a background colour keeps the app's text readable. Only dark colours do. */
  static isUsable(color: string): boolean {
    const row = BackgroundTheme.surfaces(color)["--color-row"];
    return AccentTheme.contrast(MUTED_TEXT, row) >= 4.5;
  }

  /** the surface tokens for a "#rrggbb" background, as "#rrggbb" values */
  static surfaces(color: string): Record<string, string> {
    const base = AccentTheme.parse(color);
    const out: Record<string, string> = {};
    for (const [token, level] of Object.entries(SURFACES))
      out[token] = rgbCss(BackgroundTheme.level(base, level));
    return out;
  }

  /** sets the background variables on `root`. `imageUrl` is a picture to show behind everything, `dim` how much it is darkened. */
  static apply(root: HTMLElement, color: string, imageUrl: string | null, dim: number) {
    const normalized = AccentTheme.normalize(color) ?? DEFAULT_BACKGROUND;
    const base = AccentTheme.parse(normalized);
    const set = (name: string, value: string) => root.style.setProperty(name, value);

    for (const [token, level] of Object.entries(SURFACES)) {
      set(token, rgbCss(BackgroundTheme.level(base, level), imageUrl ? OVER_IMAGE_ALPHA : 1));
    }
    // the sticky bars and the like keep an opaque canvas; only the window's own background turns see-through
    set("--color-canvas", normalized);
    set("--color-app", imageUrl ? "transparent" : normalized);

    if (imageUrl) {
      const shade = rgbCss(base, Math.min(MAX_DIM, Math.max(0, dim)));
      set("--app-background-image", `linear-gradient(${shade}, ${shade}), url("${imageUrl}")`);
    } else {
      root.style.removeProperty("--app-background-image");
    }
  }

  /** the colour `base` has when the default canvas (13) moves to `level`: lighter ones mix toward white, darker ones toward black */
  private static level(base: Rgb, level: number): Rgb {
    return level >= DEFAULT_LEVEL
      ? AccentTheme.mix(base, [255, 255, 255], (level - DEFAULT_LEVEL) / (255 - DEFAULT_LEVEL))
      : AccentTheme.mix(base, [0, 0, 0], (DEFAULT_LEVEL - level) / DEFAULT_LEVEL);
  }
}

/** the picture used as the app background: a copy kept in the app data folder, so the original can move or go */
export class BackgroundImage {
  /** the extension of a picture path, lowercase without the dot, or null when it is not a supported picture */
  static extensionOf(path: string): string | null {
    const ext = path.split(/[\\/]/).pop()?.split(".").pop()?.toLowerCase() ?? "";
    return ext in IMAGE_TYPES ? ext : null;
  }

  /** copies the picture at `sourcePath` into the app data folder and returns the name it is stored under */
  async save(sourcePath: string): Promise<string> {
    const ext = BackgroundImage.extensionOf(sourcePath);
    if (!ext) throw new Error(`Use one of: ${IMAGE_EXTENSIONS.join(", ")}.`);

    const bytes = await readFile(sourcePath);
    if (bytes.byteLength > MAX_IMAGE_BYTES) throw new Error("That picture is bigger than 20 MB.");

    const dir = await this.dir();
    await mkdir(dir, { recursive: true });
    // one background at a time: a new picture replaces whatever was there, whatever its format
    for (const old of IMAGE_EXTENSIONS) await this.removeFile(`background.${old}`);

    const name = `background.${ext}`;
    await writeFile(await join(dir, name), bytes);
    return name;
  }

  /** a URL the page can show the stored picture with, or null when it is gone. Release it with `URL.revokeObjectURL`. */
  async load(name: string): Promise<string | null> {
    const ext = BackgroundImage.extensionOf(name);
    const path = await join(await this.dir(), name);
    if (!ext || !(await exists(path))) return null;

    const bytes = await readFile(path);
    return URL.createObjectURL(new Blob([bytes], { type: IMAGE_TYPES[ext] }));
  }

  async remove(name: string) {
    await this.removeFile(name);
  }

  private async dir() {
    return new PathManager().getBackgroundsDir();
  }

  private async removeFile(name: string) {
    const path = await join(await this.dir(), name);
    if (await exists(path)) await remove(path);
  }
}
