<script lang="ts">
  import { SettingGroup, SettingRow, Switch } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { getVersion } from "@tauri-apps/api/app";
  import { onMount } from "svelte";
  import { useIntlayer } from "svelte-intlayer";
  let glimmerVer = $state("v0.0.1");
  const aboutContent = useIntlayer("about");

  onMount(async () => {
    glimmerVer = await getVersion();
  });
</script>

<SettingGroup>
  <SettingRow title={$aboutContent.glimmer.value} description={`v${glimmerVer} AURORA`} />
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
