import type { Flag } from './flags';
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
            join: false
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
        }
    },
    fastflags: {
        flags: [] as Flag[] // flags go here
    }
});

export async function loadAppState() {
    const c = await Configuration.create();
    const text = await c.getAsText();
    if (text) Object.assign(appState, JSON.parse(text));
}