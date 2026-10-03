import { error, info } from "@tauri-apps/plugin-log";
import { appState, gameState, setGameState, loadAppState } from "$lib/appState.svelte";
import type { LogLineEvent } from "./watcher";
import { setActivity, addActivity } from "../discordRpc";
import { getGameInfo, getGameThumbnail, getUserHeadShot, getUserName } from "../generalRobloxApis";
import { getCustomGameIcon } from "$ts/svg/api";
import { fetchLocation } from "$ts/geo";
import { isPermissionGranted, requestPermission, sendNotification } from "@tauri-apps/plugin-notification";
import { commands } from "$ts/bindings";

async function notify(options: { title: string, body: string }) {
    let granted = await isPermissionGranted();
    if (!granted) {
        granted = (await requestPermission()) === "granted";
    }
    if (granted) {
        await sendNotification(options);
    } else {
        error("notification permission not granted, skipping notify");
    }
}

async function getLargeImage(placeId: number): Promise<string | undefined> {
    const discordRpc = appState.integrations.discordRpc;

    if (discordRpc.largeImagePreset === "gisl") {
        return getCustomGameIcon(placeId, {
            svgUrl: "https://raw.githubusercontent.com/TheMallyGuy/something-repo/refs/heads/main/games%20is%20life.svg",
            overlay: "black",
            size: 500,
        });
    }
    if (discordRpc.largeImagePreset === "interview") {
        return getCustomGameIcon(placeId, {
            svgUrl: "https://raw.githubusercontent.com/TheMallyGuy/something-repo/refs/heads/main/my%20bad%20g.svg",
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

let activeSession: { placeId: number; state: string; largeImage: string | undefined; startTimestamp: number } | null = null;

async function applyHeadshot() {
    if (!activeSession || !appState.integrations.discordRpc.shareAccount || !gameState.userId) return;

    let userHeadshot: string | undefined;
    let userDisplayName: string | undefined;

    try {
        userHeadshot = (await getUserHeadShot(gameState.userId)) ?? undefined;
    } catch (err) {
        error(`failed to fetch user headshot for ${gameState.userId}: ${err}`);
        return;
    }

    try {
        userDisplayName = (await getUserName(gameState.userId)) ?? undefined;
    } catch (err) {
        error(`failed to fetch user headshot for ${gameState.userId}: ${err}`)
    }


    if (!activeSession) return; // may have left the game while the headshot was fetching

    await addActivity({
        smallImage: userHeadshot,
        smallText: userDisplayName
    })
}

async function startTasxIfEnabled() {
    if (!appState.integrations.trimMemWhenNotFocused.enabled) return;

    const hwnd = await commands.getRobloxHwnd();
    if (hwnd.status === "error") {
        error(`TASX optimizer: failed to get Roblox's window handle: ${hwnd.error}`);
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
            await loadAppState();

            const gameInfo = await getGameInfo(placeId)

            const udmx = gameState.serverIp

            if (udmx && appState.integrations.serverLocNotifer.enabled) {
                try {
                    const geoInformation = await fetchLocation(udmx)

                    await notify({
                        title: `bro is located in ${geoInformation.continent.toLowerCase()}`,
                        body: `${geoInformation.city}, ${geoInformation.country}`
                    })
                } catch (err) {
                    error(`server location notification skipped: ${err}`)
                }
            }

            activeSession = {
                placeId,
                state: `Playing ${gameInfo.name}`,
                largeImage: await getLargeImage(placeId),
                startTimestamp: Date.now(),
            };

            await setActivity({
                largeImage: activeSession.largeImage,
                state: activeSession.state,
                startTimestamp: activeSession.startTimestamp,
                buttons: [{
                    label: "View Game",
                    url: `https://roblox.com/games/${placeId}`
                }]
            })

            if (appState.integrations.discordRpc.join) {
                await addActivity({
                    buttons: [{
                        label: "View Game",
                        url: `https://roblox.com/games/${placeId}`
                    },
                    {
                        label: "Join Game",
                        url: `roblox-player:1+launchmode:play+gameinfo:${gameId}+launchtime:${Date.now()}`
                    }]
                })
            }

            await applyHeadshot();
            await startTasxIfEnabled();
        },
    },
    {
        name: "gameLeft",
        pattern: /Sending disconnect with reason: (\d+)/,
        handler: async (m) => {
            const [, code] = m
            activeSession = null;
            await setActivity({
                state: "In the app",
                largeImage: "https://imgs.search.brave.com/155yo8PzipWuiIXOk-b5j2bSpm_qYmxFEB6XoOQuK-Q/rs:fit:860:0:0:0/g:ce/aHR0cHM6Ly9pbWFn/ZXMubWVtZS1hcnNl/bmFsLmNvbS9jM2Qx/OTY4ZDZlODkxMjE3/MmJkMTBmNzE1YzQ1/OWUwMi5qcGc",
                startTimestamp: Date.now(),
            })
            info(`disconnected game with code id: ${code}`)
        }
    },
    {
        name: "gameJoiningUniverse",
        pattern: /universeid:([0-9]+).*userid:([0-9]+)/,
        handler: async (m) => {
            const [, universeId, userId] = m;

            setGameState({ userId: Number(userId) })

            info(`Universe ID: ${universeId}`);
            info(`User ID: ${userId}`);

            await applyHeadshot();
        },
    },
    {
        name: "gameJoiningUDMUX",
        pattern: /UDMUX Address\s*=\s*([0-9\.]+),\s*Port\s*=\s*[0-9]+\s*\|\s*RCC Server Address\s*=\s*([0-9\.]+),\s*Port\s*=\s*[0-9]+/,
        handler: (m) => {
            const [, udmuxAddress, rccServerAddress] = m;
            setGameState({ serverIp: udmuxAddress })
            info(`UDMUX: udmuxAddress=${udmuxAddress} rccServerAddress=${rccServerAddress}`);
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
            setGameState({ serverUptime: timestamp }) // TODO: will look at this back later
            info(`server uptime timestamp: ${timestamp}`);
        },
    },
];

export function processLogLine({ line }: LogLineEvent) {
    for (const { name, pattern, handler } of rules) {
        const match = pattern.exec(line);
        if (match) {
            Promise.resolve(handler(match)).catch((err) => error(`log rule "${name}" handler failed: ${err}`));
            break;
        }
    }
}