import { beforeEach, describe, expect, test } from "bun:test";
import { ToastQueue, type Toast } from "$ts/glimmer/toast";

/** a clock and timers that only move when the test says so */
class FakeClock {
  time = 0;
  private timers = new Map<number, { at: number; run: () => void }>();
  private next = 1;

  now = () => this.time;
  setTimer = (run: () => void, ms: number) => {
    const id = this.next++;
    this.timers.set(id, { at: this.time + ms, run });
    return id;
  };
  clearTimer = (id: unknown) => void this.timers.delete(id as number);

  advance(ms: number) {
    this.time += ms;
    for (const [id, t] of [...this.timers]) {
      if (t.at <= this.time) {
        this.timers.delete(id);
        t.run();
      }
    }
  }

  get pending() {
    return this.timers.size;
  }
}

let clock: FakeClock;
const queue = (max = 4) => new ToastQueue(max, clock.now, clock.setTimer, clock.clearTimer);
const messages = (q: ToastQueue) => q.items.map((t) => t.message);

beforeEach(() => {
  clock = new FakeClock();
});

describe("ToastQueue.show", () => {
  test("adds toasts newest last, each with its own id", () => {
    const q = queue();

    const a = q.show("first");
    const b = q.show("second");

    expect(messages(q)).toEqual(["first", "second"]);
    expect(a).not.toBe(b);
  });

  test("info, success and error set the kind", () => {
    const q = queue();
    q.info("i");
    q.success("s");
    q.error("e");

    expect(q.items.map((t) => t.kind)).toEqual(["info", "success", "error"]);
  });

  test("carries one action", () => {
    const q = queue();
    let undone = 0;

    q.show("Deleted", { action: { label: "Undo", run: () => void undone++ } });
    q.items[0].action!.run();

    expect(q.items[0].action!.label).toBe("Undo");
    expect(undone).toBe(1);
  });

  test("keeps only the newest few", () => {
    const q = queue(3);

    for (const m of ["a", "b", "c", "d", "e"]) q.show(m);

    expect(messages(q)).toEqual(["c", "d", "e"]);
  });
});

describe("going away by themselves", () => {
  test("info and success after 4 seconds, errors after 8", () => {
    const q = queue();
    q.info("i");
    q.error("e");

    clock.advance(3999);
    expect(messages(q)).toEqual(["i", "e"]);
    clock.advance(1);
    expect(messages(q)).toEqual(["e"]);
    clock.advance(4000);
    expect(messages(q)).toEqual([]);
  });

  test("a duration of 0 keeps the toast until it is dismissed", () => {
    const q = queue();
    const id = q.show("stay", { duration: 0 });

    clock.advance(60_000);
    expect(messages(q)).toEqual(["stay"]);

    q.dismiss(id);
    expect(messages(q)).toEqual([]);
  });

  test("a custom duration is used", () => {
    const q = queue();
    q.show("short", { duration: 500 });

    clock.advance(500);

    expect(messages(q)).toEqual([]);
  });

  test("dismissing early leaves no timer behind", () => {
    const q = queue();
    const id = q.info("x");

    q.dismiss(id);

    expect(clock.pending).toBe(0);
  });
});

describe("pause and resume", () => {
  test("a paused toast stays, and resumes with the time that was left", () => {
    const q = queue();
    const id = q.info("read me", { duration: 4000 });

    clock.advance(3000);
    q.pause(id);
    clock.advance(60_000);
    expect(messages(q)).toEqual(["read me"]);

    q.resume(id);
    clock.advance(999);
    expect(messages(q)).toEqual(["read me"]);
    clock.advance(1);
    expect(messages(q)).toEqual([]);
  });

  test("pausing twice or resuming a running toast changes nothing", () => {
    const q = queue();
    const id = q.info("x", { duration: 1000 });

    q.resume(id);
    q.pause(id);
    q.pause(id);
    q.resume(id);
    clock.advance(1000);

    expect(messages(q)).toEqual([]);
  });
});

describe("dismiss and clear", () => {
  test("dismiss removes one toast and ignores an unknown id", () => {
    const q = queue();
    const a = q.show("a", { duration: 0 });
    q.show("b", { duration: 0 });

    q.dismiss(a);
    q.dismiss(999);

    expect(messages(q)).toEqual(["b"]);
  });

  test("clear removes everything and stops every timer", () => {
    const q = queue();
    q.info("a");
    q.error("b");

    q.clear();

    expect(q.items).toEqual([]);
    expect(clock.pending).toBe(0);
  });
});

describe("subscribe", () => {
  test("is called at once and after every change, until it stops", () => {
    const q = queue();
    const seen: string[][] = [];

    const stop = q.subscribe((toasts: Toast[]) => seen.push(toasts.map((t) => t.message)));
    const id = q.show("a", { duration: 0 });
    q.dismiss(id);
    stop();
    q.show("b");

    expect(seen).toEqual([[], ["a"], []]);
  });

  test("is told when a toast times out", () => {
    const q = queue();
    const seen: number[] = [];
    q.subscribe((toasts) => seen.push(toasts.length));

    q.info("a");
    clock.advance(4000);

    expect(seen).toEqual([0, 1, 0]);
  });
});
