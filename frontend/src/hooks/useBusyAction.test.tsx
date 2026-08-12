import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useBusyAction } from "./useBusyAction.ts";

describe("useBusyAction", () => {
  it("starts not busy by default", () => {
    const { result } = renderHook(() => useBusyAction());
    expect(result.current.busy).toBe(false);
  });

  it("accepts initialBusy", () => {
    const { result } = renderHook(() => useBusyAction(true));
    expect(result.current.busy).toBe(true);
  });

  it("sets busy while execute runs and clears after", async () => {
    const { result } = renderHook(() => useBusyAction());
    let resolve!: (value: string) => void;
    const promise = new Promise<string>(r => {
      resolve = r;
    });

    let executePromise!: Promise<string | undefined>;
    act(() => {
      executePromise = result.current.execute(() => promise);
    });
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolve("ok");
      await executePromise;
    });

    expect(result.current.busy).toBe(false);
    await expect(executePromise).resolves.toBe("ok");
  });

  it("clears busy when the action throws", async () => {
    const { result } = renderHook(() => useBusyAction());

    await act(async () => {
      await expect(
        result.current.execute(async () => {
          throw new Error("boom");
        }),
      ).rejects.toThrow("boom");
    });

    expect(result.current.busy).toBe(false);
  });

  it("guards concurrent executions and returns undefined for the second", async () => {
    const { result } = renderHook(() => useBusyAction());
    let resolveFirst!: () => void;
    const firstPromise = new Promise<string>(r => {
      resolveFirst = () => r("first");
    });
    const secondFn = mock(async () => "second");

    let firstExecute!: Promise<string | undefined>;
    let secondResult: string | undefined;

    await act(async () => {
      firstExecute = result.current.execute(() => firstPromise);
      // Second call while first is in flight — sync guard via ref
      secondResult = await result.current.execute(secondFn);
    });

    expect(secondResult).toBeUndefined();
    expect(secondFn).not.toHaveBeenCalled();
    expect(result.current.busy).toBe(true);

    await act(async () => {
      resolveFirst();
      await firstExecute;
    });

    expect(result.current.busy).toBe(false);
    await expect(firstExecute).resolves.toBe("first");
  });

  it("setBusy updates busy state", () => {
    const { result } = renderHook(() => useBusyAction());

    act(() => {
      result.current.setBusy(true);
    });
    expect(result.current.busy).toBe(true);

    act(() => {
      result.current.setBusy(false);
    });
    expect(result.current.busy).toBe(false);
  });

  it("setBusy(true) blocks subsequent execute", async () => {
    const { result } = renderHook(() => useBusyAction());
    const fn = mock(async () => "ran");

    act(() => {
      result.current.setBusy(true);
    });

    let value: string | undefined;
    await act(async () => {
      value = await result.current.execute(fn);
    });

    expect(value).toBeUndefined();
    expect(fn).not.toHaveBeenCalled();
  });
});
