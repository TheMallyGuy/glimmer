/** In-memory stand-ins for `@tauri-apps/api/tray`, `/menu` and `/app`. */

interface MenuItemOptions {
    id?: string;
    text: string;
    action?: () => void;
}

interface TrayOptions {
    id?: string;
    icon?: unknown;
    tooltip?: string;
    menu?: FakeMenu;
    showMenuOnLeftClick?: boolean;
    action?: (event: Record<string, unknown>) => void;
}

export class FakeMenuItem {
    constructor(readonly options: MenuItemOptions) { }

    static async new(options: MenuItemOptions) {
        return new FakeMenuItem(options);
    }
}

export class FakeMenu {
    constructor(readonly items: FakeMenuItem[]) { }

    static async new({ items }: { items: FakeMenuItem[] }) {
        return new FakeMenu(items);
    }
}

const icons = new Map<string, FakeTrayIcon>();

export class FakeTrayIcon {
    closed = false;

    constructor(readonly options: TrayOptions) { }

    static async new(options: TrayOptions) {
        const icon = new FakeTrayIcon(options);
        icons.set(options.id ?? "", icon);
        return icon;
    }

    static async getById(id: string) {
        const icon = icons.get(id);
        return icon && !icon.closed ? icon : null;
    }

    async close() {
        this.closed = true;
    }
}

export const fakeTray = {
    reset() {
        icons.clear();
        fakeTray.exitCodes.length = 0;
    },

    /** every tray icon that is still showing */
    visible: () => [...icons.values()].filter((i) => !i.closed),

    /** the codes `exit()` was called with */
    exitCodes: [] as number[],
};

export const appModule = {
    defaultWindowIcon: async () => "app-icon",
    exit: async (code: number) => void fakeTray.exitCodes.push(code),
};
