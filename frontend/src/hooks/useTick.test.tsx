import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTick } from "./useTick.ts";

describe("useTick", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("does not re-render on the interval when condition is false", () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
      useTick(1000, false);
    });

    expect(renderCount).toBe(1);

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(renderCount).toBe(1);
  });

  it("triggers re-renders on each interval while condition is true", () => {
    let renderCount = 0;
    renderHook(() => {
      renderCount += 1;
      useTick(1000, true);
    });

    expect(renderCount).toBe(1);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderCount).toBe(2);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderCount).toBe(3);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderCount).toBe(4);
  });

  it("stops ticking when condition becomes false", () => {
    let renderCount = 0;
    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => {
        renderCount += 1;
        useTick(1000, condition);
      },
      { initialProps: { condition: true } },
    );

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderCount).toBe(2);

    rerender({ condition: false });
    const countAfterStop = renderCount;

    act(() => {
      jest.advanceTimersByTime(5000);
    });
    expect(renderCount).toBe(countAfterStop);
  });

  it("starts ticking when condition becomes true", () => {
    let renderCount = 0;
    const { rerender } = renderHook(
      ({ condition }: { condition: boolean }) => {
        renderCount += 1;
        useTick(1000, condition);
      },
      { initialProps: { condition: false } },
    );

    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(renderCount).toBe(1);

    rerender({ condition: true });
    expect(renderCount).toBe(2);

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(renderCount).toBe(3);
  });

  it("resets the interval when intervalMs changes", () => {
    let renderCount = 0;
    const { rerender } = renderHook(
      ({ intervalMs }: { intervalMs: number }) => {
        renderCount += 1;
        useTick(intervalMs, true);
      },
      { initialProps: { intervalMs: 1000 } },
    );

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(renderCount).toBe(1);

    rerender({ intervalMs: 200 });
    const countAfterChange = renderCount;

    act(() => {
      jest.advanceTimersByTime(200);
    });
    expect(renderCount).toBe(countAfterChange + 1);
  });

  it("returns void", () => {
    const { result } = renderHook(() => useTick(1000, true));
    expect(result.current).toBeUndefined();
  });
});
