import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { type SWRSource, useMultiSourceLoading } from "./useMultiSourceLoading.ts";

function makeSource<T>(partial: Partial<SWRSource<T>> & { data?: T }): SWRSource<T> {
  return {
    data: partial.data,
    isLoading: partial.isLoading ?? false,
    isValidating: partial.isValidating ?? false,
    error: partial.error,
    mutate: partial.mutate ?? mock(async () => partial.data),
  };
}

describe("useMultiSourceLoading", () => {
  it("is not loading when all sources have data or are idle", () => {
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: { a: 1 } }), label: "a" },
        { source: makeSource({ data: { b: 2 } }), label: "b" },
      ]),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.hasHardError).toBe(false);
    expect(result.current.hardError).toBeUndefined();
    expect(result.current.isRefreshing).toBe(false);
    expect(result.current.softErrors.size).toBe(0);
  });

  it("isLoading when any source is loading without cached data", () => {
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: { a: 1 } }), label: "a" },
        { source: makeSource({ isLoading: true }), label: "b" },
      ]),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("does not treat loading as isLoading when cached data exists", () => {
    const { result } = renderHook(() => useMultiSourceLoading([{ source: makeSource({ data: { a: 1 }, isLoading: true, isValidating: true }), label: "a" }]));

    expect(result.current.isLoading).toBe(false);
    expect(result.current.isRefreshing).toBe(true);
  });

  it("hasHardError only for fatal sources without data", () => {
    const fatalErr = new Error("fatal");
    const softErr = new Error("soft");

    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ error: fatalErr }), label: "plugins" },
        { source: makeSource({ error: softErr }), label: "bots", isFatal: false },
      ]),
    );

    expect(result.current.hasHardError).toBe(true);
    expect(result.current.hardError).toBe(fatalErr);
    expect(result.current.softErrors.get("bots")).toBe(softErr);
    expect(result.current.getSourceHardError("plugins")).toBe(fatalErr);
    expect(result.current.getSourceHardError("bots")).toBe(softErr);
    expect(result.current.isSourceHardError("plugins")).toBe(true);
    expect(result.current.isSourceHardError("bots")).toBe(true);
  });

  it("soft-fail errors do not set hasHardError", () => {
    const softErr = new Error("bots down");
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: [] }), label: "plugins" },
        { source: makeSource({ error: softErr }), label: "bots", isFatal: false },
      ]),
    );

    expect(result.current.hasHardError).toBe(false);
    expect(result.current.hardError).toBeUndefined();
    expect(result.current.softErrors.get("bots")).toBe(softErr);
  });

  it("does not keep isLoading true when a soft-fail source is loading with an error", () => {
    const softErr = new Error("bots down");
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: [] }), label: "plugins" },
        { source: makeSource({ isLoading: true, error: softErr }), label: "bots", isFatal: false },
      ]),
    );

    expect(result.current.isLoading).toBe(false);
    expect(result.current.softErrors.get("bots")).toBe(softErr);
  });

  it("still waits on soft-fail sources that are loading without error", () => {
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: [] }), label: "plugins" },
        { source: makeSource({ isLoading: true }), label: "bots", isFatal: false },
      ]),
    );

    expect(result.current.isLoading).toBe(true);
  });

  it("ignores errors when cached data is present", () => {
    const err = new Error("stale");
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: { ok: true }, error: err, isValidating: true }), label: "a" },
        { source: makeSource({ data: { ok: true }, error: err }), label: "b", isFatal: false },
      ]),
    );

    expect(result.current.hasHardError).toBe(false);
    expect(result.current.softErrors.size).toBe(0);
    expect(result.current.getSourceHardError("a")).toBeUndefined();
    expect(result.current.isRefreshing).toBe(true);
  });

  it("isRefreshing when any source is validating", () => {
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ data: 1 }), label: "a" },
        { source: makeSource({ data: 2, isValidating: true }), label: "b" },
      ]),
    );

    expect(result.current.isRefreshing).toBe(true);
  });

  it("refresh mutates all sources and guards while refreshing", () => {
    const mutateA = mock(async () => 1);
    const mutateB = mock(async () => 2);

    const { result, rerender } = renderHook(
      ({ validating }: { validating: boolean }) =>
        useMultiSourceLoading([
          { source: makeSource({ data: 1, isValidating: validating, mutate: mutateA }), label: "a" },
          { source: makeSource({ data: 2, mutate: mutateB }), label: "b" },
        ]),
      { initialProps: { validating: false } },
    );

    act(() => {
      result.current.refresh();
    });
    expect(mutateA).toHaveBeenCalledTimes(1);
    expect(mutateB).toHaveBeenCalledTimes(1);

    rerender({ validating: true });
    act(() => {
      result.current.refresh();
    });
    expect(mutateA).toHaveBeenCalledTimes(1);
    expect(mutateB).toHaveBeenCalledTimes(1);
  });

  it("returns undefined for unknown source labels", () => {
    const { result } = renderHook(() => useMultiSourceLoading([{ source: makeSource({ data: 1 }), label: "a" }]));

    expect(result.current.isSourceHardError("missing")).toBe(false);
    expect(result.current.getSourceHardError("missing")).toBeUndefined();
  });

  it("defaults isFatal to true", () => {
    const err = new Error("fail");
    const { result } = renderHook(() => useMultiSourceLoading([{ source: makeSource({ error: err }), label: "x" }]));

    expect(result.current.hasHardError).toBe(true);
    expect(result.current.hardError).toBe(err);
    expect(result.current.softErrors.size).toBe(0);
  });

  it("soft errors without a label are not added to softErrors map", () => {
    const err = new Error("soft");
    const { result } = renderHook(() => useMultiSourceLoading([{ source: makeSource({ error: err }), isFatal: false }]));

    expect(result.current.hasHardError).toBe(false);
    expect(result.current.softErrors.size).toBe(0);
  });

  it("picks the first hard error among multiple fatal failures", () => {
    const first = new Error("first");
    const second = new Error("second");
    const { result } = renderHook(() =>
      useMultiSourceLoading([
        { source: makeSource({ error: first }), label: "a" },
        { source: makeSource({ error: second }), label: "b" },
      ]),
    );

    expect(result.current.hardError).toBe(first);
  });
});
