import { defaultWindowIcon, exit } from "@tauri-apps/api/app";
import { Menu, MenuItem } from "@tauri-apps/api/menu";
import { TrayIcon, type TrayIconEvent } from "@tauri-apps/api/tray";
import { focusExistingInstance } from "./windows/focus";
import { openChooserWindow } from "./windows/chooser";
import { commands } from "./bindings";

const TRAY_ID = "glimmer";

export interface TrayText {
    tooltip: string;
    openSelector: string;
    quit: string;
}

export class AppTray {
    private tray: TrayIcon | null = null;

    constructor(
        private readonly text: TrayText,
        private readonly focus: () => Promise<unknown> = focusExistingInstance,
        private readonly openSelector: () => Promise<unknown> = openChooserWindow,
        private readonly quit: () => Promise<void> = () => commands.exit(),
    ) { }

    async show(): Promise<void> {
        // a reload leaves the previous icon behind, which would show up as a second one
        await (await TrayIcon.getById(TRAY_ID))?.close();

        const menu = await Menu.new({
            items: [
                await MenuItem.new({ id: "open_selector", text: this.text.openSelector, action: () => void this.openSelector() }),
                await MenuItem.new({ id: "quit", text: this.text.quit, action: () => void this.quit() }),
            ],
        });

        this.tray = await TrayIcon.new({
            id: TRAY_ID,
            icon: (await defaultWindowIcon()) ?? undefined,
            tooltip: this.text.tooltip,
            menu,
            showMenuOnLeftClick: false,
            action: (event) => this.onClick(event),
        });
    }

    async hide(): Promise<void> {
        await this.tray?.close();
        this.tray = null;
    }

    private onClick(event: TrayIconEvent) {
        if (event.type === "Click" && event.button === "Left" && event.buttonState === "Up") {
            void this.focus();
        }
    }
}
