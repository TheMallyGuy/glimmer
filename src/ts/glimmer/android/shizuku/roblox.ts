import { ROBLOX_PACKAGE } from "../setup";
import { Shizuku } from "./shizukuCom";

export const ANDROID_LOGS_DIR = "/sdcard/Android/data/com.mally.glimmer/files/logs";

/** how many log files stay in that folder; the watcher only follows the newest few anyway */
const KEPT_LOGS = 5;

export type RobloxShizuku = Pick<Shizuku, "executeAdb" | "listPackages">;

function checkPackage(pkg: string) {
  if (!/^[A-Za-z0-9_.]+$/.test(pkg)) throw new Error(`not a package name: ${pkg}`);
}

export function shellQuote(text: string): string {
  return `'${text.replaceAll("'", `'\\''`)}'`;
}

/**
 * Shell script that makes logcat write what Roblox logs into a new file of the log folder. The file is named like
 * the player logs of desktop, so the existing log watcher follows it. `-v raw` leaves only the message, which is
 * the same text a desktop log line has. The logcat before it, if any, is stopped.
 */
export function loggingScript(dir = ANDROID_LOGS_DIR): string {
  return [
    `D=${dir}`,
    'mkdir -p "$D" || exit 2',
    'if [ -f "$D/logcat.pid" ]; then kill "$(cat "$D/logcat.pid")" 2>/dev/null; fi',
    `ls -t "$D"/*_Player_*.log 2>/dev/null | tail -n +${KEPT_LOGS} | while read -r f; do rm -f "$f"; done`,
    "S=$(date '+%m-%d %H:%M:%S.000')",
    'F="$D/$(date +%Y%m%d_%H%M%S)_Player_logcat.log"',
    '(setsid logcat -v raw -s Roblox:I -T "$S" -f "$F" </dev/null >/dev/null 2>&1 & echo $! > "$D/logcat.pid")',
    "",
  ].join("\n");
}

export class AndroidRoblox {
  constructor(private readonly shizuku: RobloxShizuku = new Shizuku()) { }

  /** the Roblox app on the phone: the global one first, then the VNG one; null when neither is installed */
  async installedPackage(): Promise<string | null> {
    const packages = await this.shizuku.listPackages({ includeSystem: false, limit: 10000 });
    return ROBLOX_PACKAGE.find((p) => packages.includes(p)) ?? null;
  }

  /** starts logcat into the log folder (see loggingScript); call it before `start` so no line is missed */
  async startLogging() {
    const result = await this.shizuku.executeAdb(loggingScript());
    if (result.exitCode !== 0) throw new Error(result.stderr.trim() || "could not start the log");
  }

  /** opens the app, as pressing its icon does; with a link, restarts it on that link (a running Roblox ignores new links) */
  async start(pkg: string, deeplink?: string) {
    checkPackage(pkg);

    const result = await this.shizuku.executeAdb(
      deeplink
        ? `am force-stop ${pkg} && am start -a android.intent.action.VIEW -p ${pkg} -d ${shellQuote(deeplink)} 2>&1\n`
        : `am start -n "$(cmd package resolve-activity --brief -c android.intent.category.LAUNCHER ${pkg} | tail -n 1)" 2>&1\n`,
    );

    // am start prints "Error: ..." and still exits 0 when there is nothing to start
    if (result.exitCode !== 0 || /^Error/m.test(result.stdout)) {
      throw new Error(result.stdout.trim() || result.stderr.trim() || "could not start Roblox");
    }
  }
}
