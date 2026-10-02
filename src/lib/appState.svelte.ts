import type { Flag } from './flags';
import type { Account } from '$ts/roblox/account/login';
import { isTauri } from '@tauri-apps/api/core';
import { Configuration } from '$ts/configuration';

export const appState = $state({
    integrations: {
        activityWatching: {
            enabled: true
        },
        serverLocNotifer: {
            enabled: true
        },
        discordRpc: {
            enabled: false,
            shareAccount: false,
            join: false,
            largeImagePreset: 'icon',
            customImage: {
                svgUrl: '',
                overlay: 'white',
                size: '512'
            }
        },
        closeCrashHandler: {
            enabled: false
        },
        trimMemWhenNotFocused: {
            enabled: false
        },
        disableSystemTray: {
            enabled: false
        },
        disableLaunchAtStartup: {
            enabled: false
        },
        disableFullscreenOptimization: {
            enabled: false
        },
    },
    installations: {
        parallelDownloader: {
            value: 5
        },
        forceReinstallRoblox: {
            enabled: false
        },
        disableRobloxUpgrade: {
            enabled: false
        },
        vngDistribution: {
            enabled: false
        }
    },
    fastflags: {
        enabled: true,
        flags: [] as Flag[] // flags go here
    },
    accounts: {
        list: [] as Account[],
        /** the account the next launch signs in as */
        activeId: null as string | null
    }
});

export interface GameState {
    userId?: number,
    gameId?: number,
    gameServer?: string,
    serverIp?: string,
    serverUptime?: string
}

export const gameState: GameState = $state({
    userId: 0,
    gameId: 0,
    gameServer: "",
    serverIp: "",
    serverUptime: "",
})

export function setGameState(inf: GameState) {
    Object.assign(gameState, inf)
}


function deepMerge(target: Record<string, unknown>, source: Record<string, unknown>) {
    for (const key in source) {
        const value = source[key];
        if (value && typeof value === 'object' && !Array.isArray(value) && typeof target[key] === 'object' && target[key] !== null && !Array.isArray(target[key])) {
            deepMerge(target[key] as Record<string, unknown>, value as Record<string, unknown>);
        } else {
            target[key] = value;
        }
    }
}

export async function loadAppState() {
    if (!isTauri()) return; // keep the defaults when the page runs outside Tauri
    const c = await Configuration.create();
    const text = await c.getAsText();
    if (text) deepMerge(appState, JSON.parse(text));
}