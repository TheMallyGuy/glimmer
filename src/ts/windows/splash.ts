import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const LABEL = 'splash';

export async function openSplashWindow() {
    const existing = await WebviewWindow.getByLabel(LABEL);
    if (existing) {
        await existing.unminimize();
        await existing.setFocus();
        return existing;
    }

    const win = new WebviewWindow(LABEL, {
        url: '/splash',
        title: 'glimmerSplash',
        width: 671,
        height: 329,
        maximizable: false,
        decorations: false,
        transparent: false,
        shadow: false,
        center: true,
        resizable: false,
    });

    return new Promise<WebviewWindow>((resolve, reject) => {
        win.once('tauri://created', () => resolve(win));
        win.once('tauri://error', (e) => reject(e));
    });
}
