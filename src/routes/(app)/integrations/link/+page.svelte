<script lang="ts">
  import { onMount } from "svelte";
  import { ArrowLeft } from "@lucide/svelte";
  import { goto } from "$app/navigation";
  import { isTauri } from "@tauri-apps/api/core";
  import { Button, Dialog, TextField, toast } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import { GameHistory, type PlayedGame } from "$ts/roblox/gameHistory";
  import { GmLink } from "$ts/roblox/gmLink";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const linkContent = useIntlayer("link");

  const RECENT = 8;

  let games = $state<PlayedGame[]>([]);
  let code = $state("");
  // the account picked in the Accounts tab is the most likely username; it can be changed
  let username = $state(
    appState.accounts.list.find((a) => a.id === appState.accounts.activeId)
      ?.name ?? "",
  );
  let sharing = $state(false);
  let clearOpen = $state(false);

  onMount(async () => {
    if (isTauri()) games = await new GameHistory().list();
  });

  const canShare = $derived(
    !sharing && games.length > 0 && code.trim() !== "" && username.trim() !== "",
  );

  // why the button is off, so it never looks broken
  const blocker = $derived(
    sharing
      ? ""
      : games.length === 0
        ? $linkContent.needGames.value
        : code.trim() === ""
          ? $linkContent.needCode.value
          : username.trim() === ""
            ? $linkContent.needUsername.value
            : "",
  );

  async function share() {
    sharing = true;
    try {
      await new GmLink().share(
        code.trim(),
        username.trim(),
        games.map((g) => g.placeId),
      );
      toast.success($linkContent.shared({ name: username.trim() }).value);
    } catch (e) {
      toast.error(
        $linkContent.shareFailed({
          error: e instanceof Error ? e.message : String(e),
        }).value,
      );
    } finally {
      sharing = false;
    }
  }

  async function clear() {
    await new GameHistory().clear();
    games = [];
    clearOpen = false;
    toast.success($linkContent.cleared.value);
  }
</script>

<Button
  variant="ghost"
  size="sm"
  class="-ml-2 mb-5"
  onclick={() => goto("/integrations")}
>
  <ArrowLeft size={16} strokeWidth={1.75} aria-hidden="true" />
  {$linkContent.backToIntegrations.value}
</Button>

<div class="flex flex-col gap-0.5">
  <div class="flex items-center gap-4 bg-row px-[18px] py-4">
    <div class="flex min-w-0 grow flex-col gap-[3px]">
      <div class="text-[15px] font-medium">
        {#if games.length === 0}
          {$linkContent.noGames.value}
        {:else}
          {$linkContent.gamesTitle(games.length)({ count: games.length }).value}
        {/if}
      </div>
      <div class="text-[13px] text-muted">
        {$linkContent.gamesDescription.value}
      </div>
    </div>
    {#if games.length > 0}
      <Button variant="secondary" size="sm" onclick={() => (clearOpen = true)}>
        {$linkContent.clear.value}
      </Button>
    {/if}
  </div>

  {#if games.length > 0}
    <div class="flex flex-col gap-2 bg-row px-[18px] py-4">
      <div class="text-[13px] text-muted">{$linkContent.recentTitle.value}</div>
      <ul class="m-0 flex list-none flex-col gap-1 p-0">
        {#each games.slice(0, RECENT) as game (game.placeId)}
          <li class="flex items-baseline justify-between gap-4 text-sm">
            <span class="truncate">{game.name}</span>
            <span class="shrink-0 text-xs text-muted">
              {$linkContent.playCount(game.plays)({ count: game.plays }).value}
            </span>
          </li>
        {/each}
      </ul>
    </div>
  {/if}

  <form
    class="flex flex-col gap-4 bg-row px-[18px] py-4"
    onsubmit={(e) => {
      e.preventDefault();
      if (canShare) share();
    }}
  >
    <div class="flex flex-col gap-[3px]">
      <div class="text-[15px] font-medium">{$linkContent.shareTitle.value}</div>
      <div class="text-[13px] text-muted">
        {$linkContent.shareDescription.value}
      </div>
    </div>
    <div class="flex flex-col gap-3">
      <TextField
        bind:value={code}
        label={$linkContent.codeLabel.value}
        placeholder={$linkContent.codePlaceholder.value}
        autocomplete="off"
        spellcheck={false}
      />
      <TextField
        bind:value={username}
        label={$linkContent.usernameLabel.value}
        hint={$linkContent.usernameHint.value}
        autocomplete="off"
        spellcheck={false}
      />
    </div>
    <div class="flex items-center gap-3">
      <Button type="submit" variant="primary" size="sm" disabled={!canShare}>
        {sharing ? $linkContent.sharing.value : $linkContent.share.value}
      </Button>
      {#if blocker}
        <p class="m-0 text-[13px] text-muted" aria-live="polite">{blocker}</p>
      {/if}
    </div>
  </form>
</div>

<Dialog bind:open={clearOpen} title={$linkContent.clearTitle.value}>
  <p class="m-0">{$linkContent.clearBody.value}</p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (clearOpen = false)}>
      {$commonContent.cancel.value}
    </Button>
    <Button variant="danger" onclick={clear}>
      {$linkContent.clear.value}
    </Button>
  {/snippet}
</Dialog>
