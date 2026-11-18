import { afterEach, describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import { resetSharedStreams } from "./sharedStreamStore.ts";
import { useRPCStreamSWR } from "./useRPCStreamSWR.ts";

afterEach(() => {
  resetSharedStreams();
});

/** A stream that never yields, so only the seed can be visible. */
async function* pending(signal: AbortSignal): AsyncGenerator<number[]> {
  await new Promise<void>(resolve => signal.addEventListener("abort", () => resolve(), { once: true }));
  yield* [];
}

describe("useRPCStreamSWR initialData", () => {
  it("exposes initialData on the very first render, before the store is subscribed", () => {
    const renders: Array<number[] | undefined> = [];
    renderHook(() => {
      const result = useRPCStreamSWR<number[]>({ key: "seeded", subscribe: pending, initialData: [1, 2] });
      renders.push(result.data);
      return result;
    });
    expect(renders[0]).toEqual([1, 2]);
    expect(renders.at(-1)).toEqual([1, 2]);
  });

  it("resolves a lazy initialData once per key", () => {
    let calls = 0;
    const { result, rerender } = renderHook(() =>
      useRPCStreamSWR<number[]>({
        key: "lazy",
        subscribe: pending,
        initialData: () => {
          calls += 1;
          return [3];
        },
      }),
    );
    rerender();
    expect(result.current.data).toEqual([3]);
    // One for the hook's seed, one for the store entry the first subscriber creates.
    expect(calls).toBeLessThanOrEqual(2);
  });

  it("returns no data while disabled", () => {
    const { result } = renderHook(() => useRPCStreamSWR<number[]>({ key: "off", enabled: false, subscribe: pending, initialData: [1] }));
    expect(result.current.data).toBeUndefined();
  });
});
