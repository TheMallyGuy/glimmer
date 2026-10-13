import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";
import { isAndroid } from "$ts/glimmer/android/platform";

export async function sizeWindow(width: number, height: number) {
  if (!isTauri() || isAndroid()) return; // e.g. the page is open in the intlayer editor; Android has one full-screen window
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(width, height));
  await win.center();
}

/** closes this window. Does nothing outside Tauri, where the page is just a browser tab */
export async function closeWindow() {
  if (isTauri() && !isAndroid()) await getCurrentWindow().close();
}
