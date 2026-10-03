import { isTauri } from "@tauri-apps/api/core";
import { closeWindow } from "$lib/window";
import { appState } from "$lib/appState.svelte";
import { Configuration } from "$ts/configuration";
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
}

export async function discard() {
  await openChooserWindow();
  await closeWindow();
}

export async function launch(target: string) {
  await save();
  await openSplashWindow(target);
  await closeWindow();
}
