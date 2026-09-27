<script lang="ts">
  import { onMount } from "svelte";
  import { getCurrentWindow } from "@tauri-apps/api/window";
  import { openUrl } from "@tauri-apps/plugin-opener";
  import {
    Gamepad2,
    DraftingCompass,
    Settings,
    MessagesSquare,
    ArrowUpRight,
    X,
  } from "@lucide/svelte";
  import { IconButton, cn } from "$lib";
  import { prefs, launch } from "$lib/settings.svelte";
  import { sizeWindow } from "$lib/window";
  import { openSettingsWindow } from "$ts/windows/settings";
  import { Installation } from "$ts/roblox/installation/installation";

  const DISCORD_INVITE = "https://discord.gg/UX5E9ppKFg";

  const targets = [
    { value: "player", label: "Player", icon: Gamepad2 },
    { value: "studio", label: "Studio", icon: DraftingCompass },
  ];
  const current = $derived(
    targets.find((t) => t.value === prefs.target) ?? targets[0],
  );
  const LaunchIcon = $derived(current.icon);

  let targetButtons: HTMLButtonElement[] = $state([]);
  let bottomVerionText = $state("");

  onMount(async () => {
    sizeWindow(560, 320);

    const i = await Installation.create();
    await i.listInstallations();

    const ver = i.getActiveVersion();

    if (ver) {
      bottomVerionText = `LIVE · ${ver.version}`
    }
  });

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
    await getCurrentWindow().close();
  }

  const tile =
    "group relative flex flex-col items-start justify-between gap-6 rounded-gl border-0 p-4 text-left cursor-pointer transition-colors motion-reduce:transition-none";
</script>

<div class="flex h-screen w-screen flex-col bg-canvas text-fg">
  <header
    data-tauri-drag-region
    class="flex h-14 shrink-0 items-center pr-2 pl-5"
  >
    <img
      src="/glimmer-logo.svg"
      alt="Glimmer"
      height="26"
      class="pointer-events-none -ml-1.5 h-[26px] w-auto"
    />
    <div data-tauri-drag-region class="h-full grow"></div>
    <IconButton
      label="Close"
      variant="ghost"
      onclick={() => getCurrentWindow().close()}
    >
      <X size={14} strokeWidth={1.5} />
    </IconButton>
  </header>

  <main class="flex grow flex-col justify-center gap-4 px-5">
    <div class="grid grid-cols-3 gap-0.5">
      <button
        type="button"
        class={cn(
          tile,
          "bg-accent text-on-accent hover:bg-accent-hover active:bg-accent-press",
        )}
        onclick={() => launch(prefs.target)}
      >
        <LaunchIcon size={22} strokeWidth={1.75} aria-hidden="true" />
        <span class="flex flex-col gap-0.5">
          <span class="font-display text-lg tracking-[0.01em]">
            {#if current.value == "player"}
              Play
            {:else}
              Make Games
            {/if}
          </span>
          <span class="text-[13px] text-on-accent/70"
            >Open Roblox {current.label}</span
          >
        </span>
      </button>

      <button
        type="button"
        class={cn(tile, "bg-row hover:bg-hover")}
        onclick={openSettings}
      >
        <Settings
          size={22}
          strokeWidth={1.75}
          aria-hidden="true"
          class="text-muted transition-colors group-hover:text-fg-2"
        />
        <span class="flex flex-col gap-0.5">
          <span class="font-display text-lg tracking-[0.01em]">Settings</span>
          <span class="text-[13px] text-muted">Configure Roblox</span>
        </span>
      </button>

      <button
        type="button"
        class={cn(tile, "bg-row hover:bg-hover")}
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
          <span class="font-display text-lg tracking-[0.01em]">Community</span>
          <span class="text-[13px] text-muted">Discuss with our Community</span>
        </span>
      </button>
    </div>

    <div class="flex items-center gap-3">
      <span id="target-label" class="text-[13px] text-muted">Launch as</span>
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
      <span class="ml-auto text-xs text-muted">{bottomVerionText}</span>
    </div>
  </main>
</div>
