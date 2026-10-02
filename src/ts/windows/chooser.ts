import { isTauri } from '@tauri-apps/api/core';
import { WebviewWindow } from '@tauri-apps/api/webviewWindow';
import { goto } from '$app/navigation';

const LABEL = 'main';

export async function openChooserWindow() {
    if (!isTauri()) return goto('/choose');

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
