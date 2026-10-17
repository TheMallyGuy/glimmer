import { goto } from "$app/navigation";
import { appState } from "$lib/appState.svelte";
import { save } from "$lib/settings.svelte";
import { Shizuku } from "$ts/glimmer/android/shizuku/shizukuCom";
import {
  checkAndroidSetup,
  firstUnmetStep,
  isReady,
  requestShizukuAccess,
  type AndroidSetup,
} from "$ts/glimmer/android/setup";

/** one page per step: 0 welcome, 1 start Shizuku, 2 allow Glimmer, 3 find Roblox, 4 done */
export const STEPS = [
  "/onboarding/mobile",
  "/onboarding/mobile/shizuku",
  "/onboarding/mobile/permission",
  "/onboarding/mobile/roblox",
  "/onboarding/mobile/done",
];
export const LAST = STEPS.length - 1;

export const shizuku = new Shizuku();

/** what the last check found, shared by every step page */
export const onboarding = $state({ setup: null as AndroidSetup | null, checking: false });

export function stepOf(path: string): number {
  return Math.max(0, STEPS.indexOf(path.replace(/\/+$/, "")));
}

/** whether the person can move on from a step */
export function isMet(step: number, setup: AndroidSetup | null): boolean {
  if (step === 1) return !!setup && setup.shizuku !== "notRunning";
  if (step === 2) return setup?.shizuku === "ready";
  if (step === 3) return setup?.roblox === true;
  return true;
}

/** the onboarding is seen either way (Skip or Continue): later starts only come back for Shizuku */
export async function finish() {
  appState.onboarded = true;
  await save();
  await goto("/choose");
}

/** reads the phone again; a met step moves on by itself, and a phone that is already set up skips the welcome */
export async function check(step: number) {
  if (onboarding.checking) return;
  onboarding.checking = true;
  try {
    const setup = (onboarding.setup = await checkAndroidSetup(shizuku));
    if (step === 0 && isReady(setup)) return void (await finish());
    if (step >= 1 && step < LAST && isMet(step, setup)) {
      const next = firstUnmetStep(setup);
      if (next !== step) await goto(STEPS[next]);
    }
  } finally {
    onboarding.checking = false;
  }
}

export async function allow(step: number) {
  await requestShizukuAccess(shizuku);
  await check(step);
}
