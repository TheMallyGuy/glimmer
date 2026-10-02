/** the app's default accent, the yellow in theme.css */
export const DEFAULT_ACCENT = "#ffe54e";

/** the window background accent text sits on, from theme.css (`--color-canvas`) */
const CANVAS = "#0d0d0d";
/** theme.css `--color-on-accent`: dark text for light accents */
const DARK_TEXT = "#0d0d0d";
const LIGHT_TEXT = "#ffffff";

/** WCAG AA for body text. Accent is used as text on the canvas (tab labels, "Next launch"), so it has to clear this. */
export const MIN_CONTRAST = 4.5;

/** accent colours offered as one-click swatches. All of them clear MIN_CONTRAST on the canvas. */
export const ACCENT_PRESETS = [
    "#ffe54e", // yellow, the default
    "#ffa24e", // orange
    "#ff7a7a", // coral
    "#ff7ac8", // pink
    "#b794ff", // purple
    "#6db3ff", // blue
    "#5ee0e0", // cyan
    "#6be28a", // green
] as const;

export type Rgb = [number, number, number];

/** a colour the theme can use: the accent plus the shades and text colour derived from it */
export interface AccentShades {
    accent: string;
    hover: string;
    press: string;
    onAccent: string;
}

/**
 * Turns the accent colour the person picked into the CSS variables of theme.css, and applies
 * them to a document. Everything else in the app reads `--color-accent*`, so nothing else has to know.
 */
export class AccentTheme {
    /** "#rgb" or "#rrggbb" (with or without the #) as a lowercase "#rrggbb", or null when it isn't a colour */
    static normalize(input: string): string | null {
        const hex = input.trim().replace(/^#/, "").toLowerCase();
        if (/^[0-9a-f]{3}$/.test(hex)) return "#" + [...hex].map((c) => c + c).join("");
        if (/^[0-9a-f]{6}$/.test(hex)) return "#" + hex;
        return null;
    }

    /** WCAG contrast ratio between two "#rrggbb" colours, from 1 (identical) to 21 */
    static contrast(a: string, b: string): number {
        const [light, dark] = [AccentTheme.luminance(a), AccentTheme.luminance(b)].sort((x, y) => y - x);
        return (light + 0.05) / (dark + 0.05);
    }

    /** whether an accent is readable as text on the dark canvas */
    static isReadable(accent: string): boolean {
        return AccentTheme.contrast(accent, CANVAS) >= MIN_CONTRAST;
    }

    /** the hover and press shades and the text colour for an accent. Hover and press are the default yellow's relation to its own shades. */
    static shades(accent: string): AccentShades {
        const rgb = AccentTheme.parse(accent);
        return {
            accent,
            hover: AccentTheme.hex(AccentTheme.mix(rgb, [255, 255, 255], 0.46)),
            press: AccentTheme.hex(rgb.map((c) => c * 0.9) as Rgb),
            // whichever of dark or white text stands out more on the accent
            onAccent:
                AccentTheme.contrast(accent, DARK_TEXT) >= AccentTheme.contrast(accent, LIGHT_TEXT) ? DARK_TEXT : LIGHT_TEXT,
        };
    }

    /** sets the accent variables on `root` (the document's <html> by default) */
    static apply(accent: string, root: HTMLElement = document.documentElement) {
        const shades = AccentTheme.shades(AccentTheme.normalize(accent) ?? DEFAULT_ACCENT);
        root.style.setProperty("--color-accent", shades.accent);
        root.style.setProperty("--color-accent-hover", shades.hover);
        root.style.setProperty("--color-accent-press", shades.press);
        root.style.setProperty("--color-on-accent", shades.onAccent);
    }

    static parse(hex: string): Rgb {
        const n = parseInt(hex.slice(1), 16);
        return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    }

    static hex(rgb: Rgb): string {
        return "#" + rgb.map((c) => Math.round(Math.min(255, Math.max(0, c))).toString(16).padStart(2, "0")).join("");
    }

    static mix(a: Rgb, b: Rgb, amount: number): Rgb {
        return a.map((c, i) => c + (b[i] - c) * amount) as Rgb;
    }

    private static luminance(hex: string): number {
        const [r, g, b] = AccentTheme.parse(hex).map((c) => {
            const s = c / 255;
            return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
        });
        return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }
}
