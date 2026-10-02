import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { goto } from '$app/navigation';

const LABEL = 'splash';

export async function openSplashWindow(target = 'player') {
    if (!isTauri()) return goto(`/splash?target=${encodeURIComponent(target)}`);

    const existing = await WebviewWindow.getByLabel(LABEL);
    if (existing) {
        await existing.unminimize();
        await existing.setFocus();
        return existing;
    }

    const win = new WebviewWindow(LABEL, {
        url: `/splash?target=${encodeURIComponent(target)}`,
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
