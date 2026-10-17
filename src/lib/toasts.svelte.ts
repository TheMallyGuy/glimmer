import { ToastQueue, type Toast } from '$ts/glimmer/toast';

/** show a message from anywhere: `toast.success('Saved')`, `toast.error('…')`, `toast.show('…', { action })` */
export const toast = new ToastQueue();

/** the toasts on screen, for the host component to draw */
export const toasts = $state({ items: [] as Toast[] });

toast.subscribe((items) => {
  toasts.items = items;
});
