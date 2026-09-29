<script lang="ts">
  import { ArrowLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { SettingGroup, SettingRow, TextField, Dropdown, Button } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { _ } from "svelte-i18n";

  const overlays = [
    { value: "white", label: $_("customImage.colourWhite") },
    { value: "black", label: $_("customImage.colourBlack") },
  ];

  const customImage = appState.integrations.discordRpc.customImage;
</script>

<Button
  variant="ghost"
  size="sm"
  class="-ml-2 mb-5"
  onclick={() => goto("/integrations")}
>
  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
  {$_("customImage.backToIntegrations")}
</Button>

<SettingGroup label={$_("customImage.groupLabel")}>
  <SettingRow
    title={$_("customImage.templateUrl")}
    description={$_("customImage.templateUrlDescription")}
  >
    {#snippet control()}
      <TextField
        label={$_("customImage.templateUrl")}
        placeholder={$_("customImage.templateUrlPlaceholder")}
        bind:value={customImage.svgUrl}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("customImage.badgeColour")}
    description={$_("customImage.badgeColourDescription")}
  >
    {#snippet control()}
      <Dropdown
        label={$_("customImage.badgeColour")}
        size="sm"
        width="160px"
        options={overlays}
        bind:value={customImage.overlay}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("customImage.outputSize")}
    description={$_("customImage.outputSizeDescription")}
  >
    {#snippet control()}
      <TextField
        label={$_("customImage.outputSize")}
        type="number"
        min="16"
        max="1024"
        class="w-[120px]"
        bind:value={customImage.size}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
