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

mock.module("@tauri-apps/api/path", () => ({
    appDataDir: async () => "/appdata",
    appCacheDir: async () => "/cache",
    dataDir: async () => "/data",
    join: async (...parts: string[]) => parts.filter(Boolean).join("/").replace(/\/{2,}/g, "/"),
}));

mock.module("@tauri-apps/api/core", () => ({ invoke, isTauri: () => true }));
mock.module("@tauri-apps/plugin-fs", () => fsModule);
mock.module("@tauri-apps/api/webviewWindow", () => ({ WebviewWindow }));
mock.module("@tauri-apps/api/tray", () => ({ TrayIcon: FakeTrayIcon }));
mock.module("@tauri-apps/api/menu", () => ({ Menu: FakeMenu, MenuItem: FakeMenuItem }));
mock.module("@tauri-apps/api/app", () => appModule);
mock.module("@tauri-apps/plugin-log", () => logSpies);

// SvelteKit modules only exist inside the app; outside Tauri the window helpers navigate with goto
mock.module("$app/navigation", () => ({ goto: async () => {} }));

// plugin-http's fetch is the browser one; routing it through globalThis lets a test stub one thing
mock.module("@tauri-apps/plugin-http", () => ({
    fetch: (...args: Parameters<typeof fetch>) => globalThis.fetch(...args),
}));
