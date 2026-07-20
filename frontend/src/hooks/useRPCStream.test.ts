import { afterEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { useRPCStream } from "./useRPCStream.ts";

afterEach(() => {
  jest.useRealTimers();
});

async function* createGenerator<T>(chunks: T[], signal: AbortSignal, options?: { throwAfter?: number; hangAfterLast?: boolean }) {
  for (let index = 0; index < chunks.length; index++) {
    if (signal.aborted) return;
    if (options?.throwAfter !== undefined && index === options.throwAfter) {
      throw new Error("stream failed");
    }
    yield chunks[index];
  }

  if (options?.hangAfterLast ?? true) {
    await new Promise<void>(resolve => {
      if (signal.aborted) {
        resolve();
        return;
      }
      signal.addEventListener("abort", () => resolve(), { once: true });
    });
  }
}

describe("useRPCStream", () => {
  it("receives stream chunks into data", async () => {
    const { result } = renderHook(() =>
      useRPCStream({
        key: "test",
        subscribe: signal => createGenerator([{ value: 1 }, { value: 2 }], signal),
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 2 });
    });
    expect(result.current.error).toBeNull();
    expect(result.current.isConnecting).toBe(false);
  });

  it("accumulates chunks with reduce", async () => {
    const { result } = renderHook(() =>
      useRPCStream({
        key: "sum",
        subscribe: signal => createGenerator([1, 2, 3], signal),
        reduce: (prev, chunk) => (prev ?? 0) + (chunk ?? 0),
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toBe(6);
    });
  });

  it("does not subscribe when key is null", () => {
    const subscribe = mock((signal: AbortSignal) => createGenerator([{ value: 1 }], signal));

    const { result } = renderHook(() =>
      useRPCStream({
        key: null,
        subscribe,
      }),
    );

    expect(subscribe).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    expect(result.current.isConnecting).toBe(false);
  });

  it("does not subscribe when enabled is false", () => {
    const subscribe = mock((signal: AbortSignal) => createGenerator([{ value: 1 }], signal));

    renderHook(() =>
      useRPCStream({
        key: "disabled",
        enabled: false,
        subscribe,
      }),
    );

    expect(subscribe).not.toHaveBeenCalled();
  });

  it("stops without reconnecting when shouldStop returns true", async () => {
    const subscribe = mock((signal: AbortSignal) => createGenerator([{ stop: true }, { stop: false }], signal));

    const { result } = renderHook(() =>
      useRPCStream({
        key: "stop",
        subscribe,
        shouldStop: chunk => chunk?.stop ?? false,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ stop: true });
    });

    expect(subscribe).toHaveBeenCalledTimes(1);
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it("reconnects after stream errors with backoff", async () => {
    jest.useFakeTimers();

    let attempts = 0;
    const subscribe = mock((signal: AbortSignal) => {
      attempts += 1;
      if (attempts === 1) {
        return createGenerator([{ value: 1 }], signal, { throwAfter: 0, hangAfterLast: false });
      }
      return createGenerator([{ value: 2 }], signal);
    });

    const { result } = renderHook(() =>
      useRPCStream({
        key: "reconnect",
        subscribe,
        reconnectOptions: { initialDelay: 100 },
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(result.current.error).toContain("stream failed");

    await act(async () => {
      jest.advanceTimersByTime(100);
      await Promise.resolve();
    });

    expect(result.current.data).toEqual({ value: 2 });
    expect(result.current.error).toBeNull();
    expect(subscribe).toHaveBeenCalledTimes(2);
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it("aborts the stream on unmount", async () => {
    const abortSignals: AbortSignal[] = [];
    const subscribe = mock((signal: AbortSignal) => {
      abortSignals.push(signal);
      return createGenerator([{ value: 1 }], signal);
    });

    const { unmount } = renderHook(() =>
      useRPCStream({
        key: "abort",
        subscribe,
      }),
    );

    await act(async () => {
      await Promise.resolve();
    });

    expect(abortSignals[0]).toBeDefined();
    expect(abortSignals[0]?.aborted).toBe(false);

    unmount();

    expect(abortSignals[0]?.aborted).toBe(true);
  });

  it("manualReconnect restarts the subscription", async () => {
    const subscribe = mock((signal: AbortSignal) => createGenerator([{ value: 1 }], signal));

    const { result } = renderHook(() =>
      useRPCStream({
        key: "manual",
        subscribe,
      }),
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 1 });
    });

    act(() => {
      result.current.manualReconnect();
    });

    await waitFor(() => {
      expect(subscribe).toHaveBeenCalledTimes(2);
    });
    expect(result.current.error).toBeNull();
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it("resets data when key changes", async () => {
    const { result, rerender } = renderHook(
      ({ streamKey }: { streamKey: string }) =>
        useRPCStream({
          key: streamKey,
          initialData: () => ({ value: 0 }),
          subscribe: signal => createGenerator([{ value: streamKey === "a" ? 1 : 2 }], signal),
          reduce: (_prev, chunk) => chunk ?? { value: 0 },
        }),
      { initialProps: { streamKey: "a" } },
    );

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 1 });
    });

    rerender({ streamKey: "b" });

    await waitFor(() => {
      expect(result.current.data).toEqual({ value: 2 });
    });
  });
});
