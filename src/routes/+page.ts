import { redirect } from "@sveltejs/kit";
import { isAndroid } from "$ts/glimmer/android/platform";

export const load = () => redirect(307, isAndroid() ? "/onboarding/mobile" : "/choose");
