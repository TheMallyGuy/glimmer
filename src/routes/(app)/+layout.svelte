<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { isTauri } from "@tauri-apps/api/core";
  import { sizeWindow } from "$lib/window";
  import {
    Plug,
    Package,
    Flag,
    HardDriveDownload,
    Users,
    Palette,
    Info,
    Minus,
    X,
  } from "@lucide/svelte";
  import {
    TabBar,
    SearchField,
    IconButton,
    Button,
    SplitButton,
    type Tab,
  } from "$lib";
  import { prefs, save, discard, launch } from "$lib/settings.svelte";
  import { installationsState } from "$lib/installations.svelte";
  import { watchInstallations } from "$ts/roblox/installation/watcher";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { useIntlayer } from "svelte-intlayer";
  const appLayoutContent = useIntlayer("appLayout");
  const commonContent = useIntlayer("common");

  let { children }: { children: Snippet } = $props();

  const tabs: Tab[] = [
    {
      id: "integrations",
      label: $appLayoutContent.tabIntegrations.value,
      icon: Plug,
    },
    { id: "mods", label: $appLayoutContent.tabMods.value, icon: Package },
    { id: "flags", label: $appLayoutContent.tabFastFlags.value, icon: Flag },
    {
      id: "installations",
      label: $appLayoutContent.tabInstallations.value,
      icon: HardDriveDownload,
    },
    { id: "accounts", label: $appLayoutContent.tabAccounts.value, icon: Users },
    { id: "appearance", label: $appLayoutContent.tabAppearance.value, icon: Palette },
    { id: "about", label: $appLayoutContent.tabAbout.value, icon: Info },
  ];

  const titles: Record<string, [string, string]> = {
    integrations: [
      $appLayoutContent.tabIntegrations.value,
      $appLayoutContent.integrationsBlurb.value,
    ],
    mods: [$appLayoutContent.tabMods.value, $appLayoutContent.modsBlurb.value],
    flags: [
      $appLayoutContent.tabFastFlags.value,
      $appLayoutContent.flagsBlurb.value,
    ],
    installations: [
      $appLayoutContent.tabInstallations.value,
      $appLayoutContent.installationsBlurb.value,
    ],
    accounts: [
      $appLayoutContent.tabAccounts.value,
      $appLayoutContent.accountsBlurb.value,
    ],
    appearance: [
      $appLayoutContent.tabAppearance.value,
      $appLayoutContent.appearanceBlurb.value,
    ],
    about: [
      $appLayoutContent.tabAbout.value,
      $appLayoutContent.aboutBlurb.value,
    ],
  };

  const section = $derived(page.url.pathname.split("/")[1] || "mods");
  const [heading, blurb] = $derived(titles[section] ?? ["", ""]);

  // there is no window outside Tauri (e.g. in the intlayer editor)
  const appWindow = isTauri() ? getCurrentWindow() : null;

  const activeVersion = $derived(
    installationsState.versions.find((v) => v.active),
  );
  const bottomVerionText = $derived(
    activeVersion ? `LIVE · ${activeVersion.version}` : "",
  );

  let stopWatching: UnlistenFn | undefined;

  onMount(async () => {
    sizeWindow(1184, 834);
    appWindow?.setResizable(true);

    stopWatching = await watchInstallations();
  });

  onDestroy(() => stopWatching?.());
</script>

<div class="flex h-screen flex-col bg-app">
  <header class="shrink-0 bg-surface">
    <div data-tauri-drag-region class="flex h-16 items-center gap-2 pr-2 pl-6">
      <img
        src="/glimmer-logo.svg"
        alt="Glimmer"
        height="14"
        class="pointer-events-none"
      />
      <div data-tauri-drag-region class="h-full grow"></div>
      <SearchField
        label={$appLayoutContent.searchAllSettings.value}
        bind:value={prefs.query}
      />
      <IconButton
        label={$commonContent.minimize.value}
        variant="ghost"
        onclick={() => appWindow?.minimize()}
      >
        <Minus size={14} strokeWidth={1.5} />
      </IconButton>
      <IconButton
        label={$commonContent.close.value}
        variant="ghost"
        onclick={() => appWindow?.close()}
      >
        <X size={14} strokeWidth={1.5} />
      </IconButton>
    </div>
    <TabBar
      {tabs}
      value={section}
      onchange={(id) => goto(`/${id}`)}
      label={$appLayoutContent.settingsSections.value}
      class="px-[18px]"
    />
  </header>

  <main class="min-h-0 grow overflow-auto px-8 py-7">
    <div role="tabpanel" aria-labelledby="gl-tab-{section}">
      <h1
        class="m-0 mb-1.5 font-display text-[32px] font-normal tracking-[0.01em]"
      >
        {heading}
      </h1>
      <p class="m-0 mb-7 max-w-[520px] text-sm text-muted">{blurb}</p>
      {@render children()}
    </div>
  </main>

  <footer class="flex h-16 shrink-0 items-center gap-1 bg-footer pr-6 pl-8">
    <span class="grow text-xs text-muted">{bottomVerionText}</span>
    <Button variant="ghost" onclick={discard}
      >{$commonContent.discard.value}</Button
    >
    <Button onclick={save}>{$commonContent.save.value}</Button>
    <SplitButton
      class="ml-1"
      label={$appLayoutContent.saveAndLaunch.value}
      bind:value={prefs.target}
      options={[
        {
          value: "player",
          label: $commonContent.player.value,
          description: $appLayoutContent.launchGame.value,
        },
        {
          value: "studio",
          label: $commonContent.studio.value,
          description: $appLayoutContent.launchStudioDescription.value,
        },
      ]}
      onclick={launch}
    />
  </footer>
</div>
