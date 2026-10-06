<script lang="ts">
  import { ArrowLeft, Check, Gamepad2, Minus, Plus, RotateCcw } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { Button, SlotImage, TextField, cn } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import {
    ACTION_IDS,
    DEFAULT_SLOTS,
    SLOT_COUNT,
    isGameSlot,
    normalizeSlots,
    type Slot,
  } from "$lib/boardSlots";
  import { actionSlots, resolveSlots, type RadialSlot } from "$lib/overlaySlots";
  import {
    BACKDROP_RADIUS,
    CENTRE_RADIUS,
    INNER_RADIUS,
    OUTER_RADIUS,
    slicePath,
    slotCentre,
  } from "$lib/radial";
  import { GameLink } from "$ts/roblox/game";
  import { getGameIcon, getGameName } from "$ts/roblox/generalRobloxApis";
  import { useIntlayer } from "svelte-intlayer";
  const boardContent = useIntlayer("board");
  const overlayContent = useIntlayer("overlay");

  const ICON_SIZE = 26;
  /** the icon of a game fills more of the slice than the action icons do */
  const IMAGE_SIZE = 44;

  /** the slice being edited */
  let selected = $state(0);
  let slices = $state<SVGGElement[]>([]);
  let gameInput = $state("");
  let gameError = $state("");
  let looking = $state(false);

  const slots = $derived(normalizeSlots(appState.integrations.inGameMenu.slots));
  const resolved = $derived(resolveSlots(slots));
  const current = $derived(slots[selected]);
  const currentSlot = $derived(resolved[selected]);

  /** what a slot is called: the game, for a game slot */
  function nameOf(slot: RadialSlot) {
    return slot.game ?? $overlayContent.actions[slot.id].name.value;
  }

  function select(index: number) {
    selected = index;
    gameError = "";
  }

  function assign(slot: Slot, index = selected) {
    appState.integrations.inGameMenu.slots = slots.map((old, i) =>
      i === index ? slot : old,
    );
  }

  function reset() {
    appState.integrations.inGameMenu.slots = [...DEFAULT_SLOTS];
  }

  /** sets the slice to join the game of a pasted link, with the name Roblox gives it */
  async function useGame(event: SubmitEvent) {
    event.preventDefault();
    const placeId = GameLink.placeIdFrom(gameInput);
    if (!placeId) {
      gameError = $boardContent.gameInvalid.value;
      return;
    }

    // the slice may be changed while the name is on its way
    const index = selected;
    looking = true;
    gameError = "";
    try {
      // a game with no icon yet (or an icon that can't be had) still gets its slice
      const [name, iconUrl] = await Promise.all([
        getGameName(placeId),
        getGameIcon(placeId).catch(() => null),
      ]);
      assign({ placeId, name, ...(iconUrl && { iconUrl }) }, index);
      gameInput = "";
    } catch {
      gameError = $boardContent.gameMissing.value;
    } finally {
      looking = false;
    }
  }

  /** arrow keys move between the slices, wrapping round the ring like the menu does */
  function onKey(event: KeyboardEvent, from: number) {
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown"
        ? (from + 1) % SLOT_COUNT
        : event.key === "ArrowLeft" || event.key === "ArrowUp"
          ? (from + SLOT_COUNT - 1) % SLOT_COUNT
          : event.key === "Home"
            ? 0
            : event.key === "End"
              ? SLOT_COUNT - 1
              : -1;
    if (next < 0) return;
    event.preventDefault();
    select(next);
    slices[next]?.focus();
  }

  const option =
    "flex w-full cursor-pointer items-center gap-4 rounded-gl border-0 bg-row px-[18px] py-4 text-left text-fg transition-colors hover:bg-hover motion-reduce:transition-none";
</script>

<Button
  variant="ghost"
  size="sm"
  class="-ml-2 mb-5"
  onclick={() => goto("/integrations")}
>
  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
  {$boardContent.backToIntegrations.value}
</Button>

<p class="mb-7 max-w-[520px] text-sm text-muted">{$boardContent.blurb.value}</p>

<div class="flex flex-wrap items-start gap-8">
  <div class="relative size-[300px] shrink-0">
    <svg
      viewBox="-210 -210 420 420"
      role="radiogroup"
      aria-label={$boardContent.ringLabel.value}
      class="size-full"
    >
      <circle r={BACKDROP_RADIUS} class="fill-ring-backdrop" />

      {#each resolved as slot, i (i)}
        {@const Icon = slot ? slot.icon : Plus}
        {@const chosen = i === selected}
        {@const [cx, cy] = slotCentre(i, SLOT_COUNT)}
        <g
          bind:this={slices[i]}
          role="radio"
          aria-checked={chosen}
          tabindex={chosen ? 0 : -1}
          aria-label={slot
            ? $boardContent.slotLabel({
                number: String(i + 1),
                action: nameOf(slot),
              }).value
            : $boardContent.slotEmptyLabel({ number: String(i + 1) }).value}
          class="group cursor-pointer outline-none"
          onclick={() => select(i)}
          onkeydown={(event) => onKey(event, i)}
        >
          <path
            d={slicePath(i, SLOT_COUNT, OUTER_RADIUS, INNER_RADIUS)}
            stroke-width="4"
            stroke-linejoin="round"
            class={cn(
              "stroke-ring-gap transition-colors group-focus-visible:stroke-fg motion-reduce:transition-none",
              chosen
                ? "fill-accent"
                : slot
                  ? "fill-ring-active hover:fill-hover"
                  : "fill-ring-blank hover:fill-ring-active",
            )}
          />
          <Icon
            x={cx - ICON_SIZE / 2}
            y={cy - ICON_SIZE / 2}
            size={ICON_SIZE}
            strokeWidth={1.75}
            class={cn(
              "pointer-events-none",
              chosen ? "text-on-accent" : slot ? "text-ring-icon" : "text-off",
            )}
          />
          {#if slot?.image}
            <SlotImage href={slot.image} {cx} {cy} size={IMAGE_SIZE} />
          {/if}
        </g>
      {/each}

      <circle r={CENTRE_RADIUS} class="fill-ring-core" />
    </svg>

    <div
      aria-live="polite"
      class="pointer-events-none absolute top-1/2 left-1/2 flex w-[31%] -translate-x-1/2 -translate-y-1/2 flex-col items-center text-center"
    >
      <p class="font-display text-base leading-tight font-normal tracking-[0.01em] text-fg">
        {currentSlot ? nameOf(currentSlot) : $boardContent.nothingName.value}
      </p>
    </div>
  </div>

  <div class="flex min-w-[260px] flex-1 flex-col gap-0.5">
    <h2 class="mb-2 text-[13px] font-normal text-muted">
      {$boardContent.chooseTitle({ number: String(selected + 1) }).value}
    </h2>

    {#each ACTION_IDS as id (id)}
      {@const Icon = actionSlots[id].icon}
      <button
        type="button"
        aria-pressed={current === id}
        class={option}
        onclick={() => assign(id)}
      >
        <Icon size={18} strokeWidth={1.75} class="shrink-0 text-muted" aria-hidden="true" />
        <span class="flex min-w-0 grow flex-col gap-[3px]">
          <span class="text-[15px] font-medium">{$overlayContent.actions[id].name.value}</span>
          <span class="text-[13px] text-muted">{$overlayContent.actions[id].description.value}</span>
        </span>
        {#if current === id}
          <Check size={18} strokeWidth={1.75} class="shrink-0 text-accent" aria-hidden="true" />
        {/if}
      </button>
    {/each}
    {#if current && isGameSlot(current)}
      <div aria-current="true" class={cn(option, "cursor-default hover:bg-row")}>
        {#if current.iconUrl}
          <img src={current.iconUrl} alt="" class="size-8 shrink-0 rounded-gl" />
        {:else}
          <Gamepad2 size={18} strokeWidth={1.75} class="shrink-0 text-muted" aria-hidden="true" />
        {/if}
        <span class="flex min-w-0 grow flex-col gap-[3px]">
          <span class="truncate text-[15px] font-medium">{current.name}</span>
          <span class="text-[13px] text-muted">{$overlayContent.actions.game.description.value}</span>
        </span>
        <Check size={18} strokeWidth={1.75} class="shrink-0 text-accent" aria-hidden="true" />
      </div>
    {/if}
    <button
      type="button"
      aria-pressed={current === null}
      class={option}
      onclick={() => assign(null)}
    >
      <Minus size={18} strokeWidth={1.75} class="shrink-0 text-muted" aria-hidden="true" />
      <span class="flex min-w-0 grow flex-col gap-[3px]">
        <span class="text-[15px] font-medium">{$boardContent.nothingName.value}</span>
        <span class="text-[13px] text-muted">{$boardContent.nothingDescription.value}</span>
      </span>
      {#if current === null}
        <Check size={18} strokeWidth={1.75} class="shrink-0 text-accent" aria-hidden="true" />
      {/if}
    </button>

    <form class="mt-5 flex flex-col gap-3" onsubmit={useGame}>
      <TextField
        bind:value={gameInput}
        label={$boardContent.gameLabel.value}
        hint={$boardContent.gameHint.value}
        error={gameError}
        autocomplete="off"
        spellcheck={false}
      />
      <div>
        <Button
          type="submit"
          variant="secondary"
          size="sm"
          disabled={looking || gameInput.trim() === ""}
        >
          {looking ? $boardContent.gameLooking.value : $boardContent.gameUse.value}
        </Button>
      </div>
    </form>

    <div class="mt-5">
      <Button variant="secondary" size="sm" onclick={reset}>
        <RotateCcw size={16} strokeWidth={1.75} aria-hidden="true" />
        {$boardContent.reset.value}
      </Button>
    </div>
  </div>
</div>
