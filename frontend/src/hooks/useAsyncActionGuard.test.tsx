import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useAsyncActionGuard } from "./useAsyncActionGuard.ts";

describe("useAsyncActionGuard", () => {
  it("starts with no active key", () => {
    const { result } = renderHook(() => useAsyncActionGuard());
    expect(result.current.activeKey).toBeNull();
    expect(result.current.isLoading("a")).toBe(false);
  });

  it("sets activeKey while execute runs and clears after", async () => {
    const { result } = renderHook(() => useAsyncActionGuard());
    let resolve!: (value: number) => void;
    const promise = new Promise<number>(r => {
      resolve = r;
    });

    let executePromise!: Promise<number | undefined>;
    act(() => {
      executePromise = result.current.execute("item-1", () => promise);
    });

    expect(result.current.activeKey).toBe("item-1");
    expect(result.current.isLoading("item-1")).toBe(true);
    expect(result.current.isLoading("item-2")).toBe(false);

    await act(async () => {
      resolve(42);
      await executePromise;
    });

    expect(result.current.activeKey).toBeNull();
    await expect(executePromise).resolves.toBe(42);
  });

  it("clears activeKey when the action throws", async () => {
    const { result } = renderHook(() => useAsyncActionGuard());

    await act(async () => {
      await expect(
        result.current.execute("x", async () => {
          throw new Error("fail");
        }),
      ).rejects.toThrow("fail");
    });

    expect(result.current.activeKey).toBeNull();
  });

  it("guards concurrent executions", async () => {
    const { result } = renderHook(() => useAsyncActionGuard());
    let resolveFirst!: () => void;
    const firstPromise = new Promise<string>(r => {
      resolveFirst = () => r("first");
    });
    const secondFn = mock(async () => "second");

    let firstExecute!: Promise<string | undefined>;
    let secondResult: string | undefined;

    await act(async () => {
      firstExecute = result.current.execute("a", () => firstPromise);
      secondResult = await result.current.execute("b", secondFn);
    });

    expect(secondResult).toBeUndefined();
    expect(secondFn).not.toHaveBeenCalled();
    expect(result.current.activeKey).toBe("a");

    await act(async () => {
      resolveFirst();
      await firstExecute;
    });

    expect(result.current.activeKey).toBeNull();
  });

  it("start and stop update activeKey", () => {
    const { result } = renderHook(() => useAsyncActionGuard());

    act(() => {
      result.current.start("manual");
    });
    expect(result.current.activeKey).toBe("manual");
    expect(result.current.isLoading("manual")).toBe(true);

    act(() => {
      result.current.stop();
    });
    expect(result.current.activeKey).toBeNull();
  });
});
