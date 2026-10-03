import { isTauri } from "@tauri-apps/api/core";
import { getCurrentWindow, LogicalSize } from "@tauri-apps/api/window";

export async function sizeWindow(width: number, height: number) {
  if (!isTauri()) return; // e.g. the page is open in the intlayer editor
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(width, height));
  await win.center();
}

/** closes this window. Does nothing outside Tauri, where the page is just a browser tab */
export async function closeWindow() {
  if (isTauri()) await getCurrentWindow().close();
}
