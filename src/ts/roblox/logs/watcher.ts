import { listen, type UnlistenFn } from "@tauri-apps/api/event";

export interface LogLineEvent {
  path: string;
  line: string;
}

export async function watchRobloxLogs(
  onLine: (event: LogLineEvent) => void,
): Promise<UnlistenFn> {
  return listen<LogLineEvent>("roblox-log-line", (event) => {
    onLine(event.payload);
  });
}
