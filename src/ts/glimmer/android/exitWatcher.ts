import { ROBLOX_PACKAGE } from "./setup";
import { Shizuku } from "./shizuku/shizukuCom";

export interface ExitWatcherOptions {
  /** asks the phone whether a Roblox app runs */
  isRunning?: () => Promise<boolean>;
  intervalMs?: number;
  /** how long Roblox has to show up after the launch before the watch gives up */
  startupMs?: number;
}

function shellIsRunning(shizuku = new Shizuku()) {
  return async () => {
    const result = await shizuku.executeAdb(`pidof ${ROBLOX_PACKAGE.join(" ")} >/dev/null && echo 1 || echo 0\n`);
    return result.stdout.trim() === "1";
  };
}


export function watchRobloxExit(onExit: () => void, options: ExitWatcherOptions = {}): () => void {
  const { isRunning = shellIsRunning(), intervalMs = 3000, startupMs = 60000 } = options;
  const startedAt = Date.now();
  let seen = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout>;

  const poll = async () => {
    if (stopped) return;
    const running = await isRunning().catch(() => null);
    if (stopped) return;
    if (running) seen = true;
    if (running === false && (seen || Date.now() - startedAt > startupMs)) {
      stopped = true;
      onExit();
      return;
    }
    timer = setTimeout(poll, intervalMs);
  };

  timer = setTimeout(poll, intervalMs);
  return () => {
    stopped = true;
    clearTimeout(timer);
  };
}
