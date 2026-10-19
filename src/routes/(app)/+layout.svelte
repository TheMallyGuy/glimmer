<script lang="ts">
  import type { Snippet } from "svelte";
  import { onMount, onDestroy, tick } from "svelte";
  import { page } from "$app/state";
  import { afterNavigate, goto } from "$app/navigation";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { isTauri } from "@tauri-apps/api/core";
  import { sizeWindow } from "$lib/window";
  import { isAndroid } from "$ts/glimmer/android/platform";
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
    GlimmerLogo,
    Button,
    SplitButton,
    toast,
    type Tab,
  } from "$lib";
  import { prefs, save, discard, launch } from "$lib/settings.svelte";
  import { search } from "$lib/search.svelte";
  import { dictText } from "$lib/utils";
  import { installationsState } from "$lib/installations.svelte";
  import { watchInstallations } from "$ts/roblox/installation/watcher";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { useIntlayer } from "svelte-intlayer";
  import { appState, rememberPage } from "$lib/appState.svelte";
  const appLayoutContent = useIntlayer("appLayout");
  const commonContent = useIntlayer("common");
  const androidLaunchContent = useIntlayer("androidLaunch");

  let { children }: { children: Snippet } = $props();

  const toastContent = useIntlayer("toast");

  async function play(target: string) {
    const result = await launch(target);
    if (!result) return;
    const text = dictText($androidLaunchContent[result]);
    if (result === "started") toast.success(text);
    else toast.error(text);
  }

  async function saveSettings() {
    try {
      await save();
      toast.success($toastContent.saved.value);
    } catch (e) {
      toast.error(
        $toastContent.saveFailed({
          error: e instanceof Error ? e.message : String(e),
        }).value,
      );
    }
  }

  appState.android = isAndroid();

  const tabs: Tab[] = $derived(
    [
      {
        id: "integrations",
        label: $appLayoutContent.tabIntegrations.value,
        icon: Plug, // dont hide integration.
      },
      {
        id: "mods",
        label: $appLayoutContent.tabMods.value,
        icon: Package,
        hidden: appState.android,
      },
      { id: "flags", label: $appLayoutContent.tabFastFlags.value, icon: Flag },
      {
        id: "installations",
        label: $appLayoutContent.tabInstallations.value,
        icon: HardDriveDownload,
        hidden: appState.android,
      },
      {
        id: "accounts",
        label: $appLayoutContent.tabAccounts.value,
        icon: Users,
        hidden: appState.android,
      },
      {
        id: "appearance",
        label: $appLayoutContent.tabAppearance.value,
        icon: Palette,
      },
      { id: "about", label: $appLayoutContent.tabAbout.value, icon: Info },
    ].filter((tab) => !tab.hidden),
  );

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

  // the search hid every setting of this tab: say so, and offer to clear it. Tabs with no settings rows (flags, mods) are left alone.
  let content = $state<HTMLElement>();
  let nothingFound = $state(false);

  async function checkSearch() {
    await tick();
    const rows = content?.querySelectorAll("[data-setting]");
    nothingFound = !!search.query.trim() && !!rows?.length && !content?.querySelector("[data-setting]:not(.hidden)");
  }

  $effect(() => {
    search.query;
    void checkSearch();
  });

  afterNavigate(() => {
    rememberPage(page.url.pathname);
    // the new tab draws its rows after the navigation
    setTimeout(checkSearch, 0);
  });
</script>

<div class="flex h-screen flex-col bg-app">
  <header class="shrink-0 bg-surface pt-[env(safe-area-inset-top)]">
    <div
      data-tauri-drag-region
      class="flex h-16 items-center gap-2 pr-2 pl-6 max-sm:h-14 max-sm:pl-4"
    >
      <GlimmerLogo markOnly={isAndroid()} />
      <div data-tauri-drag-region class="h-full grow"></div>
      <SearchField
        label={$appLayoutContent.searchAllSettings.value}
        bind:value={search.query}
      />
      {#if !isAndroid()}
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
      {/if}
    </div>
    <TabBar
      {tabs}
      value={section}
      onchange={(id) => goto(`/${id}`)}
      label={$appLayoutContent.settingsSections.value}
      class="px-[18px]"
    />
  </header>

  <main class="min-h-0 grow overflow-auto px-8 py-7 max-sm:px-3 max-sm:py-4">
    <div role="tabpanel" aria-labelledby="gl-tab-{section}">
      <!-- keyed on the tab, so switching tabs plays the entrance but moving inside one does not reload it.
           The title comes first, then the blurb; the content only fades, as its setting rows come in one by one (SettingGroup) -->
      {#key section}
        <h1
          class="m-0 mb-1.5 animate-fade-up font-display text-[32px] font-normal tracking-[0.01em] max-sm:text-2xl"
        >
          {heading}
        </h1>
        <p class="m-0 mb-7 max-w-[520px] animate-fade-up text-sm text-muted [animation-delay:30ms] max-sm:mb-4">
          {blurb}
        </p>
        <div class="animate-fade-in [animation-delay:60ms]" bind:this={content}>
          {#if nothingFound}
            <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-4">
              <span class="text-[13px] text-muted">{$appLayoutContent.noSettingsFound({ query: search.query.trim() }).value}</span>
              <Button variant="secondary" size="sm" onclick={() => (search.query = "")}>{$appLayoutContent.clearSearch.value}</Button>
            </div>
          {/if}
          {@render children()}
        </div>
      {/key}
    </div>
  </main>

  <footer
    class="flex min-h-16 shrink-0 items-center gap-1 bg-footer pr-6 pl-8 max-sm:px-3 max-sm:pb-[env(safe-area-inset-bottom)]"
  >
    <span class="grow text-xs text-muted">{bottomVerionText}</span>
    {#if !isAndroid()}
      <Button variant="ghost" onclick={discard}
        >{$commonContent.discard.value}</Button
      >
    {/if}
    <Button onclick={saveSettings}>{$commonContent.save.value}</Button>
    {#if isAndroid()}
      <Button variant="primary" class="ml-1" onclick={() => play("player")}
        >{$appLayoutContent.saveAndLaunch.value}</Button
      >
    {:else}
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
        onclick={play}
      />
    {/if}
  </footer>
</div>
