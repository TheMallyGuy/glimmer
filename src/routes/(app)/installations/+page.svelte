<script lang="ts">
  import {
    SettingGroup,
    SettingRow,
    Switch,
    Dropdown,
    Button,
    IconButton,
    Dialog,
    TextField,
  } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { installationsState } from "$lib/installations.svelte";
  import {
    Installation,
    type InstallEntry,
  } from "$ts/roblox/installation/installation";
  import {
    Downloader,
    type Distribution,
  } from "$ts/roblox/installation/download";
  import {
    DEFAULT_BASE_URLS,
    installVersion,
    installName,
    type InstallProgress,
  } from "$ts/roblox/installation";
  import { openPath } from "@tauri-apps/plugin-opener";
  import { error as logError } from "@tauri-apps/plugin-log";
  import { Plus, FolderOpen, Trash2 } from "@lucide/svelte";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const installationsContent = useIntlayer("installations");
  const installationsManageContent = useIntlayer("installationsManage");

  const concurrencyOptions = [1, 2, 3, 4, 5, 6, 8].map((n) => ({
    value: String(n),
    label: String(n),
  }));

  async function setActive(entry: InstallEntry) {
    const i = await Installation.create(false);
    i.installedVersions = installationsState.versions;
    await i.setActiveVersion(entry.version);
    installationsState.versions = i.installedVersions;
  }

  async function openFolder(entry: InstallEntry) {
    try {
      await openPath(entry.path);
    } catch (e) {
      logError(`failed to open installation folder: ${e}`);
    }
  }

  let deleteTarget = $state<InstallEntry | null>(null);
  let deleteConfirmOpen = $state(false);

  function askDelete(entry: InstallEntry) {
    deleteTarget = entry;
    deleteConfirmOpen = true;
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    const i = await Installation.create(false);
    i.installedVersions = installationsState.versions;
    await i.removeInstallation(deleteTarget.version);
    installationsState.versions = i.installedVersions;

    deleteConfirmOpen = false;
  }

  let addOpen = $state(false);
  let versionHash = $state("");
  let installAsVng = $state(false);
  let installing = $state(false);
  let installStatus = $state("");
  let installProgress = $state<number | null>(null);
  let installError = $state<string | null>(null);

  let vngSwitchChecked = $state(appState.installations.vngDistribution.enabled);
  let vngWarningStep = $state(0);

  function onVngToggle(next: boolean) {
    if (next) {
      vngWarningStep = 1;
    } else {
      appState.installations.vngDistribution.enabled = false;
    }
  }

  function vngWarningContinue() {
    if (vngWarningStep < 3) {
      vngWarningStep += 1;
    } else {
      appState.installations.vngDistribution.enabled = true;
      vngWarningStep = 0;
    }
  }

  function vngWarningCancel() {
    vngWarningStep = 0;
    vngSwitchChecked = appState.installations.vngDistribution.enabled;
  }

  function onVngDialogClose() {
    vngWarningStep = 0;
    vngSwitchChecked = appState.installations.vngDistribution.enabled;
  }

  function openAdd() {
    versionHash = "";
    installAsVng = appState.installations.vngDistribution.enabled;
    installError = null;
    addOpen = true;
  }

  async function startInstall() {
    installing = true;
    installError = null;

    try {
      const distribution: Distribution = installAsVng ? "vng" : "global";
      const d = await Downloader.create(DEFAULT_BASE_URLS, distribution);
      const version =
        versionHash.trim() || (await d.fetchLatestVersion("WindowsPlayer"));
      const name = installName(version, distribution);

      if (installationsState.versions.some((v) => v.version === name)) {
        installError = $installationsManageContent.alreadyInstalled({ version: name }).value;
        return;
      }

      const i = await Installation.create(false);
      i.installedVersions = installationsState.versions;

      await installVersion(
        d,
        i,
        version,
        appState.installations.parallelDownloader.value,
        (p: InstallProgress) => {
          switch (p.status) {
            case "fetchingManifest":
              installStatus = $installationsManageContent.fetchingManifest.value;
              installProgress = null;
              break;
            case "downloading":
              installStatus = $installationsManageContent.downloadingClient({ done: p.done, total: p.total }).value;
              installProgress = p.percent;
              break;
            case "extracting":
              installStatus = $installationsManageContent.extractingClient({ done: p.done, total: p.total }).value;
              installProgress = p.percent;
              break;
            case "finishing":
              installStatus = $installationsManageContent.finishingInstallation.value;
              installProgress = null;
              break;
          }
        },
      );

      installationsState.versions = i.installedVersions;
      addOpen = false;
    } catch (e) {
      installError = e instanceof Error ? e.message : String(e);
    } finally {
      installing = false;
    }
  }
</script>

<div class="flex flex-col gap-7">
  <section class="flex flex-col gap-3">
    <div class="flex items-center gap-1">
      <p class="m-0 grow text-[13px] text-muted">
        {#if installationsState.versions.length}
          {$installationsManageContent.versionCount(installationsState.versions.length)({ count: installationsState.versions.length }).value}
        {/if}
      </p>
      <Button variant="primary" size="sm" onclick={openAdd}>
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        {$installationsManageContent.addInstallation.value}
      </Button>
    </div>

    {#if installationsState.versions.length === 0}
      <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-8">
        <p class="m-0 text-sm text-muted">
          {$installationsManageContent.emptyNoInstallations.value}
        </p>
        <Button size="sm" onclick={openAdd}>
          {$installationsManageContent.addInstallation.value}
        </Button>
      </div>
    {:else}
      <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
        {#each installationsState.versions as entry (entry.version)}
          <li class="flex items-center gap-4 bg-row px-[18px] py-4">
            <div class="flex min-w-0 grow flex-col gap-[3px]">
              <div class="flex items-center gap-2">
                <span class="truncate font-mono text-[15px] font-medium text-fg"
                  >{entry.version}</span
                >
                {#if entry.active}
                  <span class="shrink-0 text-xs text-accent"
                    >{$installationsManageContent.active.value}</span
                  >
                {/if}
                {#if entry.vng}
                  <span class="shrink-0 text-xs text-muted"
                    >{$installationsManageContent.vngTag.value}</span
                  >
                {/if}
              </div>
              <div class="truncate text-[13px] text-muted">{entry.path}</div>
            </div>
            <div class="flex shrink-0 items-center gap-1">
              {#if !entry.active}
                <Button
                  variant="secondary"
                  size="sm"
                  onclick={() => setActive(entry)}
                >
                  {$installationsManageContent.setActive.value}
                </Button>
              {/if}
              <IconButton
                label={$installationsManageContent.openFolderForVersion({ version: entry.version }).value}
                variant="ghost"
                size="sm"
                onclick={() => openFolder(entry)}
              >
                <FolderOpen size={16} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
              <IconButton
                label={entry.active
                  ? $installationsManageContent.cantDeleteActive.value
                  : $installationsManageContent.deleteVersion({ version: entry.version }).value}
                variant="ghost"
                size="sm"
                disabled={entry.active}
                onclick={() => askDelete(entry)}
              >
                <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
              </IconButton>
            </div>
          </li>
        {/each}
      </ul>
    {/if}
  </section>

  <SettingGroup label={$installationsManageContent.settingsGroup.value}>
    <SettingRow
      title={$installationsContent.parallelDownloads.value}
      description={$installationsContent.parallelDownloadsDescription.value}
    >
      {#snippet control()}
        <Dropdown
          label={$installationsContent.parallelDownloads.value}
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
      title={$installationsContent.forceReinstallRoblox.value}
      description={$installationsContent.forceReinstallRobloxDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$installationsContent.forceReinstallRoblox.value}
          bind:checked={appState.installations.forceReinstallRoblox.enabled}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$installationsContent.disableRobloxUpgrades.value}
      description={$installationsContent.disableRobloxUpgradesDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$installationsContent.disableRobloxUpgrades.value}
          bind:checked={appState.installations.disableRobloxUpgrade.enabled}
        />
      {/snippet}
    </SettingRow>
    <SettingRow
      title={$installationsContent.vngDistribution.value}
      description={$installationsContent.vngDistributionDescription.value}
    >
      {#snippet control()}
        <Switch
          label={$installationsContent.vngDistribution.value}
          bind:checked={vngSwitchChecked}
          onchange={onVngToggle}
        />
      {/snippet}
    </SettingRow>
  </SettingGroup>
</div>

<Dialog
  bind:open={addOpen}
  title={$installationsManageContent.addInstallation.value}
  closeOnBackdrop={!installing}
>
  {#if installing}
    <div class="flex flex-col gap-2">
      <div class="flex items-baseline gap-3">
        <p class="m-0 grow truncate text-sm text-fg-2">{installStatus}…</p>
        {#if installProgress !== null}
          <span class="text-sm text-fg tabular-nums"
            >{Math.round(installProgress)}%</span
          >
        {/if}
      </div>
      <div
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={installProgress ?? undefined}
        class="h-0.5 w-full overflow-hidden bg-track"
      >
        {#if installProgress !== null}
          <div
            class="h-full bg-accent transition-[width] duration-200 ease-out motion-reduce:transition-none"
            style:width="{installProgress}%"
          ></div>
        {/if}
      </div>
    </div>
  {:else}
    {#if installError}
      <p class="m-0 mb-1 text-[13px] text-danger">{installError}</p>
    {/if}
    <TextField
      label={$installationsManageContent.versionHash.value}
      placeholder={$installationsManageContent.versionHashPlaceholder.value}
      hint={$installationsManageContent.versionHashHint.value}
      bind:value={versionHash}
    />
    <div class="mt-3 flex items-center justify-between gap-4">
      <div class="flex flex-col gap-[3px]">
        <span class="text-[13px] text-fg-2">
          {$installationsManageContent.installAsVng.value}
        </span>
        <span class="text-[13px] text-muted">
          {$installationsManageContent.installAsVngHint.value}
        </span>
      </div>
      <Switch
        label={$installationsManageContent.installAsVng.value}
        bind:checked={installAsVng}
      />
    </div>
  {/if}
  {#snippet actions()}
    {#if !installing}
      <Button variant="ghost" onclick={() => (addOpen = false)}>
        {$commonContent.cancel.value}
      </Button>
      <Button variant="primary" onclick={startInstall}>
        {$installationsManageContent.install.value}
      </Button>
    {/if}
  {/snippet}
</Dialog>

<Dialog
  bind:open={deleteConfirmOpen}
  title={$installationsManageContent.deleteInstallationTitle.value}
>
  <p class="m-0">
    {$installationsManageContent.deleteInstallationBody({ version: deleteTarget?.version ?? "" }).value}
  </p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (deleteConfirmOpen = false)}>
      {$commonContent.cancel.value}
    </Button>
    <Button variant="danger" onclick={confirmDelete}>
      {$installationsManageContent.delete.value}
    </Button>
  {/snippet}
</Dialog>

{#if vngWarningStep === 1}
  <Dialog
    open
    title={$installationsContent.vngWarningTitle1.value}
    onclose={onVngDialogClose}
  >
    <p class="m-0 mb-1 text-xs text-muted">
      {$installationsContent.vngWarningStepLabel({ step: 1 }).value}
    </p>
    <p class="m-0 text-accent">{$installationsContent.vngWarning1.value}</p>
    {#snippet actions()}
      <Button variant="ghost" onclick={vngWarningContinue}>
        {$installationsContent.vngWarningContinue.value}
      </Button>
      <Button variant="primary" onclick={vngWarningCancel}>
        {$commonContent.cancel.value}
      </Button>
    {/snippet}
  </Dialog>
{:else if vngWarningStep === 2}
  <Dialog
    open
    title={$installationsContent.vngWarningTitle2.value}
    onclose={onVngDialogClose}
  >
    <p class="m-0 mb-1 text-xs text-muted">
      {$installationsContent.vngWarningStepLabel({ step: 2 }).value}
    </p>
    <p class="m-0 text-accent">{$installationsContent.vngWarning2.value}</p>
    {#snippet actions()}
      <Button variant="ghost" onclick={vngWarningContinue}>
        {$installationsContent.vngWarningContinue.value}
      </Button>
      <Button variant="primary" onclick={vngWarningCancel}>
        {$commonContent.cancel.value}
      </Button>
    {/snippet}
  </Dialog>
{:else if vngWarningStep === 3}
  <Dialog
    open
    title={$installationsContent.vngWarningTitle3.value}
    onclose={onVngDialogClose}
  >
    <p class="m-0 mb-1 text-xs text-muted">
      {$installationsContent.vngWarningStepLabel({ step: 3 }).value}
    </p>
    <p class="m-0 text-accent">{$installationsContent.vngWarning3.value}</p>
    {#snippet actions()}
      <Button variant="ghost" onclick={vngWarningContinue}>
        {$installationsContent.vngWarningContinue.value}
      </Button>
      <Button variant="primary" onclick={vngWarningCancel}>
        {$commonContent.cancel.value}
      </Button>
    {/snippet}
  </Dialog>
{/if}
