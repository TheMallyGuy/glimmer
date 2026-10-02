<script lang="ts">
  import { SettingGroup, SettingRow, Switch } from '$lib';
  import { appState } from '$lib/appState.svelte';
  import { useIntlayer } from "svelte-intlayer";
  const aboutContent = useIntlayer("about");
</script>

<SettingGroup>
  <SettingRow title={$aboutContent.glimmer.value} description={$aboutContent.version.value} />
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
