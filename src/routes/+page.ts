import { redirect } from "@sveltejs/kit";
import { isAndroid } from "$ts/glimmer/android/platform";
import { checkAndroidSetup, firstUnmetStep } from "$ts/glimmer/android/setup";
import { appState, loadAppState } from "$lib/appState.svelte";
import { STEPS } from "./onboarding/mobile/onboarding.svelte";

export const load = async () => {
  await loadAppState();
  if (!appState.onboarded)
    redirect(307, isAndroid() ? "/onboarding/mobile" : "/onboarding/desktop");

  if (isAndroid()) {
    const setup = await checkAndroidSetup();
    if (setup.shizuku !== "ready") redirect(307, STEPS[firstUnmetStep(setup)]);
  }
  redirect(307, "/choose");
};
