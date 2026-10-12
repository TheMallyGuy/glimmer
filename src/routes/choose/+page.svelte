<script lang="ts">
  import { onMount, onDestroy } from "svelte";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import {
    Gamepad2,
    DraftingCompass,
    Settings,
    MessagesSquare,
    ArrowUpRight,
    User,
    X,
  } from "@lucide/svelte";
  import { IconButton, Menu, GlimmerLogo, cn, type MenuItem } from "$lib";
  import { prefs, launch } from "$lib/settings.svelte";
  import { appState } from "$lib/appState.svelte";
  import { avatars, loadAvatars, selectAccount } from "$lib/accounts.svelte";
  import { sizeWindow, closeWindow } from "$lib/window";
  import { isAndroid } from "$ts/glimmer/android/platform";
  import { openSettingsWindow } from "$ts/windows/settings";
  import { installationsState } from "$lib/installations.svelte";
  import { watchInstallations } from "$ts/roblox/installation/watcher";
  import type { UnlistenFn } from "@tauri-apps/api/event";
  import { useIntlayer } from "svelte-intlayer";
  const chooseContent = useIntlayer("choose");
  const commonContent = useIntlayer("common");

  const DISCORD_INVITE = "https://discord.gg/UX5E9ppKFg";

  const android = isAndroid();
  const targets = [
    { value: "player", label: $commonContent.player.value, icon: Gamepad2 },
    ...(android
      ? []
      : [
          {
            value: "studio",
            label: $commonContent.studio.value,
            icon: DraftingCompass,
          },
        ]),
  ];

  const current = $derived(
    targets.find((t) => t.value === prefs.target) ?? targets[0],
  );
  const LaunchIcon = $derived(current.icon);

  // Accounts only apply to the player, and the avatar button is hidden without any.
  const showAccounts = $derived(
    appState.accounts.list.length > 0 && prefs.target === "player",
  );
  const activeAccount = $derived(
    appState.accounts.list.find((a) => a.id === appState.accounts.activeId),
  );

  let accountButton = $state<HTMLButtonElement | null>(null);
  let accountMenuOpen = $state(false);
  let accountMenuPos = $state({ x: 0, y: 0 });

  // the menu is 208px wide (w-52), so line its right edge up with the button's
  function toggleAccountMenu() {
    if (accountMenuOpen) {
      accountMenuOpen = false;
      return;
    }
    const r = accountButton!.getBoundingClientRect();
    accountMenuPos = { x: r.right - 208, y: r.bottom + 4 };
    accountMenuOpen = true;
  }

  const accountItems = $derived<MenuItem[]>([
    {
      label: $chooseContent.robloxLogin.value,
      avatar: null,
      checked: !activeAccount,
      onselect: () => selectAccount(null),
    },
    ...appState.accounts.list.map((a) => ({
      label: a.displayName,
      avatar: avatars[a.id] || null,
      checked: a.id === appState.accounts.activeId,
      onselect: () => selectAccount(a.id),
    })),
  ]);

  $effect(loadAvatars);

  let targetButtons: HTMLButtonElement[] = $state([]);

  const activeVersion = $derived(
    installationsState.versions.find((v) => v.active),
  );
  const bottomVerionText = $derived(
    activeVersion ? `LIVE · ${activeVersion.version}` : "",
  );

  let stopWatching: UnlistenFn | undefined;

  onMount(async () => {
    if (android) prefs.target = "player"; // a target saved on desktop
    sizeWindow(560, 320);
    stopWatching = await watchInstallations();
  });

  onDestroy(() => stopWatching?.());

  function onTargetKey(e: KeyboardEvent, i: number) {
    if (!["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(e.key))
      return;
    e.preventDefault();
    const next = (i + 1) % targets.length;
    prefs.target = targets[next].value;
    targetButtons[next]?.focus();
  }

  async function openSettings() {
    await openSettingsWindow();
    await closeWindow();
  }

  const tile =
    "group relative flex flex-col items-start justify-between gap-6 rounded-gl border-0 p-4 text-left cursor-pointer animate-fade-up transition-colors motion-reduce:transition-none";
</script>

<div class="flex h-screen w-screen flex-col bg-app text-fg">
  <header
    data-tauri-drag-region
    class="flex h-14 shrink-0 items-center pr-2 pl-5"
  >
    <GlimmerLogo class="-ml-1.5 h-[26px] w-auto" />
    <div data-tauri-drag-region class="h-full grow"></div>
    {#if showAccounts}
      <button
        bind:this={accountButton}
        type="button"
        aria-label={$chooseContent.signInAsName({
          name: activeAccount?.displayName ?? $chooseContent.robloxLogin.value,
        }).value}
        aria-haspopup="menu"
        aria-expanded={accountMenuOpen}
        class="mr-1 flex size-9 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-gl border-0 bg-row p-0 text-muted transition-colors hover:bg-hover motion-reduce:transition-none"
        onclick={toggleAccountMenu}
      >
        {#if activeAccount && avatars[activeAccount.id]}
          <img
            src={avatars[activeAccount.id]}
            alt=""
            class="size-full object-cover"
          />
        {:else}
          <User size={18} strokeWidth={1.75} aria-hidden="true" />
        {/if}
      </button>
    {/if}
    {#if !android}
      <IconButton
        label={$commonContent.close.value}
        variant="ghost"
        onclick={closeWindow}
      >
        <X size={14} strokeWidth={1.5} />
      </IconButton>
    {/if}
  </header>

  <main class="flex grow flex-col justify-center gap-4 px-5">
    <div class={cn("grid gap-0.5", android ? "grid-cols-1" : "grid-cols-3")}>
      <button
        type="button"
        class={cn(
          tile,
          "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
        )}
        style:animation-delay="0ms"
        onclick={() => launch(prefs.target)}
      >
        <LaunchIcon size={22} strokeWidth={1.75} aria-hidden="true" />
        <span class="flex flex-col gap-0.5">
          <span class="font-display text-lg tracking-[0.01em]">
            {#if current.value == "player"}
              {$chooseContent.play.value}
            {:else}
              {$chooseContent.makeGames.value}
            {/if}
          </span>
          <span class="text-[13px] text-on-accent/70"
            >{$chooseContent.openRoblox({ target: current.label }).value}</span
          >
        </span>
      </button>

      <button
        type="button"
        class={cn(tile, "bg-row hover:bg-hover")}
        style:animation-delay="60ms"
        onclick={openSettings}
      >
        <Settings
          size={22}
          strokeWidth={1.75}
          aria-hidden="true"
          class="text-muted transition-colors group-hover:text-fg-2"
        />
        <span class="flex flex-col gap-0.5">
          <span class="font-display text-lg tracking-[0.01em]"
            >{$chooseContent.settings.value}</span
          >
          <span class="text-[13px] text-muted"
            >{$chooseContent.configureRoblox.value}</span
          >
        </span>
      </button>

      <button
        type="button"
        class={cn(tile, "bg-row hover:bg-hover")}
        style:animation-delay="120ms"
        onclick={() => openUrl(DISCORD_INVITE)}
      >
        <MessagesSquare
          size={22}
          strokeWidth={1.75}
          aria-hidden="true"
          class="text-muted transition-colors group-hover:text-fg-2"
        />
        <ArrowUpRight
          size={16}
          strokeWidth={1.75}
          aria-hidden="true"
          class="absolute top-4 right-4 text-subtle"
        />
        <span class="flex flex-col gap-0.5">
          <span class="font-display text-lg tracking-[0.01em]"
            >{$chooseContent.community.value}</span
          >
          <span class="text-[13px] text-muted"
            >{$chooseContent.discussWithCommunity.value}</span
          >
        </span>
      </button>
    </div>

    <div class="flex items-center gap-3">
      {#if targets.length > 1}
        <span id="target-label" class="text-[13px] text-muted"
          >{$chooseContent.launchAs.value}</span
        >
        <div
          role="radiogroup"
          aria-labelledby="target-label"
          class="flex gap-0.5"
        >
          {#each targets as t, i (t.value)}
            {@const checked = prefs.target === t.value}
            <button
              bind:this={targetButtons[i]}
              type="button"
              role="radio"
              aria-checked={checked}
              tabindex={checked ? 0 : -1}
              class={cn(
                "h-8 cursor-pointer rounded-gl border-0 px-3 text-[13px] transition-colors motion-reduce:transition-none",
                checked
                  ? "bg-accent/15 text-accent"
                  : "bg-row text-fg-3 hover:bg-hover hover:text-fg",
              )}
              onclick={() => (prefs.target = t.value)}
              onkeydown={(e) => onTargetKey(e, i)}
            >
              {t.label}
            </button>
          {/each}
        </div>
      {/if}
      <span class="ml-auto text-xs text-muted">{bottomVerionText}</span>
    </div>
  </main>
</div>

<Menu
  bind:open={accountMenuOpen}
  x={accountMenuPos.x}
  y={accountMenuPos.y}
  label={$chooseContent.signInAs.value}
  items={accountItems}
  returnFocus={accountButton}
/>
