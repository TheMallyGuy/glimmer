<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/state";
  import { goto } from "$app/navigation";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { sizeWindow } from "$lib/window";
  import {
    Plug,
    Package,
    Flag,
    HardDriveDownload,
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
  import { _ } from "svelte-i18n";

  let { children }: { children: Snippet } = $props();

  const tabs: Tab[] = [
    { id: "integrations", label: $_("appLayout.tabIntegrations"), icon: Plug },
    { id: "mods", label: $_("appLayout.tabMods"), icon: Package },
    { id: "flags", label: $_("appLayout.tabFastFlags"), icon: Flag },
    { id: "installations", label: $_("appLayout.tabInstallations"), icon: HardDriveDownload },
    { id: "about", label: $_("appLayout.tabAbout"), icon: Info },
  ];

  const titles: Record<string, [string, string]> = {
    integrations: [
      $_("appLayout.tabIntegrations"),
      $_("appLayout.integrationsBlurb"),
    ],
    mods: [
      $_("appLayout.tabMods"),
      $_("appLayout.modsBlurb"),
    ],
    flags: [
      $_("appLayout.tabFastFlags"),
      $_("appLayout.flagsBlurb"),
    ],
    installations: [
      $_("appLayout.tabInstallations"),
      $_("appLayout.installationsBlurb"),
    ],
    about: [$_("appLayout.tabAbout"), $_("appLayout.aboutBlurb")],
  };

  const section = $derived(page.url.pathname.split("/")[1] || "mods");
  const [heading, blurb] = $derived(titles[section] ?? ["", ""]);

  const appWindow = getCurrentWindow();

  const activeVersion = $derived(
    installationsState.versions.find((v) => v.active),
  );
  const bottomVerionText = $derived(
    activeVersion ? `LIVE · ${activeVersion.version}` : "",
  );

  let stopWatching: UnlistenFn | undefined;

  onMount(async () => {
    sizeWindow(1184, 834);
    appWindow.setResizable(true);

    stopWatching = await watchInstallations();
  });

  onDestroy(() => stopWatching?.());
</script>

<div class="flex h-screen flex-col bg-canvas">
  <header class="shrink-0 bg-surface">
    <div data-tauri-drag-region class="flex h-16 items-center gap-2 pr-2 pl-6">
      <img
        src="/glimmer-logo.svg"
        alt="Glimmer"
        height="14"
        class="pointer-events-none"
      />
      <div data-tauri-drag-region class="h-full grow"></div>
      <SearchField label={$_("appLayout.searchAllSettings")} bind:value={prefs.query} />
      <IconButton
        label={$_("common.minimize")}
        variant="ghost"
        onclick={() => appWindow.minimize()}
      >
        <Minus size={14} strokeWidth={1.5} />
      </IconButton>
      <IconButton
        label={$_("common.close")}
        variant="ghost"
        onclick={() => appWindow.close()}
      >
        <X size={14} strokeWidth={1.5} />
      </IconButton>
    </div>
    <TabBar
      {tabs}
      value={section}
      onchange={(id) => goto(`/${id}`)}
      label={$_("appLayout.settingsSections")}
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
    <Button variant="ghost" onclick={discard}>{$_("common.discard")}</Button>
    <Button onclick={save}>{$_("common.save")}</Button>
    <SplitButton
      class="ml-1"
      label={$_("appLayout.saveAndLaunch")}
      bind:value={prefs.target}
      options={[
        {
          value: "player",
          label: $_("common.player"),
          description: $_("appLayout.launchGame"),
        },
        {
          value: "studio",
          label: $_("common.studio"),
          description: $_("appLayout.launchStudioDescription"),
        },
      ]}
      onclick={launch}
    />
  </footer>
</div>
