/** Spies and fakes shared by the Tauri module mocks registered in `tests/setup.ts`. */
import { mock } from "bun:test";

export const logSpies = {
    debug: mock((_msg: string) => { }),
    info: mock((_msg: string) => { }),
    warn: mock((_msg: string) => { }),
    error: mock((_msg: string) => { }),
};

/** every `invoke(cmd, args)` call, answered by `invokeHandlers[cmd]` */
export const invokeCalls: { cmd: string; args: unknown }[] = [];
export const invokeHandlers: Record<string, (args: unknown) => unknown> = {};

export async function invoke(cmd: string, args?: unknown) {
    invokeCalls.push({ cmd, args });
    const handler = invokeHandlers[cmd];
    if (!handler) throw new Error(`unmocked tauri command: ${cmd}`);
    return handler(args);
}

export function resetTauri() {
    for (const spy of Object.values(logSpies)) spy.mockClear();
    invokeCalls.length = 0;
    for (const key of Object.keys(invokeHandlers)) delete invokeHandlers[key];
}

/** minimal `Response` lookalike for code that only touches ok/status/json/text */
export function jsonResponse(body: unknown, init: { status?: number; statusText?: string } = {}) {
    const status = init.status ?? 200;
    return {
        ok: status >= 200 && status < 300,
        status,
        statusText: init.statusText ?? "",
        json: async () => body,
        text: async () => (typeof body === "string" ? body : JSON.stringify(body)),
    };
}
