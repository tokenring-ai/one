import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useRefSync } from "./useRefSync.ts";

describe("useRefSync", () => {
  it("initializes the ref with the first value", () => {
    const { result } = renderHook(() => useRefSync("initial"));
    expect(result.current.current).toBe("initial");
  });

  it("updates the ref during render when the value changes", () => {
    const { result, rerender } = renderHook(({ value }) => useRefSync(value), {
      initialProps: { value: "a" },
    });
    expect(result.current.current).toBe("a");

    rerender({ value: "b" });
    expect(result.current.current).toBe("b");
  });

  it("returns a stable ref object across re-renders", () => {
    const { result, rerender } = renderHook(({ value }) => useRefSync(value), {
      initialProps: { value: 1 },
    });
    const first = result.current;

    rerender({ value: 2 });
    expect(result.current).toBe(first);
    expect(result.current.current).toBe(2);
  });

  it("tracks object and null values", () => {
    const objA = { n: 1 };
    const objB = { n: 2 };
    const { result, rerender } = renderHook(({ value }: { value: { n: number } | null }) => useRefSync(value), {
      initialProps: { value: objA as { n: number } | null },
    });
    expect(result.current.current).toBe(objA);

    rerender({ value: objB });
    expect(result.current.current).toBe(objB);

    rerender({ value: null });
    expect(result.current.current).toBe(null);
  });

  it("allows eager mutation of .current between renders", () => {
    const { result } = renderHook(() => useRefSync(new Set(["a"])));
    act(() => {
      const next = new Set(result.current.current);
      next.add("b");
      result.current.current = next;
    });
    expect(result.current.current.has("b")).toBe(true);
  });
});
