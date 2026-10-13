import { isTauri } from "@tauri-apps/api/core";
import { emit, type UnlistenFn } from "@tauri-apps/api/event";
import { closeWindow } from "$lib/window";
import { appState, setGameState } from "$lib/appState.svelte";
import { flagsToObject } from "$lib/flags";
import { isAndroid } from "$ts/glimmer/android/platform";
import { launchOnAndroid, type AndroidLaunchResult } from "$ts/glimmer/android/launch";
import { initDiscordRpc, clearActivity } from "$ts/roblox/discordRpc";
import { watchRobloxExit } from "$ts/glimmer/android/exitWatcher";
import { processLogLine } from "$ts/roblox/logs/process";
import { watchRobloxLogs } from "$ts/roblox/logs/watcher";
import { Configuration } from "$ts/glimmer/configuration";
import { openChooserWindow } from "$ts/windows/chooser";
import { openSplashWindow } from "$ts/windows/splash";

// global state for everything

/** Window-local preferences that aren't part of the saved app state. */
export const prefs = $state({
  target: "player",
  query: "",
});

export async function save() {
  if (!isTauri()) return;

  const configuration = await Configuration.create();
  await configuration.saveRaw(JSON.stringify($state.snapshot(appState)));

  await emit("overlay-refresh");
}

export async function discard() {
  await openChooserWindow();
  await closeWindow();
}

let stopWatchingLogs: UnlistenFn | null = null;
let stopWatchingExit: (() => void) | null = null;

export async function launch(target: string): Promise<AndroidLaunchResult | null> {
  await save();
  if (isAndroid()) {
    stopWatchingLogs ??= await watchRobloxLogs(processLogLine);
    // presence from the Discord app on the phone; a no-op when it is off in the settings
    await initDiscordRpc();
    const result = await launchOnAndroid({
      flags: appState.fastflags.enabled ? flagsToObject(appState.fastflags.flags) : null,
    });
    if (result === "started" || result === "startedNoFlags") {
      stopWatchingExit?.();
      stopWatchingExit = watchRobloxExit(() => {
        stopWatchingExit = null;
        setGameState({ gameId: 0, gameServer: "" });
        void clearActivity();
      });
    }
    return result;
  }
  await openSplashWindow(target);
  await closeWindow();
  return null;
}
