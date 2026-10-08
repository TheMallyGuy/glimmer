import { readTextFile } from "@tauri-apps/plugin-fs";
import { commands } from "$ts/bindings";
import { PathManager } from "$ts/pathManager";
import type { LaunchReport } from "$ts/launch";
import { applyFleasionSettings, type FleasionOptions } from "./apply";

/** the line Fleasion writes to its log once its proxy takes connections */
const READY_LINE = "Fleasion Proxy Active";

export interface RestartOptions {
    path?: string;
    onPathFound?: (path: string) => void | Promise<void>;
    timeoutMs?: number;
    pollMs?: number;
}

async function readyCount(paths: PathManager): Promise<number> {
    try {
        return (await readTextFile(await paths.getFleasionLogFile())).split(READY_LINE).length - 1;
    } catch {
        return 0; // no log yet
    }
}

async function waitUntilReady(before: number, paths: PathManager, { timeoutMs = 40_000, pollMs = 500 }: RestartOptions) {
    const end = Date.now() + timeoutMs;
    while ((await readyCount(paths)) <= before) {
        if (Date.now() >= end) throw new Error("Fleasion did not finish starting");
        await new Promise((resolve) => setTimeout(resolve, pollMs));
    }
}

function unwrap<T>(result: { status: "ok"; data: T } | { status: "error"; error: string }): T {
    if (result.status === "error") throw new Error(result.error);
    return result.data;
}


export async function restartFleasion(
    options: FleasionOptions,
    flags: Record<string, string>,
    report: LaunchReport,
    restart: RestartOptions = {},
    paths = new PathManager(),
): Promise<void> {
    report({ step: "stoppingFleasion" }, null);
    let path = restart.path || null;
    let stopFailure: unknown = null;
    try {
        const ranFrom = unwrap(await commands.fleasionStop());
        if (ranFrom && ranFrom !== path) {
            path = ranFrom;
            await restart.onPathFound?.(ranFrom);
        }
    } catch (e) {
        stopFailure = e;
    }

    await applyFleasionSettings(options, flags);
    if (stopFailure) throw stopFailure;

    report({ step: "startingFleasion" }, null);
    const before = await readyCount(paths);
    unwrap(await commands.fleasionStart(path));
    await waitUntilReady(before, paths, restart);
}
