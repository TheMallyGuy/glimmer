import { beforeEach, describe, expect, test } from "bun:test";
import { AppTray, type TrayText } from "$ts/glimmer/tray";
import { focusExistingInstance } from "$ts/windows/focus";
import { fakeTray } from "./helpers/tray";
import { fakeWebviews, WebviewWindow } from "./helpers/webview";
import { invokeCalls, invokeHandlers } from "./helpers/tauri";

const TEXT: TrayText = { tooltip: "Glimmer", openSelector: "Open selector", quit: "Quit" };

let focused: number;
let opened: number;
let quit: number;

const tray = () =>
  new AppTray(
    TEXT,
    async () => void focused++,
    async () => void opened++,
    async () => void quit++,
  );

beforeEach(() => {
  fakeTray.reset();
  fakeWebviews.reset();
  focused = opened = quit = 0;
});

/** the one icon that is showing */
const icon = () => {
  const [only, ...rest] = fakeTray.visible();
  expect(rest).toHaveLength(0);
  return only;
};

describe("AppTray.show", () => {
  test("shows one icon with the app icon and the tooltip", async () => {
    await tray().show();

    expect(icon().options).toMatchObject({
      id: "glimmer",
      icon: "app-icon",
      tooltip: "Glimmer",
      showMenuOnLeftClick: false,
    });
  });

  test("the menu has Open selector then Quit", async () => {
    await tray().show();

    const items = icon().options.menu!.items.map((i) => ({
      id: i.options.id,
      text: i.options.text,
    }));
    expect(items).toEqual([
      { id: "open_selector", text: "Open selector" },
      { id: "quit", text: "Quit" },
    ]);
  });

  test("Open selector opens the chooser and Quit quits", async () => {
    await tray().show();
    const [open, exit] = icon().options.menu!.items;

    open.options.action!();
    expect([opened, quit]).toEqual([1, 0]);

    exit.options.action!();
    expect([opened, quit]).toEqual([1, 1]);
  });

  test("showing again replaces the icon instead of adding a second one", async () => {
    const first = tray();
    await first.show();
    const old = icon();

    await tray().show();

    expect(old.closed).toBe(true);
    expect(fakeTray.visible()).toHaveLength(1);
  });
});

describe("tray clicks", () => {
  const click = (event: Record<string, unknown>) => icon().options.action!(event);

  test("a left click, released, brings the window to the front", async () => {
    await tray().show();

    click({ type: "Click", button: "Left", buttonState: "Up" });

    expect(focused).toBe(1);
  });

  test.each([
    ["the press of a left click", { type: "Click", button: "Left", buttonState: "Down" }],
    ["a right click", { type: "Click", button: "Right", buttonState: "Up" }],
    ["a double click", { type: "DoubleClick", button: "Left" }],
    ["the pointer moving over it", { type: "Move" }],
  ])("%s does nothing", async (_name, event) => {
    await tray().show();

    click(event);

    expect(focused).toBe(0);
  });
});

describe("AppTray.hide", () => {
  test("removes the icon", async () => {
    const t = tray();
    await t.show();

    await t.hide();

    expect(fakeTray.visible()).toHaveLength(0);
  });
});

describe("the default quit", () => {
  test("quits through the exit command", async () => {
    invokeHandlers.exit = () => undefined;

    await new AppTray(TEXT).show();

    icon().options.menu!.items[1].options.action!();

    await Promise.resolve();
    expect(invokeCalls.filter((c) => c.cmd === "exit")).toHaveLength(1);
  });
});

describe("focusExistingInstance", () => {
  test("brings the chooser forward, restoring it if it was minimised", async () => {
    const chooser = new WebviewWindow("main");

    await focusExistingInstance();

    expect(chooser.calls).toEqual(["unminimize", "show", "setFocus"]);
  });

  test("falls back to the splash when there is no chooser", async () => {
    const splash = new WebviewWindow("splash");

    await focusExistingInstance();

    expect(splash.calls).toEqual(["unminimize", "show", "setFocus"]);
  });

  test("opens the chooser when neither window is open", async () => {
    await focusExistingInstance();

    expect(fakeWebviews.created.map((w) => w.label)).toEqual(["main"]);
  });
});
