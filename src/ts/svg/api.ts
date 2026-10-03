import { joinUrl } from "$ts/utils";
import { fetch } from "@tauri-apps/plugin-http";
import { error } from "@tauri-apps/plugin-log";

const baseUrl = "https://glimmerlink.mallyy.workers.dev/";

export interface CustomIconOptions {
  /** custom SVG template URL, same #GAME_THUMBNAIL structure requirement as the bundled template */
  svgUrl?: string;
  overlay?: "black" | "white";
  /** output size in px, 16-1024 */
  size?: number;
}

export async function getCustomGameIcon(
  gameId: number,
  opts: CustomIconOptions = {},
) {
  const params = new URLSearchParams();
  if (opts.svgUrl) params.set("url_svg", opts.svgUrl);
  if (opts.overlay) params.set("overlay", opts.overlay);
  if (opts.size) params.set("size", String(opts.size));

  const query = params.toString();
  const subUrl = `thumbnail/place/${gameId}/url${query ? `?${query}` : ""}`;

  const res = await fetch(await joinUrl(baseUrl, subUrl));

  if (!res.ok) {
    error(`error when fetching custom svg : ${res.json}`);
    throw new Error(`error when fetching custom svg : ${res.json}`);
  }

  return (await res.json()).url;
}
