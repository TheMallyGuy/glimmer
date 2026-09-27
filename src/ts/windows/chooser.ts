import { WebviewWindow } from '@tauri-apps/api/webviewWindow';

const LABEL = 'main';

export async function openChooserWindow() {
    const existing = await WebviewWindow.getByLabel(LABEL);
    if (existing) {
        await existing.unminimize();
        await existing.setFocus();
        return existing;
    }

    const win = new WebviewWindow(LABEL, {
        url: '/choose',
        title: 'glimmer',
        width: 562,
        height: 322,
        maximizable: false,
        decorations: false,
        center: true,
        resizable: false,
    });

    return new Promise<WebviewWindow>((resolve, reject) => {
        win.once('tauri://created', () => resolve(win));
        win.once('tauri://error', (e) => reject(e));
    });
}
