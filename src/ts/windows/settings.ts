import { isTauri } from "@tauri-apps/api/core";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { goto } from "$app/navigation";
import { isAndroid } from "$ts/glimmer/android/platform";

const LABEL = "settings";

export async function openSettingsWindow() {
  if (!isTauri() || isAndroid()) return goto(isAndroid() ? "/flags" : "/mods");

  const existing = await WebviewWindow.getByLabel(LABEL);
  if (existing) {
    await existing.unminimize();
    await existing.setFocus();
    return existing;
  }

  const win = new WebviewWindow(LABEL, {
    url: "/mods",
    title: "glimmer",
    width: 1184,
    height: 834,
    decorations: false,
    center: true,
    resizable: true,
  });

  return new Promise<WebviewWindow>((resolve, reject) => {
    win.once("tauri://created", () => resolve(win));
    win.once("tauri://error", (e) => reject(e));
  });
}
