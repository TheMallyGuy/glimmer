<script lang="ts">
  import { onMount } from "svelte";
  import { scale } from "svelte/transition";
  import { isTauri } from "@tauri-apps/api/core";
  import { listen } from "@tauri-apps/api/event";
  import {
    availableMonitors,
    cursorPosition,
    getCurrentWindow,
    PhysicalPosition,
    PhysicalSize,
  } from "@tauri-apps/api/window";
  import { error } from "@tauri-apps/plugin-log";
  import { useIntlayer } from "svelte-intlayer";
  import { cn } from "$lib";
  import {
    appState,
    gameState,
    loadAppState,
    type GameState,
  } from "$lib/appState.svelte";
  import { motionMs } from "$lib/motion";
  import { radialSlots } from "$lib/overlaySlots";
  import {
    BACKDROP_RADIUS,
    CENTRE_RADIUS,
    INNER_RADIUS,
    OUTER_RADIUS,
    menuPlacement,
    notchPoints,
    pickSlot,
    slicePath,
    slotCentre,
    stepSlot,
  } from "$lib/radial";
  import { commands } from "$ts/bindings";
  import { OverlayShortcut } from "$ts/overlayShortcut";
  import { ServerActionError, ServerActions } from "$ts/roblox/serverActions";

  const overlayContent = useIntlayer("overlay");

  /** the window is this many logical px wide and high (see tauri.conf.json) */
  const WINDOW_SIZE = 420;
  const COUNT = radialSlots.length;
  /** an action can only run in a game, so out of one every slot is dark and can't be chosen, like a blank one */
  const inGame = $derived(!!gameState.gameId && !!gameState.gameServer);
  const enabled = $derived(radialSlots.map((slot) => slot !== null && inGame));
  const ICON_SIZE = 26;
  const RESULT_MS = 700;
  const ERROR_MS = 1500;
  const POLL_MS = 16;

  const actions = new ServerActions();
  const appWindow = isTauri() ? getCurrentWindow() : null;

  let shown = $state(false);
  let selected = $state(-1);
  /** what the middle says after an action ran */
  let notice = $state<{ kind: "result" | "error"; text: string } | null>(null);

  /** the middle of the menu on screen (px) and the scale of that screen, which the mouse direction is measured from */
  let centre: { x: number; y: number; scale: number } | null = null;
  let lastCursor: string | null = null;
  let polling = false;
  let timer: ReturnType<typeof setInterval> | undefined;
  let busy = false;
  /** goes up each time the menu opens or closes, so a late answer to an older menu is dropped */
  let session = 0;

  const current = $derived(selected >= 0 ? radialSlots[selected] : null);

  // leaving the game while the menu is up darkens the slot that was chosen
  $effect(() => {
    if (selected >= 0 && !enabled[selected]) selected = -1;
  });

  const shortcut = new OverlayShortcut({ press: openMenu, release: release });

  /** puts the window over the middle of the screen Roblox is on. False when Roblox is not open. */
  async function place() {
    const hwnd = await commands.getRobloxHwnd();
    if (hwnd.status === "error") return false;
    const monitor = await commands.windowGetMonitor(hwnd.data);
    if (monitor.status === "error") return false;

    const [x, y, width, height] = monitor.data;
    const scaleFactor =
      (await availableMonitors()).find(
        (m) => m.position.x === x && m.position.y === y,
      )?.scaleFactor ?? 1;
    const spot = menuPlacement(
      { x, y, width, height },
      scaleFactor,
      WINDOW_SIZE,
    );

    await appWindow!.setSize(new PhysicalSize(spot.side, spot.side));
    await appWindow!.setPosition(new PhysicalPosition(spot.x, spot.y));
    centre = { x: spot.centreX, y: spot.centreY, scale: scaleFactor };
    return true;
  }

  async function openMenu() {
    const mine = ++session;
    try {
      // the shortcut is global, but the menu is for the game: it opens only while Roblox is the window in use
      if (!(await commands.isRobloxFocused())) return;
      if (!(await place())) return;
      // the shortcut was let go while the window was being placed, so there is nothing to show
      if (mine !== session || !shortcut.held) return;

      busy = false;
      selected = -1;
      notice = null;
      lastCursor = null;
      shown = true;
      await appWindow!.show();
      await appWindow!.setFocus();
      timer = setInterval(follow, POLL_MS);
    } catch (err) {
      error(`in-game menu: could not open: ${err}`);
    }
  }

  async function close() {
    session++;
    clearInterval(timer);
    timer = undefined;
    shown = false;
    selected = -1;
    notice = null;
    busy = false;
    await appWindow?.hide();
  }

  /** the mouse chooses by its direction from the middle. It has to move first: where it was on opening chooses nothing. */
  async function follow() {
    if (polling || !centre) return;
    polling = true;
    const mine = session;
    try {
      const mouse = await cursorPosition();
      if (mine !== session || !centre) return;

      const point = `${mouse.x},${mouse.y}`;
      const moved = lastCursor !== null && point !== lastCursor;
      lastCursor = point;
      if (moved) {
        selected = pickSlot(
          (mouse.x - centre.x) / centre.scale,
          (mouse.y - centre.y) / centre.scale,
          enabled,
        );
      }
    } finally {
      polling = false;
    }
  }

  function errorText(err: unknown) {
    return err instanceof ServerActionError
      ? $overlayContent.errors[err.failure].value
      : $overlayContent.errors.failed.value;
  }

  async function run(index: number) {
    const slot = radialSlots[index];
    if (!slot || busy) return;
    const mine = session;
    busy = true;

    let result: NonNullable<typeof notice>;
    try {
      await slot.run(actions);
      result = {
        kind: "result",
        text: $overlayContent.actions[slot.id].result.value,
      };
    } catch (err) {
      error(`in-game menu: ${slot.id} failed: ${err}`);
      result = { kind: "error", text: errorText(err) };
    }
    if (mine !== session) return; // closed (or opened again) while it ran

    notice = result;
    await new Promise((resolve) =>
      setTimeout(resolve, result.kind === "error" ? ERROR_MS : RESULT_MS),
    );
    if (mine === session) await close();
  }

  /** the shortcut came up: run what is selected, or just close */
  async function release() {
    if (!shown || busy) return;
    if (selected < 0) await close();
    else await run(selected);
  }

  function onKey(event: KeyboardEvent) {
    if (!shown || busy) return;

    if (event.key === "Escape") close();
    else if (event.key === "ArrowRight" || event.key === "ArrowDown")
      selected = stepSlot(selected, enabled, 1);
    else if (event.key === "ArrowLeft" || event.key === "ArrowUp")
      selected = stepSlot(selected, enabled, -1);
    else if (event.key === "Enter") run(selected);
    else return;
    event.preventDefault();
  }

  /** turns the shortcut on or off by the saved setting */
  async function applySetting() {
    try {
      await loadAppState();
      await shortcut.set(appState.integrations.inGameMenu.enabled);
    } catch (err) {
      error(`in-game menu: could not set the shortcut: ${err}`);
    }
  }

  onMount(() => {
    // the window is see-through, so the page must be too
    document.body.classList.add("bg-transparent", "bg-none");
    if (!isTauri()) return;

    applySetting();
    const stopListening = [
      listen("overlay-refresh", applySetting),
      // the log rules run in the background window, which sends what they learn about the game (see setGameState)
      listen<GameState>("game-state", ({ payload }) =>
        Object.assign(gameState, payload),
      ),
    ];

    return () => {
      for (const stop of stopListening) stop.then((unlisten) => unlisten());
      shortcut.set(false);
    };
  });
</script>

<svelte:window onkeydown={onKey} />

<main class="relative size-[420px] overflow-hidden select-none">
  {#if shown}
    <div
      class="absolute inset-0"
      in:scale={{ start: 0.96, duration: motionMs(120) }}
    >
      <div
        role="menu"
        aria-label={$overlayContent.menuLabel.value}
        class="absolute inset-0"
      >
        <svg viewBox="-210 -210 420 420" class="size-full">
          <circle r={BACKDROP_RADIUS} class="fill-ring-backdrop" />

          {#each radialSlots as slot, i (i)}
            {#if slot}
              {@const Icon = slot.icon}
              {@const chosen = i === selected}
              {@const [cx, cy] = slotCentre(i, COUNT)}
              <g
                role="menuitem"
                tabindex="-1"
                aria-label={$overlayContent.actions[slot.id].name.value}
                aria-current={chosen}
                aria-disabled={!inGame}
              >
                <path
                  d={slicePath(i, COUNT, OUTER_RADIUS, INNER_RADIUS)}
                  stroke-width="4"
                  stroke-linejoin="round"
                  class={cn(
                    "stroke-ring-gap",
                    chosen ? "fill-accent" : inGame ? "fill-ring-active" : "fill-ring-blank",
                  )}
                />
                <Icon
                  x={cx - ICON_SIZE / 2}
                  y={cy - ICON_SIZE / 2}
                  size={ICON_SIZE}
                  strokeWidth={1.75}
                  class={chosen ? "text-on-accent" : inGame ? "text-ring-icon" : "text-off"}
                />
              </g>
            {:else}
              <path
                aria-hidden="true"
                d={slicePath(i, COUNT, OUTER_RADIUS, INNER_RADIUS)}
                stroke-width="4"
                stroke-linejoin="round"
                class="fill-ring-blank stroke-ring-gap"
              />
            {/if}
          {/each}

          <circle r={CENTRE_RADIUS} class="fill-ring-core" />
          {#if selected >= 0}
            <polygon
              points={notchPoints(selected, COUNT)}
              class="fill-accent"
            />
          {/if}
        </svg>
      </div>

      <div
        aria-live="polite"
        class="absolute top-1/2 left-1/2 flex w-[130px] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
      >
        {#if notice}
          <p
            class={cn(
              "font-display text-lg leading-tight font-normal tracking-[0.01em]",
              notice.kind === "error" ? "text-danger" : "text-fg",
            )}
          >
            {notice.text}
          </p>
        {:else}
          <p
            class="font-display text-lg leading-tight font-normal tracking-[0.01em] text-fg"
          >
            {current
              ? $overlayContent.actions[current.id].name.value
              : $overlayContent.idleName.value}
          </p>
          <p class="mt-1 text-xs text-muted">
            {current
              ? $overlayContent.actions[current.id].description.value
              : inGame
                ? $overlayContent.idleDescription.value
                : $overlayContent.idleOffline.value}
          </p>
        {/if}
      </div>

      <p
        class="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1 rounded-gl bg-ring-backdrop py-1 text-[13px] whitespace-nowrap text-muted"
      >
        {$overlayContent.hintHold.value}
        <kbd class="rounded-gl bg-tonal px-1.5 font-mono text-xs text-fg-2"
          >{$overlayContent.keyAlt.value}</kbd
        >
        +
        <kbd class="rounded-gl bg-tonal px-1.5 font-mono text-xs text-fg-2"
          >{$overlayContent.keyG.value}</kbd
        >
        · {$overlayContent.hintPoint.value} · {$overlayContent.hintRelease
          .value} ·
        <kbd class="rounded-gl bg-tonal px-1.5 font-mono text-xs text-fg-2"
          >{$overlayContent.keyEsc.value}</kbd
        >
        {$overlayContent.hintCancel.value}
      </p>
    </div>
  {/if}
</main>
