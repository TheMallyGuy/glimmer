<script lang="ts">
  import { ArrowLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { SettingGroup, SettingRow, TextField, Dropdown, Button } from "$lib";
  import { appState } from "$lib/appState.svelte";

  const overlays = [
    { value: "white", label: "White" },
    { value: "black", label: "Black" },
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
  Back to integrations
</Button>

<SettingGroup label="Custom large image">
  <SettingRow
    title="Template URL"
    description="Fetched instead of the bundled template. Needs the same #GAME_THUMBNAIL structure."
  >
    {#snippet control()}
      <TextField
        label="Template URL"
        placeholder="https://example.com/template.svg"
        bind:value={customImage.svgUrl}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Badge colour"
    description="Fill colour for the Glimmer badge stamped on the image."
  >
    {#snippet control()}
      <Dropdown
        label="Badge colour"
        size="sm"
        width="160px"
        options={overlays}
        bind:value={customImage.overlay}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Output size"
    description="Rendered size in pixels, 16-1024."
  >
    {#snippet control()}
      <TextField
        label="Output size"
        type="number"
        min="16"
        max="1024"
        class="w-[120px]"
        bind:value={customImage.size}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
