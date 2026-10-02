<script lang="ts">
  import { ArrowLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { SettingGroup, SettingRow, TextField, Dropdown, Button } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { useIntlayer } from "svelte-intlayer";
  const customImageContent = useIntlayer("customImage");

  const overlays = [
    { value: "white", label: $customImageContent.colourWhite.value },
    { value: "black", label: $customImageContent.colourBlack.value },
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
  {$customImageContent.backToIntegrations.value}
</Button>

<SettingGroup label={$customImageContent.groupLabel.value}>
  <SettingRow
    title={$customImageContent.templateUrl.value}
    description={$customImageContent.templateUrlDescription.value}
  >
    {#snippet control()}
      <TextField
        label={$customImageContent.templateUrl.value}
        placeholder={$customImageContent.templateUrlPlaceholder.value}
        bind:value={customImage.svgUrl}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$customImageContent.badgeColour.value}
    description={$customImageContent.badgeColourDescription.value}
  >
    {#snippet control()}
      <Dropdown
        label={$customImageContent.badgeColour.value}
        size="sm"
        width="160px"
        options={overlays}
        bind:value={customImage.overlay}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$customImageContent.outputSize.value}
    description={$customImageContent.outputSizeDescription.value}
  >
    {#snippet control()}
      <TextField
        label={$customImageContent.outputSize.value}
        type="number"
        min="16"
        max="1024"
        class="w-[120px]"
        bind:value={customImage.size}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
