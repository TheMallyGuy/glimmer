import { isTauri } from '@tauri-apps/api/core';
import { appState } from '$lib/appState.svelte';
import { Configuration } from '$ts/configuration';
import {
  AccountLogin,
  loginStillValid,
  removeLogin,
  withAccounts,
  type Account
} from '$ts/roblox/account/login';

/** view state of the Accounts tab */
export const accountsView = $state({
  /** the login window is open */
  adding: false,
  error: '',
  /** account ids whose saved login Roblox no longer accepts */
  expired: {} as Record<string, boolean>
});

let login: AccountLogin | null = null;

/** writes only the accounts to config.json, so adding or removing one never saves other pending settings */
async function persist() {
  if (!isTauri()) return;

  const configuration = await Configuration.create();
  let raw = '';
  try {
    raw = await configuration.getAsText();
  } catch {
    // no config yet
  }
  await configuration.saveRaw(withAccounts(raw, $state.snapshot(appState.accounts)));
}

/** opens the Roblox login window and saves the account once the person has logged in */
export async function addAccount() {
  if (accountsView.adding) return;
  accountsView.adding = true;
  accountsView.error = '';

  login = new AccountLogin();
  try {
    const account = await login.run();
    if (!account) return;

    const { list } = appState.accounts;
    const known = list.findIndex((a) => a.id === account.id);
    if (known >= 0) list[known] = account;
    else list.push(account);

    // the first account is the one the person most likely wants to use
    if (!appState.accounts.activeId) appState.accounts.activeId = account.id;
    delete accountsView.expired[account.id];
    await persist();
  } catch (e) {
    accountsView.error = e instanceof Error ? e.message : String(e);
  } finally {
    login = null;
    accountsView.adding = false;
  }
}

export async function cancelAddAccount() {
  await login?.cancel();
}

/** the next launch signs in as this account, or leaves Roblox on its own login for null */
export async function selectAccount(id: string | null) {
  appState.accounts.activeId = id;
  await persist();
}

export async function removeAccount(id: string) {
  await removeLogin(id);

  const { list } = appState.accounts;
  appState.accounts.list = list.filter((a: Account) => a.id !== id);
  if (appState.accounts.activeId === id) appState.accounts.activeId = null;
  delete accountsView.expired[id];
  await persist();
}

/** marks the accounts whose saved login Roblox has stopped accepting */
export async function checkAccounts() {
  if (!isTauri()) return;

  await Promise.all(
    appState.accounts.list.map(async (account: Account) => {
      accountsView.expired[account.id] = !(await loginStillValid(account.id));
    })
  );
}
