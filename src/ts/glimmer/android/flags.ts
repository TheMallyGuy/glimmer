import { parseFlagsJson, type Flag } from "$lib/flags";
import { Shizuku } from "./shizuku/shizukuCom";

export const ANDROID_FLAGS_PATH = "/data/local/tmp/ClientAppSettings.json";

const DELIMITER = "GLIMMER_FLAGS_END";

/** a command line has a size limit, and the flags travel as one */
export const MAX_FLAGS_CHARS = 100_000;

export class AndroidFlagsError extends Error {
  constructor(
    readonly kind: "tooLarge" | "failed",
    message: string,
  ) {
    super(message);
  }
}

/**
 * The shell script that puts `json` in place: written beside the file first and moved over it, so Roblox never
 * reads half a file. `json` is one line (JSON.stringify without spacing), so it can never equal the delimiter line.
 */
export function writeScript(json: string): string {
  const path = ANDROID_FLAGS_PATH;
  return [
    `rm -f ${path}.new`,
    `cat > ${path}.new <<'${DELIMITER}' || exit 2`,
    json,
    DELIMITER,
    `if cmp -s ${path}.new ${path}; then rm -f ${path}.new; else mv -f ${path}.new ${path} || exit 2; fi`,
    `chmod 0644 ${path} || exit 2`,
    "",
  ].join("\n");
}

/** prints the file when there is one, and nothing when there is not */
export const READ_SCRIPT = `if [ -e ${ANDROID_FLAGS_PATH} ]; then cat ${ANDROID_FLAGS_PATH}; fi\n`;

export class AndroidFlags {
  constructor(private readonly shizuku: Pick<Shizuku, "executeAdb"> = new Shizuku()) { }

  /** the flags Roblox has now; none when the file is not there. Throws when it is not a flag object. */
  async read(): Promise<Flag[]> {
    const result = await this.shizuku.executeAdb(READ_SCRIPT);

    if (result.exitCode !== 0) throw new AndroidFlagsError("failed", result.stderr.trim() || "could not read the flags");

    if (result.stdout.trim() === "") return [];
    return parseFlagsJson(result.stdout);
  }

  /** replaces the flags Roblox reads at its next start */
  async write(flags: Record<string, string>) {
    const json = JSON.stringify(flags);

    if (json.length > MAX_FLAGS_CHARS) throw new AndroidFlagsError("tooLarge", "too many Fast Flags to send at once");

    const result = await this.shizuku.executeAdb(writeScript(json));

    if (result.exitCode !== 0) throw new AndroidFlagsError("failed", result.stderr.trim() || "could not write the flags");
  }
}
