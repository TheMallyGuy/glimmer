import { isTauri } from "@tauri-apps/api/core";
import type { UnlistenFn } from "@tauri-apps/api/event";
import { installationsState } from "$lib/installations.svelte";
import { Installation } from "./installation";

/**
 * loads the current installed versions into `installationsState.versions`
 */
export async function watchInstallations(): Promise<UnlistenFn> {
  if (!isTauri()) return () => {};

  const i = await Installation.create();

  installationsState.versions = await i.listInstallations();

  return () => {};
}
