import { check } from "@tauri-apps/plugin-updater";
import { ask } from "@tauri-apps/plugin-dialog";
import { relaunch } from "@tauri-apps/plugin-process";
import { info, warn } from "@tauri-apps/plugin-log";

export interface UpdatePrompt {
  title: string;
  body: string;
  install: string;
  later: string;
}

interface PendingUpdate {
  version: string;
  downloadAndInstall(): Promise<void>;
}

export interface UpdaterDeps {
  check(): Promise<PendingUpdate | null>;
  ask(body: string, options: { title: string; okLabel: string; cancelLabel: string }): Promise<boolean>;
  relaunch(): Promise<void>;
}

const plugins: UpdaterDeps = { check, ask, relaunch };

export async function checkForUpdate(
  prompt: (version: string) => UpdatePrompt,
  deps: UpdaterDeps = plugins,
): Promise<boolean> {
  try {
    const update = await deps.check();
    if (!update) return false;

    info(`update ${update.version} is available`);
    const text = prompt(update.version);
    const agreed = await deps.ask(text.body, {
      title: text.title,
      okLabel: text.install,
      cancelLabel: text.later,
    });
    if (!agreed) return false;

    await update.downloadAndInstall();
    await deps.relaunch();
    return true;
  } catch (e) {
    warn(`update check skipped: ${e}`); 
    return false;
  }
}
