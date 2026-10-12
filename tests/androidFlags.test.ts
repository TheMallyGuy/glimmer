import { describe, expect, test } from "bun:test";
import {
    ANDROID_FLAGS_PATH,
    AndroidFlags,
    AndroidFlagsError,
    MAX_FLAGS_CHARS,
    READ_SCRIPT,
    writeScript,
} from "$ts/glimmer/android/flags";

type Result = { exitCode: number; stdout: string; stderr: string; durationMs: number };
const ok = (stdout = ""): Result => ({ exitCode: 0, stdout, stderr: "", durationMs: 1 });

function fake(result: Result = ok()) {
    const commands: string[] = [];
    return {
        commands,
        shizuku: {
            executeAdb: async (command: string) => {
                commands.push(command);
                return result;
            },
        },
    };
}

describe("writeScript", () => {
    test("writes beside the file, then moves over it", () => {
        const script = writeScript('{"FFlagA":"True"}');
        const lines = script.split("\n");
        expect(lines[0]).toBe(`rm -f ${ANDROID_FLAGS_PATH}.new`);
        expect(lines[1]).toBe(`cat > ${ANDROID_FLAGS_PATH}.new <<'GLIMMER_FLAGS_END' || exit 2`);
        expect(lines[2]).toBe('{"FFlagA":"True"}');
        expect(lines[3]).toBe("GLIMMER_FLAGS_END");
        expect(script).toContain(`mv -f ${ANDROID_FLAGS_PATH}.new ${ANDROID_FLAGS_PATH}`);
        expect(script).toContain(`chmod 0644 ${ANDROID_FLAGS_PATH}`);
    });

    test("a flag value that looks like the delimiter stays inside the one JSON line", () => {
        const json = JSON.stringify({ FStringX: "GLIMMER_FLAGS_END" });
        expect(json.includes("\n")).toBe(false);
        expect(writeScript(json).split("\n").filter((l) => l === "GLIMMER_FLAGS_END")).toHaveLength(1);
    });
});

describe("AndroidFlags.write", () => {
    test("sends the flags as one JSON line", async () => {
        const { shizuku, commands } = fake();
        await new AndroidFlags(shizuku).write({ FFlagA: "True", DFIntB: "5" });
        expect(commands).toHaveLength(1);
        expect(commands[0]).toContain('{"FFlagA":"True","DFIntB":"5"}');
    });

    test("fails with the shell's message when the script fails", async () => {
        const { shizuku } = fake({ exitCode: 2, stdout: "", stderr: "Permission denied\n", durationMs: 1 });
        const error = await new AndroidFlags(shizuku).write({ FFlagA: "True" }).catch((e) => e);
        expect(error).toBeInstanceOf(AndroidFlagsError);
        expect(error.kind).toBe("failed");
        expect(error.message).toBe("Permission denied");
    });

    test("refuses flags too large for one command, and sends nothing", async () => {
        const { shizuku, commands } = fake();
        const error = await new AndroidFlags(shizuku).write({ FStringBig: "x".repeat(MAX_FLAGS_CHARS) }).catch((e) => e);
        expect(error.kind).toBe("tooLarge");
        expect(commands).toHaveLength(0);
    });
});

describe("AndroidFlags.read", () => {
    test("parses the file", async () => {
        const { shizuku, commands } = fake(ok('{"FFlagA":"True","DFIntB":5}'));
        const flags = await new AndroidFlags(shizuku).read();
        expect(commands[0]).toBe(READ_SCRIPT);
        expect(flags.map((f) => [f.name, f.value])).toEqual([["FFlagA", "True"], ["DFIntB", "5"]]);
    });

    test("is empty when the file is not there", async () => {
        expect(await new AndroidFlags(fake(ok("")).shizuku).read()).toEqual([]);
        expect(await new AndroidFlags(fake(ok("\n")).shizuku).read()).toEqual([]);
    });

    test("throws when the file is not a flag object", async () => {
        await expect(new AndroidFlags(fake(ok("[1,2]")).shizuku).read()).rejects.toThrow();
        await expect(new AndroidFlags(fake(ok("not json")).shizuku).read()).rejects.toThrow();
    });

    test("fails when the command fails", async () => {
        const { shizuku } = fake({ exitCode: 1, stdout: "", stderr: "", durationMs: 1 });
        const error = await new AndroidFlags(shizuku).read().catch((e) => e);
        expect(error).toBeInstanceOf(AndroidFlagsError);
    });
});
