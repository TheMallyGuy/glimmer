/**
 * Preloaded by bunfig.toml. Replaces the Tauri plugins with in-memory fakes so the
 * non-UI logic in src/ts can run under `bun test` without a webview.
 *
 * `mock.module` is process-wide in Bun, so every Tauri module is mocked here once
 * instead of per test file; tests tweak behaviour through the helpers they import.
 */
import { mock } from "bun:test";
import { fsModule } from "./helpers/fakeFs";
import { WebviewWindow } from "./helpers/webview";
import { FakeMenu, FakeMenuItem, FakeTrayIcon, appModule } from "./helpers/tray";
import { invoke, logSpies } from "./helpers/tauri";

// vite fills this in at build time
(globalThis as { __BUILD_ID__?: string }).__BUILD_ID__ = "test";

mock.module("@tauri-apps/api/path", () => ({
    appDataDir: async () => "/appdata",
    appCacheDir: async () => "/cache",
    appLogDir: async () => "/logs",
    dataDir: async () => "/data",
    localDataDir: async () => "/localdata",
    resolveResource: async (p: string) => `/resources/${p}`,
    join: async (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/{2,}/g, "/"),
}));

mock.module("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }));
mock.module("@tauri-apps/plugin-fs", () => fsModule);
mock.module("@tauri-apps/api/webviewWindow", () => ({ WebviewWindow }));
mock.module("@tauri-apps/api/tray", () => ({ TrayIcon: FakeTrayIcon }));
mock.module("@tauri-apps/api/menu", () => ({ Menu: FakeMenu, MenuItem: FakeMenuItem }));
mock.module("@tauri-apps/api/app", () => appModule);
mock.module("@tauri-apps/plugin-deep-link", () => ({ onOpenUrl: async () => () => { }, getCurrent: async () => null }));
mock.module("@tauri-apps/plugin-log", () => logSpies);

// plugins whose JS needs the webview's channels, which the fake core above does not have. Tests that care stand in with their own.
mock.module("@tauri-apps/plugin-global-shortcut", () => ({
    register: async () => {},
    unregister: async () => {},
    isRegistered: async () => false,
}));
mock.module("@tauri-apps/plugin-clipboard-manager", () => ({ writeText: async () => {} }));
mock.module("@tauri-apps/plugin-opener", () => ({ openUrl: async () => {} }));
mock.module("@tauri-apps/plugin-process", () => ({ relaunch: async () => {} }));
mock.module("@tauri-apps/plugin-updater", () => ({ check: async () => null }));

// SvelteKit modules only exist inside the app; outside Tauri the window helpers navigate with goto
mock.module("$app/navigation", () => ({ goto: async () => {} }));

// plugin-http's fetch is the browser one; routing it through globalThis lets a test stub one thing
mock.module("@tauri-apps/plugin-http", () => ({
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
