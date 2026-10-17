<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown } from "$lib";
  import {
    appState,
    fleasionState,
    setFleasionInstallation,
  } from "$lib/appState.svelte";
  import { isTauri } from "@tauri-apps/api/core";
  import { FleasionConfig } from "$ts/fleasion";
  import { onMount } from "svelte";
  import { useIntlayer } from "svelte-intlayer";

  const integrationsContent = useIntlayer("integrations");

  const largeImagePresets = [
    { value: "aurora", label: $integrationsContent.presetAurora.value },
    { value: "icon", label: $integrationsContent.presetGameIcon.value },
    { value: "gisl", label: $integrationsContent.presetGameIsLife.value },
    {
      value: "interview",
      label: $integrationsContent.presetJobInterview.value,
    },
    { value: "custom", label: $integrationsContent.presetCustom.value },
  ];

  onMount(async () => {
    if (!isTauri()) return;
    setFleasionInstallation(await new FleasionConfig().isInstalled());
  });
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
    title={$integrationsContent.nearbyServer.value}
    description={$integrationsContent.nearbyServerDescription.value +
      " " +
      $integrationsContent.nearbyServerAdditionalDescriptionAndroid.value}
  >
    {#snippet control()}
      <Switch
        label={$integrationsContent.nearbyServer.value}
        bind:checked={appState.integrations.nearbyServer.enabled}
      />
    {/snippet}
  </SettingRow>
  {#if appState.integrations.nearbyServer.enabled}
    <SettingRow
      title={$integrationsContent.nearbyServerRandomize.value}
      description={$integrationsContent.nearbyServerRandomizeDescription.value}
      class="pl-9"
    >
      {#snippet control()}
        <Switch
          label={$integrationsContent.nearbyServerRandomize.value}
          bind:checked={appState.integrations.nearbyServer.randomize}
        />
      {/snippet}
    </SettingRow>
  {/if}
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

{#if !appState.android}
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
      description={appState.integrations.fleasion.enabled
        ? $integrationsContent.offWithFleasion.value
        : $integrationsContent.trimMemoryDescription.value}
      disabled={appState.integrations.fleasion.enabled}
    >
      {#snippet control()}
        <Switch
          label={$integrationsContent.trimMemory.value}
          bind:checked={appState.integrations.trimMemWhenNotFocused.enabled}
          disabled={appState.integrations.fleasion.enabled}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$integrationsContent.inGameMenu.value}
      description={appState.integrations.fleasion.enabled
        ? $integrationsContent.offWithFleasion.value
        : $integrationsContent.inGameMenuDescription.value}
      disabled={appState.integrations.fleasion.enabled}
    >
      {#snippet control()}
        <Switch
          label={$integrationsContent.inGameMenu.value}
          bind:checked={appState.integrations.inGameMenu.enabled}
          disabled={appState.integrations.fleasion.enabled}
        />
      {/snippet}
    </SettingRow>
    {#if appState.integrations.inGameMenu.enabled && !appState.integrations.fleasion.enabled}
      <SettingRow
        title={$integrationsContent.boardEditor.value}
        description={$integrationsContent.boardEditorDescription.value}
        class="pl-9"
        href="/integrations/board"
      />
    {/if}
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
      description={$integrationsContent.disableFullscreenOptimizationDescription
        .value}
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
{/if}

{#if fleasionState.installed}
  <SettingGroup label="Fleasion">
    <SettingRow
      title={$integrationsContent.fleasion}
      description={`[danger]${$integrationsContent.fleasionDescription}`}
      href="/integrations/fleasion"
    />
  </SettingGroup>

  <div class="h-7"></div>
{/if}

<SettingGroup label={$integrationsContent.friendsGroup.value}>
  <SettingRow
    title={$integrationsContent.linkTitle.value}
    description={$integrationsContent.linkDescription.value}
    href="/integrations/link"
  />
</SettingGroup>
