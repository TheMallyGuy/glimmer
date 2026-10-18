export type ToastKind = "info" | "success" | "error";

export interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** one button on the toast, e.g. "Undo" */
  action?: { label: string; run: () => void };
}

export interface ToastOptions {
  kind?: ToastKind;
  /** milliseconds before it goes away by itself, or 0 to keep it until it is dismissed */
  duration?: number;
  action?: Toast["action"];
}

/** how long each kind stays: errors get longer, since they usually need reading twice */
const DURATIONS: Record<ToastKind, number> = { info: 4000, success: 4000, error: 8000 };

interface Timer {
  handle: unknown;
  startedAt: number;
  remaining: number;
}

/**
 * The toasts on screen, newest last. Each goes away by itself after a while; `pause` and `resume`
 * stop and restart that clock (for hovering or focusing a toast, so it can be read), and only the
 * newest few are kept, so a burst of messages can't bury the window.
 */
export class ToastQueue {
  private toasts: Toast[] = [];
  private readonly timers = new Map<number, Timer>();
  private readonly listeners = new Set<(toasts: Toast[]) => void>();
  private nextId = 1;

  constructor(
    private readonly max = 4,
    private readonly now: () => number = Date.now,
    private readonly setTimer: (run: () => void, ms: number) => unknown = (run, ms) =>
      setTimeout(run, ms),
    private readonly clearTimer: (handle: unknown) => void = (handle) =>
      clearTimeout(handle as number),
  ) {}

  get items(): readonly Toast[] {
    return this.toasts;
  }

  /** shows a message and returns the toast's id */
  show(message: string, options: ToastOptions = {}): number {
    const kind = options.kind ?? "info";
    const toast: Toast = { id: this.nextId++, kind, message, action: options.action };
    this.toasts = [...this.toasts, toast];

    const duration = options.duration ?? DURATIONS[kind];
    if (duration > 0) this.start(toast.id, duration);

    // keep only the newest ones
    for (const old of this.toasts.slice(0, Math.max(0, this.toasts.length - this.max)))
      this.dismiss(old.id);

    this.emit();
    return toast.id;
  }

  info = (message: string, options: Omit<ToastOptions, "kind"> = {}) =>
    this.show(message, { ...options, kind: "info" });
  success = (message: string, options: Omit<ToastOptions, "kind"> = {}) =>
    this.show(message, { ...options, kind: "success" });
  error = (message: string, options: Omit<ToastOptions, "kind"> = {}) =>
    this.show(message, { ...options, kind: "error" });

  dismiss(id: number) {
    this.stop(id);
    const before = this.toasts.length;
    this.toasts = this.toasts.filter((t) => t.id !== id);
    if (this.toasts.length !== before) this.emit();
  }

  clear() {
    for (const id of [...this.timers.keys()]) this.stop(id);
    this.toasts = [];
    this.emit();
  }

  /** stops the clock of a toast that is being read */
  pause(id: number) {
    const timer = this.timers.get(id);
    if (!timer) return;

    this.clearTimer(timer.handle);
    timer.remaining -= this.now() - timer.startedAt;
    timer.handle = null;
  }

  /** starts the clock again with the time that was left */
  resume(id: number) {
    const timer = this.timers.get(id);
    if (!timer || timer.handle !== null) return;

    this.start(id, timer.remaining);
  }

  /** calls `listener` now and after every change, with the toasts on screen. Returns a function that stops listening. */
  subscribe(listener: (toasts: Toast[]) => void): () => void {
    this.listeners.add(listener);
    listener(this.toasts);
    return () => this.listeners.delete(listener);
  }

  private start(id: number, ms: number) {
    const handle = this.setTimer(() => this.dismiss(id), ms);
    this.timers.set(id, { handle, startedAt: this.now(), remaining: ms });
  }

  private stop(id: number) {
    const timer = this.timers.get(id);
    if (!timer) return;

    if (timer.handle !== null) this.clearTimer(timer.handle);
    this.timers.delete(id);
  }

  private emit() {
    for (const listener of this.listeners) listener(this.toasts);
  }
}
