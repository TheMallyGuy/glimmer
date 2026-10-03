import type { InstallEntry } from "$ts/roblox/installation/installation";

export const installationsState = $state({
  versions: [] as InstallEntry[],
});
