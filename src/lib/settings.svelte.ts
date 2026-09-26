import { goto } from '$app/navigation';
import { appState } from '$lib/appState.svelte';
import { Configuration } from '$ts/configuration';

// global state for everything

/** Window-local preferences that aren't part of the saved app state. */
export const prefs = $state({
  target: 'player',
  query: '',
});

export async function save() {
  const configuration = await Configuration.create();
  await configuration.saveRaw(JSON.stringify($state.snapshot(appState)));
}

export function discard() {
  goto('../');
}

export async function launch(target: string) {
  save();
}
