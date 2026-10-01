<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { _ } from "svelte-i18n";

  const largeImagePresets = [
    { value: "icon", label: $_("integrations.presetGameIcon") },
    { value: "gisl", label: $_("integrations.presetGameIsLife") },
    { value: "interview", label: $_("integrations.presetJobInterview") },
    { value: "custom", label: $_("integrations.presetCustom") },
  ];
</script>

<SettingGroup>
  <SettingRow
    title={$_("integrations.activityWatching")}
    description={$_("integrations.activityWatchingDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.activityWatching")}
        bind:checked={appState.integrations.activityWatching.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.serverLocationNotifier")}
    description={$_("integrations.serverLocationNotifierDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.serverLocationNotifier")}
        bind:checked={appState.integrations.serverLocNotifer.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.discordRichPresence")}
    description={$_("integrations.discordRichPresenceDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.discordRichPresence")}
        bind:checked={appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  {#if appState.integrations.discordRpc.enabled}
    <SettingRow
      title={$_("integrations.largeImagePreset")}
      description={$_("integrations.largeImagePresetDescription")}
      class="pl-9"
    >
      {#snippet control()}
        <Dropdown
          label={$_("integrations.largeImagePreset")}
          size="sm"
          width="200px"
          options={largeImagePresets}
          bind:value={appState.integrations.discordRpc.largeImagePreset}
        />
      {/snippet}
    </SettingRow>
    {#if appState.integrations.discordRpc.largeImagePreset === "custom"}
      <SettingRow
        title={$_("integrations.customImageSettings")}
        description={appState.integrations.discordRpc.customImage.svgUrl ||
          $_("integrations.customImageSettingsDescription")}
        class="pl-9"
        href="/integrations/custom-image"
      />
    {/if}
  {/if}
  <SettingRow
    title={$_("integrations.shareAccount")}
    description={$_("integrations.requiresDiscordRpc")}
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.shareAccount")}
        bind:checked={appState.integrations.discordRpc.shareAccount}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.allowFriendsToJoin")}
    description={$_("integrations.requiresDiscordRpc")}
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.allowFriendsToJoin")}
        bind:checked={appState.integrations.discordRpc.join}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label={$_("integrations.systemGroup")}>
  <SettingRow
    title={$_("integrations.closeCrashHandler")}
    description={$_("integrations.closeCrashHandlerDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.closeCrashHandler")}
        bind:checked={appState.integrations.closeCrashHandler.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.trimMemory")}
    description={$_("integrations.trimMemoryDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.trimMemory")}
        bind:checked={appState.integrations.trimMemWhenNotFocused.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.disableSystemTray")}
    description={$_("integrations.disableSystemTrayDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.disableSystemTray")}
        bind:checked={appState.integrations.disableSystemTray.enabled}
      />
    {/snippet}
  </SettingRow>
   <SettingRow
    title={$_("integrations.disableLaunchAtStartup")}
    description={$_("integrations.disableLaunchAtStartupDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.disableLaunchAtStartup")}
        bind:checked={appState.integrations.disableLaunchAtStartup.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("integrations.disableFullscreenOptimization")}
    description={$_("integrations.disableFullscreenOptimizationDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("integrations.disableFullscreenOptimization")}
        bind:checked={
          appState.integrations.disableFullscreenOptimization.enabled
        }
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
