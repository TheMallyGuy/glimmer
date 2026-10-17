<script lang="ts">
    import { goto } from "$app/navigation";
  import { SettingGroup, SettingRow, Switch, toast } from "$lib";
  import { appState } from "$lib/appState.svelte";
    import { isAndroid } from "$ts/glimmer/android/platform";
    import { PathManager } from "$ts/glimmer/pathManager";
  import { getVersion } from "@tauri-apps/api/app";
    import { writeText } from "@tauri-apps/plugin-clipboard-manager";
    import { readTextFile } from "@tauri-apps/plugin-fs";
    import { openPath } from "@tauri-apps/plugin-opener";
  import { onMount } from "svelte";
  import { useIntlayer } from "svelte-intlayer";
  let glimmerVer = $state("v0.0.1");
  const aboutContent = useIntlayer("about");

  onMount(async () => {
    glimmerVer = await getVersion();
  });

  async function openLogs() {
    const pm = new PathManager()

    if (isAndroid()) {
      try {
        await writeText(await readTextFile(await pm.getGlimmerLog()))
        toast.success($aboutContent.logsCopied.value)
      } catch (e) {
        console.error("failed to copy the logs:", e)
        toast.error($aboutContent.logsCopyFailed.value)
      }
    } else {
      await openPath(await pm.getLogsFolder())
    }
  }
</script>

<div class="flex gap-1 flex-col">
  <SettingGroup>
    <SettingRow
      title={$aboutContent.glimmer.value}
      description={`v${glimmerVer} · ${$aboutContent.webBuild({ build: __BUILD_ID__ }).value} [aurora] AURORA [/aurora]`}
    />
    <SettingRow title={$aboutContent.logs.value} onclick={openLogs} href="#" />
    <SettingRow title={$aboutContent.sourceCode.value} href="#" />
    <SettingRow title="Dev Page" href="/about/dev"/>
  </SettingGroup>

  <SettingGroup label={$aboutContent.funGroup.value}>
    <SettingRow
      title={$aboutContent.redRings.value}
      description={$aboutContent.redRingsDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$aboutContent.redRings.value}
          bind:checked={appState.integrations.redRings.enabled}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>
