import { describe, expect, test } from "bun:test";
import { watchRobloxExit } from "$ts/glimmer/android/exitWatcher";

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** answers the given states in order, then repeats the last one */
function states(...answers: (boolean | "fail")[]) {
  let i = 0;
  return async () => {
    const a = answers[Math.min(i++, answers.length - 1)];
    if (a === "fail") throw new Error("shizuku");
    return a;
  };
}

describe("watchRobloxExit", () => {
  test("calls onExit once, after Roblox was seen and then is gone", async () => {
    let exits = 0;
    watchRobloxExit(() => exits++, {
      isRunning: states(false, true, true, false),
      intervalMs: 5,
      startupMs: 10_000,
    });
    await wait(80);
    expect(exits).toBe(1);
  });

  test("does not call onExit while Roblox is still starting", async () => {
    let exits = 0;
    const stop = watchRobloxExit(() => exits++, {
      isRunning: states(false),
      intervalMs: 5,
      startupMs: 10_000,
    });
    await wait(40);
    stop();
    expect(exits).toBe(0);
  });

  test("gives up on a Roblox that never showed up, once the startup time is over", async () => {
    let exits = 0;
    watchRobloxExit(() => exits++, { isRunning: states(false), intervalMs: 5, startupMs: 20 });
    await wait(80);
    expect(exits).toBe(1);
  });

  test("a failed question is not an exit", async () => {
    let exits = 0;
    const stop = watchRobloxExit(() => exits++, {
      isRunning: states(true, "fail", "fail", true),
      intervalMs: 5,
    });
    await wait(40);
    stop();
    expect(exits).toBe(0);
  });

  test("stops when asked", async () => {
    let exits = 0;
    const stop = watchRobloxExit(() => exits++, { isRunning: states(true, false), intervalMs: 20 });
    stop();
    await wait(60);
    expect(exits).toBe(0);
  });
});
