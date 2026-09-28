<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown } from "$lib";
  import { appState } from "$lib/appState.svelte";

  const largeImagePresets = [
    { value: "icon", label: "Game icon" },
    { value: "gisl", label: "GAME IS LIFE!!!11" },
    { value: "interview", label: "i accidentally said [GAME NAME] in a job interview" },
    { value: "custom", label: "Custom" },
  ];
</script>

<SettingGroup>
  <SettingRow
    title="Activity watching"
    description="Let Glimmer see what you're playing right now."
  >
    {#snippet control()}
      <Switch
        label="Activity watching"
        bind:checked={appState.integrations.activityWatching.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Server location notifier"
    description="Notify the current server's location."
  >
    {#snippet control()}
      <Switch
        label="Server location notifier"
        bind:checked={appState.integrations.serverLocNotifer.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Discord Rich Presence"
    description="Show off what you're playing on Roblox!"
  >
    {#snippet control()}
      <Switch
        label="Discord Rich Presence"
        bind:checked={appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  {#if appState.integrations.discordRpc.enabled}
    <SettingRow
      title="Large image preset"
      description="What shows as the big image on your profile."
      class="pl-9"
    >
      {#snippet control()}
        <Dropdown
          label="Large image preset"
          size="sm"
          width="200px"
          options={largeImagePresets}
          bind:value={appState.integrations.discordRpc.largeImagePreset}
        />
      {/snippet}
    </SettingRow>
    {#if appState.integrations.discordRpc.largeImagePreset === "custom"}
      <SettingRow
        title="Custom image settings"
        description={appState.integrations.discordRpc.customImage.svgUrl ||
          "Set a template URL and options for this preset."}
        class="pl-9"
        href="/integrations/custom-image"
      />
    {/if}
  {/if}
  <SettingRow
    title="Show account on Discord"
    description="Discord Rich Presence is required turned on"
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label="Show account on Discord"
        bind:checked={appState.integrations.discordRpc.shareAccount}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Allow friends to join"
    description="Discord Rich Presence is required turned on"
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label="Allow friends to join"
        bind:checked={appState.integrations.discordRpc.join}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label="System">
  <SettingRow
    title="Close crash handler"
    description="Kills Roblox crash handler on launch"
  >
    {#snippet control()}
      <Switch
        label="Close crash handler"
        bind:checked={appState.integrations.closeCrashHandler.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Trim memory when not focused"
    description="Free memory while the client is in the background. [8damon/TASX-Roblox-Optimizer/]"
  >
    {#snippet control()}
      <Switch
        label="Trim memory when not focused"
        bind:checked={appState.integrations.trimMemWhenNotFocused.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Disable system tray icon"
    description="Disable Roblox's that annoying system tray icon"
  >
    {#snippet control()}
      <Switch
        label="Disable system tray icon"
        bind:checked={appState.integrations.disableSystemTray.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title="Disable fullscreen optimization"
    description="[SUPER DUPER EVIL DARK MAGIC] Disable fullscreen optimization!"
  >
    {#snippet control()}
      <Switch
        label="Disable fullscreen optimization"
        bind:checked={
          appState.integrations.disableFullscreenOptimization.enabled
        }
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
