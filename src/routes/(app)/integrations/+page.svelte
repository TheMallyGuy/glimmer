<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { useIntlayer } from "svelte-intlayer";
  const integrationsContent = useIntlayer("integrations");

  const largeImagePresets = [
    { value: "icon", label: $integrationsContent.presetGameIcon.value },
    { value: "gisl", label: $integrationsContent.presetGameIsLife.value },
    { value: "interview", label: $integrationsContent.presetJobInterview.value },
    { value: "custom", label: $integrationsContent.presetCustom.value },
  ];
</script>

<SettingGroup>
  <SettingRow
    title={$integrationsContent.activityWatching.value}
    description={$integrationsContent.activityWatchingDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.activityWatching.value}
        bind:checked={appState.integrations.activityWatching.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.serverLocationNotifier.value}
    description={$integrationsContent.serverLocationNotifierDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.serverLocationNotifier.value}
        bind:checked={appState.integrations.serverLocNotifer.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.discordRichPresence.value}
    description={$integrationsContent.discordRichPresenceDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.discordRichPresence.value}
        bind:checked={appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  {#if appState.integrations.discordRpc.enabled}
    <SettingRow
      title={$integrationsContent.largeImagePreset.value}
      description={$integrationsContent.largeImagePresetDescription.value}
      class="pl-9"
    >
      {#snippet control()}
        <Dropdown
          label={$integrationsContent.largeImagePreset.value}
          size="sm"
          width="200px"
          options={largeImagePresets}
          bind:value={appState.integrations.discordRpc.largeImagePreset}
        />
      {/snippet}
    </SettingRow>
    {#if appState.integrations.discordRpc.largeImagePreset === "custom"}
      <SettingRow
        title={$integrationsContent.customImageSettings.value}
        description={appState.integrations.discordRpc.customImage.svgUrl ||
          $integrationsContent.customImageSettingsDescription.value}
        class="pl-9"
        href="/integrations/custom-image"
      />
    {/if}
  {/if}
  <SettingRow
    title={$integrationsContent.shareAccount.value}
    description={$integrationsContent.requiresDiscordRpc.value}
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.shareAccount.value}
        bind:checked={appState.integrations.discordRpc.shareAccount}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.allowFriendsToJoin.value}
    description={$integrationsContent.requiresDiscordRpc.value}
    disabled={!appState.integrations.discordRpc.enabled}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.allowFriendsToJoin.value}
        bind:checked={appState.integrations.discordRpc.join}
        disabled={!appState.integrations.discordRpc.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label={$integrationsContent.systemGroup.value}>
  <SettingRow
    title={$integrationsContent.closeCrashHandler.value}
    description={$integrationsContent.closeCrashHandlerDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.closeCrashHandler.value}
        bind:checked={appState.integrations.closeCrashHandler.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.trimMemory.value}
    description={$integrationsContent.trimMemoryDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.trimMemory.value}
        bind:checked={appState.integrations.trimMemWhenNotFocused.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.windowControl.value}
    description={$integrationsContent.windowControlDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.windowControl.value}
        bind:checked={appState.integrations.windowControl.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.disableSystemTray.value}
    description={$integrationsContent.disableSystemTrayDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.disableSystemTray.value}
        bind:checked={appState.integrations.disableSystemTray.enabled}
      />
    {/snippet}
  </SettingRow>
   <SettingRow
    title={$integrationsContent.disableLaunchAtStartup.value}
    description={$integrationsContent.disableLaunchAtStartupDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.disableLaunchAtStartup.value}
        bind:checked={appState.integrations.disableLaunchAtStartup.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$integrationsContent.disableFullscreenOptimization.value}
    description={$integrationsContent.disableFullscreenOptimizationDescription.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.disableFullscreenOptimization.value}
        bind:checked={
          appState.integrations.disableFullscreenOptimization.enabled
        }
      />
    {/snippet}
  </SettingRow>
</SettingGroup>

<div class="h-7"></div>

<SettingGroup label={$integrationsContent.friendsGroup.value}>
  <SettingRow
    title={$integrationsContent.linkTitle.value}
    description={$integrationsContent.linkDescription.value}
    href="/integrations/link"
  />
</SettingGroup>
