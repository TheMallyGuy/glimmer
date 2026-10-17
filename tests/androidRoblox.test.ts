import { describe, expect, test } from "bun:test";
import { ANDROID_LOGS_DIR, AndroidRoblox, loggingScript, shellQuote } from "$ts/glimmer/android/shizuku/roblox";

const result = (stdout: string, exitCode = 0, stderr = "") => ({ exitCode, stdout, stderr, durationMs: 1 });
const quiet = { executeAdb: async () => result(""), listPackages: async () => [] as string[] };

describe("loggingScript", () => {
    const script = loggingScript();

    test("writes a player log of the folder the watcher follows, with just the message of each line", () => {
        expect(script).toContain(`D=${ANDROID_LOGS_DIR}`);
        expect(script).toContain("_Player_logcat.log");
        expect(script).toContain("logcat -v raw -s Roblox:I");
    });

    test("starts from now, so an old log is not read again", () => {
        expect(script).toContain("S=$(date '+%m-%d %H:%M:%S.000')");
        expect(script).toContain('-T "$S"');
    });

    test("detaches logcat and stops the one from the launch before", () => {
        expect(script).toContain("setsid logcat");
        expect(script).toContain("</dev/null >/dev/null 2>&1 &");
        expect(script).toContain('kill "$(cat "$D/logcat.pid")"');
        expect(script).toContain('echo $! > "$D/logcat.pid"');
    });

    test("keeps only the newest few logs", () => {
        expect(script).toContain("tail -n +5");
        expect(script).toContain("rm -f");
    });
});

describe("the log folder", () => {
    test("is inside Glimmer's own folder on shared storage", () => {
        expect(ANDROID_LOGS_DIR.startsWith("/sdcard/Android/data/com.mally.glimmer/")).toBe(true);
    });
});

describe("AndroidRoblox", () => {
    test("installedPackage prefers the global app, then the VNG one", async () => {
        const both = new AndroidRoblox({ ...quiet, listPackages: async () => ["com.roblox.client.vnggames", "com.roblox.client"] });
        expect(await both.installedPackage()).toBe("com.roblox.client");
        const vng = new AndroidRoblox({ ...quiet, listPackages: async () => ["com.roblox.client.vnggames"] });
        expect(await vng.installedPackage()).toBe("com.roblox.client.vnggames");
        const none = new AndroidRoblox({ ...quiet, listPackages: async () => ["a.b"] });
        expect(await none.installedPackage()).toBeNull();
    });

    test("startLogging runs the logging script", async () => {
        let script = "";
        await new AndroidRoblox({ ...quiet, executeAdb: async (c: string) => { script = c; return result(""); } }).startLogging();
        expect(script).toBe(loggingScript());
    });

    test("startLogging fails with the shell's message", async () => {
        const roblox = new AndroidRoblox({ ...quiet, executeAdb: async () => result("", 2, "Permission denied\n") });
        await expect(roblox.startLogging()).rejects.toThrow("Permission denied");
    });

    test("start runs am start on the launcher activity", async () => {
        let script = "";
        const roblox = new AndroidRoblox({
            ...quiet,
            executeAdb: async (c: string) => {
                script = c;
                return result("Starting: Intent { cmp=x/y }\n");
            },
        });
        await roblox.start("com.roblox.client");
        expect(script).toContain("am start -n");
        expect(script).toContain("resolve-activity --brief -c android.intent.category.LAUNCHER com.roblox.client");
    });

    test("start fails on an am error that still exits 0", async () => {
        const roblox = new AndroidRoblox({ ...quiet, executeAdb: async () => result("Error: Activity class does not exist.\n") });
        await expect(roblox.start("com.roblox.client")).rejects.toThrow("Error: Activity class does not exist.");
    });

    test("start with a link restarts Roblox on that link", async () => {
        let script = "";
        const roblox = new AndroidRoblox({
            ...quiet,
            executeAdb: async (c: string) => {
                script = c;
                return result("Starting: Intent { dat=roblox://placeId=1818 }\n");
            },
        });
        await roblox.start("com.roblox.client.vnggames", "roblox://placeId=1818&launchData=a");
        expect(script).not.toContain("adb shell");
        expect(script).toContain("am force-stop com.roblox.client.vnggames && am start -a android.intent.action.VIEW -p com.roblox.client.vnggames");
        expect(script).toContain("-d 'roblox://placeId=1818&launchData=a'");
    });

    test("start refuses a package name that is not one", async () => {
        await expect(new AndroidRoblox(quiet).start("a; rm -rf /")).rejects.toThrow("not a package name");
    });
});

describe("shellQuote", () => {
    test("keeps a quote in the text from ending the shell word", () => {
        expect(shellQuote("a'; rm -rf /; echo '")).toBe(`'a'\\''; rm -rf /; echo '\\'''`);
        expect(shellQuote("roblox://placeId=1&x=$(id)")).toBe("'roblox://placeId=1&x=$(id)'");
    });

    test("the shell reads it back as the same text", async () => {
        const text = "roblox://placeId=1'; echo hacked; '&x=$(id)";
        const out = Bun.spawnSync(["sh", "-c", `printf %s ${shellQuote(text)}`]).stdout.toString();
        expect(out).toBe(text);
    });
});
