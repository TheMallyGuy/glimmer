import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { goto } from "$app/navigation";
import { isAndroid } from "$ts/glimmer/android/platform";

const LABEL = "splash";

export async function openSplashWindow(target = "player", link?: string) {
  return openSplash(`/splash?target=${encodeURIComponent(target)}${link ? `&link=${encodeURIComponent(link)}` : ""}`);
}

/** the splash with made-up progress and no launch, showing the built-in screen or the stored custom one */
export async function openSplashPreview(custom: boolean) {
  return openSplash(`/splash?preview=${custom ? "custom" : "builtin"}`);
}

async function openSplash(url: string) {
  if (!isTauri() || isAndroid()) return goto(url);

  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    await existing.unminimize();
    await existing.setFocus();
    return existing;
  }

  const win = new WebviewWindow(LABEL, {
    url,
    title: "glimmerSplash",
    width: 671,
    height: 329,
    maximizable: false,
    decorations: false,
    transparent: false,
    shadow: false,
    center: true,
    resizable: false,
  });

  return new Promise<WebviewWindow>((resolve, reject) => {
    win.once("tauri://created", () => resolve(win));
    win.once("tauri://error", (e) => reject(e));
  });
}
