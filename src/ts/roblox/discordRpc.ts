import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { debug, error } from "@tauri-apps/plugin-log";
import { commands, type DiscordActivityPayload } from "$ts/glimmer/bindings";
import { appState } from "$lib/appState.svelte";
import { isAndroid } from "$ts/glimmer/android/platform";
import { DISCORD_APPLICATION_ID, setActivityFrame } from "$ts/glimmer/android/discordFrame";

let running = false;
let unlisten: UnlistenFn | undefined;

let loginPromise: Promise<void> | undefined;

async function handleSidecarLine(line: string) {
  let event: { type: string; message?: string };
  try {
    event = JSON.parse(line);
  } catch {
    return;
  }

  switch (event.type) {
    case "connected":
      debug("Discord RPC: sidecar connected");
      break;
    case "ready":
      debug("Discord RPC: sidecar ready");
      break;
    case "disconnected":
      debug("Discord RPC: sidecar disconnected");
      break;
    case "error":
      error(`Discord RPC: sidecar error: ${event.message}`);
      break;
  }
}

export async function initDiscordRpc() {
  if (!appState.integrations.discordRpc.enabled) {
    debug("Discord RPC: skipped init, disabled in settings");
    return;
  }
  if (running || loginPromise) {
    debug("Discord RPC: skipped init, already running");
    return;
  }

  try {
    loginPromise = (async () => {
      if (isAndroid()) {
        const result = await commands.discordAndroidConnect(DISCORD_APPLICATION_ID, null);
        if (result.status === "error") throw new Error(result.error);
        running = true;
        return;
      }
      unlisten = await listen<string>("discord-rpc-event", (e) => handleSidecarLine(e.payload));

      const result = await commands.discordRpcLogin();
      if (result.status === "error") throw new Error(result.error);

      running = true;
    })();
    await loginPromise;
    debug("Discord RPC: started sidecar");
  } catch (err) {
    error(`Failed to start Discord RPC: ${err}`);
  } finally {
    loginPromise = undefined;
  }
}

export async function shutdownDiscordRpc() {
  if (!running) {
    debug("Discord RPC: skipped shutdown, not running");
    return;
  }

  try {
    const result = isAndroid()
      ? await commands.discordAndroidDisconnect()
      : await commands.discordRpcStop();
    if (result.status === "error") throw new Error(result.error);

    unlisten?.();
    unlisten = undefined;
    running = false;
    debug("Discord RPC: stopped");
  } catch (err) {
    error(`Failed to stop Discord RPC: ${err}`);
  }
}

export type ActivityOptions = {
  details?: string;
  state?: string;
  largeImage?: string;
  largeText?: string;
  smallImage?: string;
  smallText?: string;
  buttons?: { label: string; url: string }[];
  startTimestamp?: number;
  endTimestamp?: number;
  partyId?: string;
  partySize?: [number, number];
  joinSecret?: string;
  spectateSecret?: string;
  matchSecret?: string;
};

let currentActivity: ActivityOptions = {};

/** Discord answers a frame with a frame; one that says ERROR is a failure */
async function sendAndroidFrame(frame: string) {
  const result = await commands.discordAndroidSend(frame, null);
  if (result.status === "error") return result;
  const failed = result.data.find((f) => f.includes('"evt":"ERROR"'));
  return failed
    ? { status: "error" as const, error: failed }
    : { status: "ok" as const, data: null };
}

async function sendActivity(opts: ActivityOptions) {
  if (!appState.integrations.discordRpc.enabled) {
    debug("Discord RPC: skipped setActivity, disabled in settings");
    return;
  }
  if (!running) {
    debug("Discord RPC: skipped setActivity, sidecar not running");
    return;
  }

  const activity: DiscordActivityPayload = {
    details: opts.details ?? null,
    state: opts.state ?? null,
    startTimestamp: opts.startTimestamp ?? null,
    endTimestamp: opts.endTimestamp ?? null,
    largeImageKey: opts.largeImage ?? null,
    largeImageText: opts.largeText ?? null,
    smallImageKey: opts.smallImage ?? null,
    smallImageText: opts.smallText ?? null,
    buttons: opts.buttons?.length
      ? opts.buttons.map((b) => ({ label: b.label, url: b.url }))
      : null,
    joinSecret: opts.joinSecret ?? null,
    spectateSecret: opts.spectateSecret ?? null,
    matchSecret: opts.matchSecret ?? null,
    partyId: opts.partyId ?? null,
    partySize: opts.partySize?.[0] ?? null,
    partyMax: opts.partySize?.[1] ?? null,
  };

  debug(`Discord RPC: setActivity payload -> ${JSON.stringify(activity)}`);

  const result = isAndroid()
    ? await sendAndroidFrame(setActivityFrame(opts, crypto.randomUUID()))
    : await commands.discordRpcSetActivity(activity);
  if (result.status === "error") {
    error(`Failed to set Discord RPC activity: ${result.error}`);
  } else {
    debug("Discord RPC: setActivity sent");
  }
}

/**
 * Replaces the whole activity.
 *
 * @example
 * await setActivity({
 *     details: "The Strongest Battlegrounds",
 *     state: "In a match",
 *     largeImage: await getCustomGameIcon(10449761463),
 *     largeText: "The Strongest Battlegrounds",
 *     startTimestamp: Date.now(),
 *     buttons: [{ label: "Play on Roblox", url: "https://www.roblox.com/games/10449761463" }],
 * });
 */
export async function setActivity(opts: ActivityOptions) {
  currentActivity = { ...opts };
  await sendActivity(currentActivity);
}

/**
 * Merges fields into the activity set by the last setActivity()/addActivity() call and resends it.
 *
 * @example
 * await addActivity({
 *     smallImage: userHeadshot,
 *     smallText: userDisplayName,
 * });
 */
export async function addActivity(opts: Partial<ActivityOptions>) {
  currentActivity = { ...currentActivity, ...opts };
  await sendActivity(currentActivity);
}

export async function clearActivity() {
  if (!running) {
    debug("Discord RPC: skipped clearActivity, sidecar not running");
    return;
  }

  currentActivity = {};

  const result = isAndroid()
    ? await sendAndroidFrame(setActivityFrame(null, crypto.randomUUID()))
    : await commands.discordRpcClearActivity();
  if (result.status === "error") {
    error(`Failed to clear Discord RPC activity: ${result.error}`);
  } else {
    debug("Discord RPC: clearActivity sent");
  }
}
