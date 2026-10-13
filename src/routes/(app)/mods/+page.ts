import { appState, loadAppState } from "$lib/appState.svelte";
import { redirect } from "@sveltejs/kit";

export const load = async ({ url }) => {
  const last = url.searchParams.has("last");
  if (last) await loadAppState(); // this runs before the root layout has loaded the saved page
  const target = last || appState.page.startsWith("/mods/") ? appState.page : "/mods/manage";
  redirect(307, target);
};
