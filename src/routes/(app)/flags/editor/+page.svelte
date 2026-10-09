<script lang="ts">
  import { FlagTable, toast } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { mergeFlags } from "$lib/flags";
  import { hiddenFlags } from "$ts/roblox/fastflag/fleasionPresets";
  import {
    InstalledFlagsError,
    applyInstalledFlags,
    readInstalledFlags,
  } from "$ts/roblox/fastflag/installed";
  import { useIntlayer } from "svelte-intlayer";
  const flagTableContent = useIntlayer("flagTable");

  async function load() {
    try {
      const incoming = await readInstalledFlags(await hiddenFlags(appState.integrations.fleasion));
      if (incoming.length === 0) {
        toast.show($flagTableContent.loadedNothing.value);
        return;
      }
      const { added, updated } = mergeFlags(appState.fastflags.flags, incoming);
      toast.success($flagTableContent.loaded({ added, updated }).value);
    } catch (e) {
      toast.error(
        e instanceof InstalledFlagsError && e.kind === "invalid"
          ? $flagTableContent.loadFailedInvalid.value
          : $flagTableContent.loadFailedNoInstall.value,
      );
    }
  }

  async function apply() {
    try {
      await applyInstalledFlags(appState.fastflags.flags, await hiddenFlags(appState.integrations.fleasion));
      const count = appState.fastflags.flags.length;
      toast.success($flagTableContent.applied(count)({ count }).value);
    } catch (e) {
      toast.error(
        e instanceof InstalledFlagsError
          ? $flagTableContent.loadFailedNoInstall.value
          : `${$flagTableContent.applyFailed.value}: ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
</script>

<FlagTable
  bind:flags={appState.fastflags.flags}
  onload={load}
  onapply={apply}
  applyDisabled={!appState.fastflags.enabled}
/>
