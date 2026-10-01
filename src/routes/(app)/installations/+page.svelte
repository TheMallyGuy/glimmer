<script lang="ts">
  import { SettingGroup, SettingRow, Switch, Dropdown } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { _ } from "svelte-i18n";

  const concurrencyOptions = [1, 2, 3, 4, 5, 6, 8].map((n) => ({
    value: String(n),
    label: String(n),
  }));
</script>

<SettingGroup>
  <SettingRow
    title={$_("installations.parallelDownloads")}
    description={$_("installations.parallelDownloadsDescription")}
  >
    {#snippet control()}
      <Dropdown
        label={$_("installations.parallelDownloads")}
        size="sm"
        width="180px"
        value={String(appState.installations.parallelDownloader.value)}
        options={concurrencyOptions}
        onchange={(v) =>
          (appState.installations.parallelDownloader.value = Number(v))}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("installations.forceReinstallRoblox")}
    description={$_("installations.forceReinstallRobloxDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("installations.forceReinstallRoblox")}
        bind:checked={appState.installations.forceReinstallRoblox.enabled}
      />
    {/snippet}
  </SettingRow>
  <SettingRow
    title={$_("installations.disableRobloxUpgrades")}
    description={$_("installations.disableRobloxUpgradesDescription")}
  >
    {#snippet control()}
      <Switch
        label={$_("installations.disableRobloxUpgrades")}
        bind:checked={appState.installations.disableRobloxUpgrade.enabled}
      />
    {/snippet}
  </SettingRow>
</SettingGroup>
