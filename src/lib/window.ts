import { getCurrentWindow, LogicalSize } from '@tauri-apps/api/window';

export async function sizeWindow(width: number, height: number) {
  const win = getCurrentWindow();
  await win.setSize(new LogicalSize(width, height));
  await win.center();
}
