<script lang="ts">
  import { onMount } from "svelte";
  import { Check, Plus, Trash2, User } from "@lucide/svelte";
  import { Button, IconButton, Dialog } from "$lib";
  import { appState } from "$lib/appState.svelte";
  import {
    accountsView,
    addAccount,
    cancelAddAccount,
    checkAccounts,
    removeAccount,
    selectAccount,
  } from "$lib/accounts.svelte";
  import { getUserHeadShot } from "$ts/roblox/generalRobloxApis";
  import type { Account } from "$ts/roblox/account/login";
  import { useIntlayer } from "svelte-intlayer";
  const commonContent = useIntlayer("common");
  const accountsContent = useIntlayer("accounts");

  onMount(checkAccounts);

  let avatars = $state<Record<string, string>>({});

  $effect(() => {
    for (const account of appState.accounts.list) {
      if (account.id in avatars) continue;
      avatars[account.id] = "";
      getUserHeadShot(Number(account.id))
        .then((url) => (avatars[account.id] = url ?? ""))
        .catch(() => {});
    }
  });

  // the account the next launch signs in as, if one is picked
  const activeAccount = $derived(
    appState.accounts.list.find((a) => a.id === appState.accounts.activeId),
  );

  let removeTarget = $state<Account | null>(null);
  let removeOpen = $state(false);

  function askRemove(account: Account) {
    removeTarget = account;
    removeOpen = true;
  }

  async function confirmRemove() {
    if (removeTarget) await removeAccount(removeTarget.id);
    removeOpen = false;
  }
</script>

{#snippet picker(id: string)}
  {#if appState.accounts.activeId === id}
    <span class="flex shrink-0 items-center gap-1.5 text-[13px] text-accent">
      <Check size={16} strokeWidth={1.75} aria-hidden="true" />
      {$accountsContent.selected.value}
    </span>
  {:else}
    <Button variant="secondary" size="sm" onclick={() => selectAccount(id)}>
      {$accountsContent.useAccount.value}
    </Button>
  {/if}
{/snippet}

<div class="flex flex-col gap-3">
  <div class="flex items-center gap-4">
    <p class="m-0 grow text-[13px] text-muted">
      {$accountsContent.intro.value}
    </p>
    {#if accountsView.adding}
      <span class="shrink-0 text-[13px] text-muted" aria-live="polite">
        {$accountsContent.waitingForLogin.value}
      </span>
      <Button variant="ghost" size="sm" onclick={cancelAddAccount}>
        {$accountsContent.cancelLogin.value}
      </Button>
    {:else}
      <Button variant="primary" size="sm" onclick={addAccount}>
        <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
        {$accountsContent.addAccount.value}
      </Button>
    {/if}
  </div>

  {#if accountsView.error}
    <p class="m-0 text-[13px] text-danger" role="alert">
      {$accountsContent.loginFailed({ error: accountsView.error }).value}
    </p>
  {/if}

  {#if appState.accounts.list.length === 0}
    <div class="flex flex-col items-start gap-3 bg-row px-[18px] py-8">
      <div class="flex flex-col gap-[3px]">
        <div class="text-[15px] font-medium">
          {$accountsContent.emptyTitle.value}
        </div>
        <p class="m-0 max-w-[520px] text-[13px] text-muted">
          {$accountsContent.emptyBody.value}
        </p>
      </div>
      <Button size="sm" disabled={accountsView.adding} onclick={addAccount}>
        {$accountsContent.addAccount.value}
      </Button>
    </div>
  {:else}
    <div class="flex flex-col gap-0.5">
    <div class="flex items-center gap-4 bg-row px-[18px] py-4">
      <div class="flex min-w-0 grow flex-col gap-[3px]">
        <div class="text-[15px] font-medium">
          {#if activeAccount}
            {$accountsContent.forcedTitle({ name: activeAccount.displayName }).value}
          {:else}
            {$accountsContent.unforcedTitle.value}
          {/if}
        </div>
        <div class="text-[13px] text-muted">
          {#if activeAccount}
            {$accountsContent.forcedDescription.value}
          {:else}
            {$accountsContent.unforcedDescription.value}
          {/if}
        </div>
      </div>
      {#if activeAccount}
        <Button variant="secondary" size="sm" onclick={() => selectAccount(null)}>
          {$accountsContent.useRobloxLogin.value}
        </Button>
      {/if}
    </div>

    <ul class="m-0 flex list-none flex-col gap-0.5 p-0">
      {#each appState.accounts.list as account (account.id)}
        <li class="flex items-center gap-4 bg-row px-[18px] py-4">
          <div
            class="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-gl bg-field text-muted"
          >
            {#if avatars[account.id]}
              <img
                src={avatars[account.id]}
                alt={$accountsContent.avatarAlt({ name: account.displayName })
                  .value}
                class="size-full object-cover"
              />
            {:else}
              <User size={18} strokeWidth={1.75} aria-hidden="true" />
            {/if}
          </div>
          <div class="flex min-w-0 grow flex-col gap-[3px]">
            <div class="truncate text-[15px] font-medium">
              {account.displayName}
            </div>
            <div class="truncate text-[13px] text-muted">
              {$accountsContent.usernameLine({ name: account.name }).value}
            </div>
            {#if accountsView.expired[account.id]}
              <div class="text-xs text-danger">
                {$accountsContent.expired.value}
              </div>
            {/if}
          </div>
          <div class="flex shrink-0 items-center gap-1">
            {@render picker(account.id)}
            <IconButton
              label={$accountsContent.removeAccount({
                name: account.displayName,
              }).value}
              variant="ghost"
              size="sm"
              onclick={() => askRemove(account)}
            >
              <Trash2 size={16} strokeWidth={1.75} aria-hidden="true" />
            </IconButton>
          </div>
        </li>
      {/each}
    </ul>
    </div>
  {/if}
</div>

<Dialog bind:open={removeOpen} title={$accountsContent.removeTitle.value}>
  <p class="m-0">
    {$accountsContent.removeBody({ name: removeTarget?.displayName ?? "" })
      .value}
  </p>
  {#snippet actions()}
    <Button variant="ghost" onclick={() => (removeOpen = false)}>
      {$commonContent.cancel.value}
    </Button>
    <Button variant="danger" onclick={confirmRemove}>
      {$accountsContent.remove.value}
    </Button>
  {/snippet}
</Dialog>
