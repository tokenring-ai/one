import { afterEach, describe, expect, it } from "bun:test";
import { RpcConnectionClosedError } from "@tokenring-ai/web-host/createWsRPCClient";
import { getSharedStreamSnapshot, refreshSharedStream, resetSharedStreams, subscribeSharedStream } from "./sharedStreamStore.ts";

afterEach(() => {
  resetSharedStreams();
});

/** A stream we can push into, and that records how many times it was subscribed. */
function controllable<T>() {
  let push: ((value: T) => void) | null = null;
  let close: (() => void) | null = null;
  const state = { subscribeCount: 0, abortCount: 0 };

  async function* subscribe(signal: AbortSignal): AsyncGenerator<T> {
    state.subscribeCount += 1;
    const queue: T[] = [];
    let wake: (() => void) | null = null;
    let done = false;
    push = value => {
      queue.push(value);
      wake?.();
    };
    close = () => {
      done = true;
      wake?.();
    };
    signal.addEventListener("abort", () => {
      state.abortCount += 1;
      done = true;
      wake?.();
    });
    while (!done) {
      while (queue.length > 0) yield queue.shift()!;
      if (done) break;
      await new Promise<void>(resolve => {
        wake = resolve;
      });
    }
  }

  return { subscribe, state, push: (value: T) => push?.(value), close: () => close?.() };
}

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

describe("sharedStreamStore", () => {
  it("runs one subscription for many subscribers of the same key", async () => {
    const stream = controllable<number>();
    const seen: number[] = [];
    const a = subscribeSharedStream("nums", { subscribe: stream.subscribe }, () => seen.push(1));
    const b = subscribeSharedStream("nums", { subscribe: stream.subscribe }, () => seen.push(2));
    const c = subscribeSharedStream("nums", { subscribe: stream.subscribe }, () => seen.push(3));
    await tick();

    // The whole point: three consumers, one backend subscription.
    expect(stream.state.subscribeCount).toBe(1);

    stream.push(7);
    await tick();
    expect(getSharedStreamSnapshot<number>("nums").data).toBe(7);
    // Every subscriber was notified.
    expect(new Set(seen)).toEqual(new Set([1, 2, 3]));

    a();
    b();
    expect(stream.state.abortCount).toBe(0);
    c();
    // Torn down only once the last subscriber leaves.
    expect(stream.state.abortCount).toBe(1);
  });

  it("keeps separate keys separate", async () => {
    const one = controllable<string>();
    const two = controllable<string>();
    const unsubOne = subscribeSharedStream("one", { subscribe: one.subscribe }, () => {});
    const unsubTwo = subscribeSharedStream("two", { subscribe: two.subscribe }, () => {});
    await tick();
    one.push("a");
    two.push("b");
    await tick();
    expect(getSharedStreamSnapshot<string>("one").data).toBe("a");
    expect(getSharedStreamSnapshot<string>("two").data).toBe("b");
    unsubOne();
    unsubTwo();
  });

  it("returns a referentially stable snapshot until the data changes", async () => {
    const stream = controllable<number>();
    const unsub = subscribeSharedStream("stable", { subscribe: stream.subscribe }, () => {});
    await tick();
    const first = getSharedStreamSnapshot<number>("stable");
    expect(getSharedStreamSnapshot<number>("stable")).toBe(first);
    stream.push(1);
    await tick();
    // useSyncExternalStore loops forever if the snapshot identity churns.
    expect(getSharedStreamSnapshot<number>("stable")).not.toBe(first);
    const second = getSharedStreamSnapshot<number>("stable");
    expect(getSharedStreamSnapshot<number>("stable")).toBe(second);
    unsub();
  });

  it("folds chunks through reduce and seeds from initialData", async () => {
    const stream = controllable<number>();
    const unsub = subscribeSharedStream<number, number[]>(
      "folded",
      { subscribe: stream.subscribe, initialData: () => [], reduce: (prev, chunk) => [...(prev ?? []), chunk] },
      () => {},
    );
    expect(getSharedStreamSnapshot<number[]>("folded").data).toEqual([]);
    await tick();
    stream.push(1);
    stream.push(2);
    await tick();
    expect(getSharedStreamSnapshot<number[]>("folded").data).toEqual([1, 2]);
    unsub();
  });

  it("restarts the stream on refresh and resolves with the next chunk", async () => {
    const stream = controllable<number>();
    const unsub = subscribeSharedStream("refreshed", { subscribe: stream.subscribe }, () => {});
    await tick();
    expect(stream.state.subscribeCount).toBe(1);

    const pending = refreshSharedStream<number>("refreshed");
    await tick();
    expect(stream.state.subscribeCount).toBe(2);
    stream.push(42);
    await expect(pending).resolves.toBe(42);
    unsub();
  });

  it("re-seeds rather than resurrecting a stale snapshot after the last subscriber leaves", async () => {
    const stream = controllable<number>();
    const unsub = subscribeSharedStream("cycled", { subscribe: stream.subscribe }, () => {});
    await tick();
    stream.push(5);
    await tick();
    expect(getSharedStreamSnapshot<number>("cycled").data).toBe(5);
    unsub();
    // A later mount must not read data from a stream that is no longer running.
    expect(getSharedStreamSnapshot<number>("cycled").data).toBeUndefined();
  });

  it("stops without reconnecting when shouldStop fires", async () => {
    const stream = controllable<{ status: string }>();
    const unsub = subscribeSharedStream<{ status: string }, { status: string }>(
      "stops",
      { subscribe: stream.subscribe, shouldStop: chunk => chunk.status === "gone" },
      () => {},
    );
    await tick();
    stream.push({ status: "gone" });
    await tick();
    expect(getSharedStreamSnapshot<{ status: string }>("stops").data).toEqual({ status: "gone" });
    stream.close();
    await tick();
    // A terminal chunk must not trigger a resubscribe.
    expect(stream.state.subscribeCount).toBe(1);
    unsub();
  });

  it("reports a stream error and keeps the last data", async () => {
    let attempt = 0;
    const unsub = subscribeSharedStream<number, number>(
      "erroring",
      {
        // biome-ignore-start lint/correctness/useYield: generator intentionally throws before its first yield
        // eslint-disable-next-line require-yield
        subscribe: async function* () {
          attempt += 1;
          throw new Error("boom");
        },
        // biome-ignore-end lint/correctness/useYield: generator intentionally throws before its first yield
        reconnect: false,
      },
      () => {},
    );
    await tick();
    expect(attempt).toBe(1);
    expect(getSharedStreamSnapshot<number>("erroring").error).toContain("boom");
    unsub();
  });

  it("retries a dropped socket at once without showing an error, keeping the data", async () => {
    let attempt = 0;
    const seen: (string | null)[] = [];
    const unsub = subscribeSharedStream<number, number>(
      "dropped",
      {
        subscribe: async function* () {
          attempt += 1;
          yield attempt;
          // The first connection drops (back/forward cache, server restart); the retry stays up.
          if (attempt === 1) throw new RpcConnectionClosedError();
          await new Promise(() => {});
        },
        reconnectOptions: { initialDelay: 60_000 },
      },
      () => seen.push(getSharedStreamSnapshot<number>("dropped").error),
    );
    await tick();
    await tick();
    expect(attempt).toBe(2);
    expect(seen.every(error => error === null)).toBe(true);
    expect(getSharedStreamSnapshot<number>("dropped").data).toBe(2);
    unsub();
  });

  it("shows the error when the socket drops again before any data arrives", async () => {
    let attempt = 0;
    const unsub = subscribeSharedStream<number, number>(
      "down",
      {
        // biome-ignore-start lint/correctness/useYield: generator intentionally throws before its first yield
        // eslint-disable-next-line require-yield
        subscribe: async function* () {
          attempt += 1;
          throw new RpcConnectionClosedError();
        },
        // biome-ignore-end lint/correctness/useYield: generator intentionally throws before its first yield
        reconnectOptions: { initialDelay: 60_000 },
      },
      () => {},
    );
    await tick();
    await tick();
    expect(attempt).toBe(2);
    expect(getSharedStreamSnapshot<number>("down").error).toContain("WebSocket closed");
    unsub();
  });
});
