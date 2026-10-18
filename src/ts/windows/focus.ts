import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { openChooserWindow } from "./chooser";

/** the windows a person is looking at: the chooser and the launch splash */
const LABELS = ["main", "splash"];

/**
 * Brings the chooser or the splash to the front, whichever is open, or opens the chooser when
 * neither is. This is what a second launch of Glimmer and a click on the tray icon do.
 */
export async function focusExistingInstance() {
  for (const label of LABELS) {
    const win = await WebviewWindow.getByLabel(label);
    if (!win) continue;

    await win.unminimize();
    await win.show();
    await win.setFocus();
    return win;
  }

  return openChooserWindow();
}
