import { isTauri } from "@tauri-apps/api/core";
import { emit, type UnlistenFn } from "@tauri-apps/api/event";
import { closeWindow } from "$lib/window";
import { appState } from "$lib/appState.svelte";
import { flagsToObject } from "$lib/flags";
import { isAndroid } from "$ts/glimmer/android/platform";
import { launchOnAndroid, type AndroidLaunchResult } from "$ts/glimmer/android/launch";
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

export async function launch(target: string): Promise<AndroidLaunchResult | null> {
  await save();
  if (isAndroid()) {
    stopWatchingLogs ??= await watchRobloxLogs(processLogLine);
    return launchOnAndroid({
      flags: appState.fastflags.enabled ? flagsToObject(appState.fastflags.flags) : null,
    });
  }
  await openSplashWindow(target);
  await closeWindow();
  return null;
}
