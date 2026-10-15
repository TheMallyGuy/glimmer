import { redirect } from "@sveltejs/kit";
import { isAndroid } from "$ts/glimmer/android/platform";
import { appState, loadAppState } from "$lib/appState.svelte";

export const load = async () => {
  if (isAndroid()) redirect(307, "/onboarding/mobile");
  await loadAppState(); 
  redirect(307, appState.onboarded ? "/choose" : "/onboarding/desktop");
};
