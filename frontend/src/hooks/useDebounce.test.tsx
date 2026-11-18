import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useDebounce } from "./useDebounce.ts";

describe("useDebounce", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns the initial value immediately", () => {
    const { result } = renderHook(() => useDebounce("hello", 300));
    expect(result.current).toBe("hello");
  });

  it("does not update the debounced value before the delay elapses", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "a", delay: 300 },
    });

    rerender({ value: "b", delay: 300 });
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe("a");
  });

  it("updates the debounced value after the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });

    act(() => {
      jest.advanceTimersByTime(300);
    });
    expect(result.current).toBe("b");
  });

  it("resets the timer when the value changes again before the delay", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: "a" },
    });

    rerender({ value: "b" });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: "c" });
    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(result.current).toBe("a");

    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("c");
  });

  it("uses the default delay of 300ms", () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), {
      initialProps: { value: 1 },
    });

    rerender({ value: 2 });
    act(() => {
      jest.advanceTimersByTime(299);
    });
    expect(result.current).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current).toBe(2);
  });

  it("preserves object identity of the debounced value", () => {
    const objA = { n: 1 };
    const objB = { n: 2 };
    const { result, rerender } = renderHook(({ value }: { value: { n: number } }) => useDebounce(value, 100), {
      initialProps: { value: objA },
    });

    expect(result.current).toBe(objA);

    rerender({ value: objB });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe(objB);
  });

  it("restarts the timer when delay changes", () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: "a", delay: 500 },
    });

    rerender({ value: "b", delay: 500 });
    act(() => {
      jest.advanceTimersByTime(200);
    });

    rerender({ value: "b", delay: 100 });
    act(() => {
      jest.advanceTimersByTime(100);
    });
    expect(result.current).toBe("b");
  });
});
