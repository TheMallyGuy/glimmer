<script lang="ts">
  import { SettingGroup, SettingRow, Switch } from "$lib";
  import { appState } from "$lib/appState.svelte";
    import { isAndroid } from "$ts/glimmer/android/platform";
    import { PathManager } from "$ts/glimmer/pathManager";
  import { getVersion } from "@tauri-apps/api/app";
    import { join } from "@tauri-apps/api/path";
    import { writeText } from "@tauri-apps/plugin-clipboard-manager";
    import { readTextFile } from "@tauri-apps/plugin-fs";
    import { info } from "@tauri-apps/plugin-log";
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
    const logsFolder = await pm.getLogsFolder()
    
    if (isAndroid()) {
      const content = await readTextFile(logsFolder)
      await writeText(content)
      info($aboutContent.logsCopied.value)
    } else {
      await openPath(logsFolder)
    }
  }
</script>

<div class="flex gap-1 flex-col">
  <SettingGroup>
    <SettingRow
      title={$aboutContent.glimmer.value}
      description={`v${glimmerVer} [aurora] AURORA [/aurora]`}
    />
    <SettingRow title={$aboutContent.logs.value} onclick={openLogs} href="#" />
    <SettingRow title={$aboutContent.sourceCode.value} href="#" />
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
