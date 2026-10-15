import type { Flag } from "./flags";
import { DEFAULT_SLOTS, type Slots } from "./boardSlots";
import type { Account } from "$ts/roblox/account/login";
import { isTauri } from "@tauri-apps/api/core";
import { emit } from "@tauri-apps/api/event";
import { Configuration } from "$ts/glimmer/configuration";
import { DEFAULT_ACCENT } from "$ts/glimmer/theme";
import { DEFAULT_BACKGROUND, DEFAULT_DIM } from "$ts/glimmer/background";

export const appState = $state({
  integrations: {
    activityWatching: {
      enabled: true,
    },
    serverLocNotifer: {
      enabled: true,
    },
    discordRpc: {
      enabled: false,
      shareAccount: false,
      join: false,
      largeImagePreset: "aurora",
      customImage: {
        svgUrl: "",
        overlay: "white",
        size: "512",
      },
    },
    closeCrashHandler: {
      enabled: false,
    },
    trimMemWhenNotFocused: {
      enabled: false,
    },
    disableSystemTray: {
      enabled: false,
    },
    disableLaunchAtStartup: {
      enabled: false,
    },
    disableFullscreenOptimization: {
      enabled: false,
    },
    redRings: {
      enabled: false,
    },
    inGameMenu: {
      enabled: false,
      slots: [...DEFAULT_SLOTS] as Slots,
    },
    windowControl: {
      enabled: false,
      allowedUniverses: [] as number[],
    },
    fleasion: {
      enabled: false,
      path: "",
      settings: {
        mirrorGlimmerFF: false,
        verify: false,
        gameCreator: false,
        multiInstance: false,
        deVng: true,
        name: "",
      }
    }
  },
  installations: {
    parallelDownloader: {
      value: 5,
    },
    forceReinstallRoblox: {
      enabled: false,
    },
    disableRobloxUpgrade: {
      enabled: false,
    },
    vngDistribution: {
      enabled: false,
    },
  },
  fastflags: {
    enabled: true,
    flags: [] as Flag[], // flags go here
  },
  appearance: {
    /** accent colour as "#rrggbb" */
    accent: DEFAULT_ACCENT,
    background: {
      /** background colour as "#rrggbb" */
      color: DEFAULT_BACKGROUND,
      /** file name of the picture in the app data folder, or "" for none */
      image: "",
      /** how much the picture is darkened, 0 to 0.9 */
      dim: DEFAULT_DIM,
    },
  },
  accounts: {
    list: [] as Account[],
    /** the account the next launch signs in as */
    activeId: null as string | null,
  },
  onboarded: false,
  page: "/mods/manage",
  android: false
});

export const fleasionState = $state({ installed: false });

export function setFleasionInstallation(installed: boolean) {
  fleasionState.installed = installed;
}

export interface GameState {
  userId?: number;
  /** the place */
  gameId?: number;
  /** the running server (its job id) */
  gameServer?: string;
  serverIp?: string;
  serverUptime?: string;
}

export const gameState: GameState = $state({
  userId: 0,
  gameId: 0,
  gameServer: "", // server instance
  serverIp: "",
  serverUptime: "",
});

export function setGameState(inf: GameState) {
  Object.assign(gameState, inf);

  if (isTauri()) emit("game-state", inf);
}

function deepMerge(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
) {
  for (const key in source) {
    const value = source[key];
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      typeof target[key] === "object" &&
      target[key] !== null &&
      !Array.isArray(target[key])
    ) {
      deepMerge(
        target[key] as Record<string, unknown>,
        value as Record<string, unknown>,
      );
    } else {
      target[key] = value;
    }
  }
}

/** changes config.json in place: this window's copy of the settings can be older than the file, so only the keys `change` touches are written */
async function patchConfig(change: (config: Record<string, any>) => void) {
  const c = await Configuration.create();
  let config: Record<string, any> = {};
  try {
    config = JSON.parse(await c.getAsText());
  } catch {
    // no config yet
  }
  change(config);
  await c.saveRaw(JSON.stringify(config));
}

/** keeps where Fleasion runs from, for the launches after this one */
export async function rememberFleasionPath(path: string) {
  appState.integrations.fleasion.path = path;
  if (!isTauri()) return;
  await patchConfig((config) => {
    ((config.integrations ??= {}).fleasion ??= {}).path = path;
  });
}

/** keeps the page the person is on, so the settings window opens there next time (no Save needed) */
export async function rememberPage(path: string) {
  if (path === appState.page || path === "/mods") return; // /mods only redirects to a saved page
  appState.page = path;
  if (!isTauri()) return;
  await patchConfig((config) => {
    config.page = path;
  });
}

export async function loadAppState() {
  if (!isTauri()) return; // keep the defaults when the page runs outside Tauri
  const c = await Configuration.create();
  let text = "";
  try {
    text = await c.getAsText();
  } catch {
    return; // first launch: no config.json yet, keep the defaults
  }
  if (text) deepMerge(appState, JSON.parse(text));
}
