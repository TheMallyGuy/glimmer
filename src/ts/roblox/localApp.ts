import { commands } from "$ts/bindings";
import { info } from "@tauri-apps/plugin-log";

export class LocalAppEditor {
    vng = false;

    static async create(vng = false) {
        const lc = new LocalAppEditor();
        lc.vng = vng;

        return lc;
    }

    async setMinimizeToTray(enabled: boolean) {
        const localApp = await commands.getLocalApp(this.vng);
        if (localApp.status === "error") throw new Error(localApp.error);
        const rootCf = JSON.parse(localApp.data);

        const appCf = JSON.parse(rootCf.AppConfiguration);

        appCf.MinimizeToTray = enabled;
        info(`minimize tray : ${enabled}`);

        rootCf.AppConfiguration = JSON.stringify(appCf);

        const writeResult = await commands.writeLocalApp(JSON.stringify(rootCf), this.vng);
        if (writeResult.status === "error") throw new Error(writeResult.error);
    }

    async launchAtStartup(enabled: boolean) {
        const localApp = await commands.getLocalApp(this.vng);
        if (localApp.status === "error") throw new Error(localApp.error);
        const rootCf = JSON.parse(localApp.data);

        const appCf = JSON.parse(rootCf.AppConfiguration);

        appCf.LaunchAtStartup = enabled;
        info(`launch at startup : ${enabled}`);

        rootCf.AppConfiguration = JSON.stringify(appCf);

        const writeResult = await commands.writeLocalApp(JSON.stringify(rootCf), this.vng);
        if (writeResult.status === "error") throw new Error(writeResult.error);
    }
}