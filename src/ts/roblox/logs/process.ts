import { error, info } from "@tauri-apps/plugin-log";
import {
  appState,
  gameState,
  setGameState,
  loadAppState,
} from "$lib/appState.svelte";
import type { LogLineEvent } from "./watcher";
import { setActivity, addActivity } from "../discordRpc";
import {
  getAssetThumbnail,
  getGameInfo,
  getGameThumbnail,
  getUserHeadShot,
  getUserName,
} from "../generalRobloxApis";
import { getCustomGameIcon } from "$ts/svg/api";
import { GameHistory } from "../gameHistory";
import { fetchLocation } from "$ts/geo";
import { notify } from "$ts/notify";
import { commands } from "$ts/bindings";
import { Configuration } from "$ts/configuration";
import { WindowControl, type WindowPrompt } from "../windowControl";
import { BloxstrapRpc, PRESENCE_COMMANDS } from "../bloxstrapRpc";
import { GameLink } from "../game";

let windowPrompt: ((game: string) => WindowPrompt) | undefined;

export function setWindowPrompt(prompt: (game: string) => WindowPrompt) {
  windowPrompt = prompt;
}

/** remembers the game in config.json too, as only the allowed games change here and not the settings the settings window may have open */
async function allowUniverse(universeId: number) {
  const { allowedUniverses } = appState.integrations.windowControl;
  if (!allowedUniverses.includes(universeId)) allowedUniverses.push(universeId);

  const configuration = await Configuration.create();
  let config: Record<string, any> = {};
  try {
    config = JSON.parse(await configuration.getAsText());
  } catch {
    // no config yet
  }
  config.integrations = {
    ...config.integrations,
    windowControl: { ...config.integrations?.windowControl, allowedUniverses: [...allowedUniverses] },
  };
  await configuration.saveRaw(JSON.stringify(config));
}

const windowControl = new WindowControl({
  isAllowed: (universeId) => appState.integrations.windowControl.allowedUniverses.includes(universeId),
  allow: allowUniverse,
  prompt: (game) => {
    if (!windowPrompt) throw new Error("the permission question has no text yet");
    return windowPrompt(game);
  },
});

const bloxstrapRpc = new BloxstrapRpc({
  update: addActivity,
  thumbnail: getAssetThumbnail,
  accountShown: () => appState.integrations.discordRpc.shareAccount,
  log: (message) => info(message),
});



async function getLargeImage(placeId: number): Promise<string | undefined> {
  const discordRpc = appState.integrations.discordRpc;

  if (discordRpc.largeImagePreset === "gisl") {
    return getCustomGameIcon(placeId, {
      svgUrl:
        "https://raw.githubusercontent.com/TheMallyGuy/something-repo/refs/heads/main/games%20is%20life.svg",
      overlay: "black",
      size: 500,
    });
  }
  if (discordRpc.largeImagePreset === "aurora") {
    return getCustomGameIcon(placeId, {
      svgUrl:
        "https://raw.githubusercontent.com/TheMallyGuy/something-repo/refs/heads/main/glow.svg",
      overlay: "white",
      size: 500,
    });
  }
  if (discordRpc.largeImagePreset === "interview") {
    return getCustomGameIcon(placeId, {
      svgUrl:
        "https://raw.githubusercontent.com/TheMallyGuy/something-repo/refs/heads/main/my%20bad%20g.svg",
      overlay: "black",
      size: 500,
    });
  }
  if (discordRpc.largeImagePreset === "custom") {
    return getCustomGameIcon(placeId, {
      svgUrl: discordRpc.customImage.svgUrl || undefined,
      overlay: discordRpc.customImage.overlay as "black" | "white",
      size: Number(discordRpc.customImage.size) || undefined,
    });
  }
  return getCustomGameIcon(placeId);
}

// patterns
// using https://github.com/Froststrap/Froststrap/blob/main/Froststrap/Integrations/ActivityWatcher.cs for reference

type Handler = (match: RegExpExecArray) => void;

let activeSession: {
  placeId: number;
  state: string;
  largeImage: string | undefined;
  startTimestamp: number;
} | null = null;

async function applyHeadshot() {
  if (
    !activeSession ||
    !appState.integrations.discordRpc.shareAccount ||
    !gameState.userId
  )
    return;

  let userHeadshot: string | undefined;
  let user: { displayName: string; username: string } | undefined;

  try {
    userHeadshot = (await getUserHeadShot(gameState.userId)) ?? undefined;
  } catch (err) {
    error(`failed to fetch user headshot for ${gameState.userId}: ${err}`);
    return;
  }

  try {
    user = (await getUserName(gameState.userId)) ?? undefined;
  } catch (err) {
    error(`failed to fetch user headshot for ${gameState.userId}: ${err}`);
  }

  if (!activeSession) return; // may have left the game while the headshot was fetching

  await addActivity({
    smallImage: userHeadshot,
    smallText: `${user!.displayName} (${user!.username})`,
  });
}

async function startTasxIfEnabled() {
  if (!appState.integrations.trimMemWhenNotFocused.enabled) return;

  const hwnd = await commands.getRobloxHwnd();
  if (hwnd.status === "error") {
    error(
      `TASX optimizer: failed to get Roblox's window handle: ${hwnd.error}`,
    );
    return;
  }

  const result = await commands.tasx(hwnd.data);
  if (result.status === "error") {
    error(`TASX optimizer: failed to start: ${result.error}`);
  }
}

const rules: { name: string; pattern: RegExp; handler: Handler }[] = [
  {
    name: "gameJoin",
    pattern: /! Joining game '([0-9a-f\-]{36})' place ([0-9]+) at ([0-9\.]+)/,
    handler: async (m) => {
      const [, gameId, place, position] = m;
      info(`game join: gameId=${gameId} place=${place} position=${position}`);
      const placeId = Number(place);
      setGameState({ gameId: placeId, gameServer: gameId });
      await loadAppState();

      const gameInfo = await getGameInfo(placeId);

      try {
        await new GameHistory().record(placeId, gameInfo.name);
      } catch (err) {
        error(`failed to remember the game ${placeId}: ${err}`);
      }

      if (appState.integrations.windowControl.enabled) {
        try {
          await windowControl.join(gameInfo.universeId, gameInfo.name);
        } catch (err) {
          error(`window control could not start: ${err}`);
        }
      }

      const udmx = gameState.serverIp;

      if (udmx && appState.integrations.serverLocNotifer.enabled) {
        try {
          const geoInformation = await fetchLocation(udmx);

          await notify({
            title: `bro is located in ${geoInformation.continent.toLowerCase()}`,
            body: `${geoInformation.city}, ${geoInformation.country}`,
          });
        } catch (err) {
          error(`server location notification skipped: ${err}`);
        }
      }

      activeSession = {
        placeId,
        state: `Playing ${gameInfo.name}`,
        largeImage: await getLargeImage(placeId),
        startTimestamp: Date.now(),
      };

      // the join button is a roblox:// link, so it can carry the launch data a game sets (SetLaunchData)
      const buttons = (launchData?: string) => [
        {
          label: "View Game",
          url: `https://roblox.com/games/${placeId}`,
        },
        ...(appState.integrations.discordRpc.join
          ? [{ label: "Join Game", url: GameLink.format({ placeId, jobId: gameId, launchData }) }]
          : []),
      ];

      const activity = {
        largeImage: activeSession.largeImage,
        state: activeSession.state,
        startTimestamp: activeSession.startTimestamp,
        buttons: buttons(),
      };
      await setActivity(activity);
      await bloxstrapRpc.begin(activity, buttons);

      await applyHeadshot();
      await startTasxIfEnabled();
    },
  },
  {
    name: "gameLeft",
    pattern: /Sending disconnect with reason: (\d+)/,
    handler: async (m) => {
      const [, code] = m;
      activeSession = null;
      setGameState({ gameId: 0, gameServer: "" });
      bloxstrapRpc.end();
      await windowControl.leave().catch((err) => error(`window control could not reset the window: ${err}`));
      await setActivity({
        state: "In the app",
        largeImage:
          "https://imgs.search.brave.com/155yo8PzipWuiIXOk-b5j2bSpm_qYmxFEB6XoOQuK-Q/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWFn/ZXMubWVtZS1hcnNl/bmFsLmNvbS9jM2Qx/OTY4ZDZlODkxMjE3/MmJkMTBmNzE1YzQ1/OWUwMi5qcGc",
        startTimestamp: Date.now(),
      });
      info(`disconnected game with code id: ${code}`);
    },
  },
  {
    name: "bloxstrapRPC",
    pattern: /\[BloxstrapRPC\] (.+)$/,
    handler: async (m) => {
      let message: { command?: unknown; data?: unknown };

      try {
        message = JSON.parse(m[1]);
      } catch {
        return; // not a message for us
      }

      if (typeof message.command !== "string") return;
      info(`BloxstrapRPC: ${m[1].slice(0, 300)}`);

      // Discord commands are Bloxstrap's, the rest are Funkstrap's window commands
      if (PRESENCE_COMMANDS.includes(message.command)) {
        if (appState.integrations.discordRpc.enabled) await bloxstrapRpc.handle(message.command, message.data);
      } else if (appState.integrations.windowControl.enabled) {
        await windowControl.handle({ command: message.command, data: message.data });
      }
    },
  },
  {
    name: "gameJoiningUniverse",
    pattern: /universeid:([0-9]+).*userid:([0-9]+)/,
    handler: async (m) => {
      const [, universeId, userId] = m;

      setGameState({ userId: Number(userId) });

      info(`Universe ID: ${universeId}`);
      info(`User ID: ${userId}`);

      await applyHeadshot();
    },
  },
  {
    name: "gameJoiningUDMUX",
    pattern:
      /UDMUX Address\s*=\s*([0-9\.]+),\s*Port\s*=\s*[0-9]+\s*\|\s*RCC Server Address\s*=\s*([0-9\.]+),\s*Port\s*=\s*[0-9]+/,
    handler: (m) => {
      const [, udmuxAddress, rccServerAddress] = m;
      setGameState({ serverIp: udmuxAddress });
      info(
        `UDMUX: udmuxAddress=${udmuxAddress} rccServerAddress=${rccServerAddress}`,
      );
    },
  },
  {
    name: "gameJoinedEntry",
    pattern: /serverId: ([0-9\.]+)\|[0-9]+/,
    handler: (m) => {
      const [, serverId] = m;
      info(`Server ID: ${serverId}`);
    },
  },
  {
    name: "gameServerUptime",
    pattern: /Server Prefix:.+_(\d{8}T\d{6}Z)_RCC_[0-9a-z]+/,
    handler: (m) => {
      const [, timestamp] = m;
      setGameState({ serverUptime: timestamp }); // TODO: will look at this back later
      info(`server uptime timestamp: ${timestamp}`);
    },
  },
];

export function processLogLine({ line }: LogLineEvent) {
  for (const { name, pattern, handler } of rules) {
    const match = pattern.exec(line);
    if (match) {
      Promise.resolve(handler(match)).catch((err) =>
        error(`log rule "${name}" handler failed: ${err}`),
      );
      break;
    }
  }
}
