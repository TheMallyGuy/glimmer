import { goto } from "$app/navigation";
import { appState } from "$lib/appState.svelte";
import { save } from "$lib/settings.svelte";

/** one page per step: 0 welcome, 1 language, 2 done */
export const STEPS = [
  "/onboarding/desktop",
  "/onboarding/desktop/language",
  "/onboarding/desktop/done",
];

export function stepOf(path: string): number {
  return Math.max(0, STEPS.indexOf(path.replace(/\/+$/, "")));
}

/** the tour is seen either way: it only shows on the first launch */
export async function leave() {
  appState.onboarded = true;
  await save();
  await goto("/choose");
}
