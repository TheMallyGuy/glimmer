import { isTauri } from "@tauri-apps/api/core";
import { BackgroundImage, BackgroundTheme } from "$ts/glimmer/background";

const images = new BackgroundImage();

// the picture currently shown, so it is only read again when its file name changes
let loadedName = "";
let loadedUrl: string | null = null;

/** applies the background colour and picture to the page, loading the picture first when it changed */
export async function applyBackground(
  color: string,
  image: string,
  dim: number,
) {
  if (image !== loadedName) {
    loadedName = image;
    if (loadedUrl) URL.revokeObjectURL(loadedUrl);
    // there are no files to read outside Tauri (e.g. in the intlayer editor)
    loadedUrl =
      image && isTauri() ? await images.load(image).catch(() => null) : null;
  }

  BackgroundTheme.apply(document.documentElement, color, loadedUrl, dim);
}
