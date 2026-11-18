import { describe, expect, it, mock } from "bun:test";
import { renderHook, waitFor } from "@testing-library/react";
import { bucketTextLength, useCostEstimate } from "./useCostEstimate.ts";

const DELAY = 20;

describe("useCostEstimate", () => {
  it("is idle with no key and never calls the server", async () => {
    const fetchEstimate = mock(async () => ({ amountUsd: 1 }));
    const { result } = renderHook(() => useCostEstimate(null, fetchEstimate, DELAY));
    await new Promise(resolve => setTimeout(resolve, 60));
    expect(result.current).toEqual({ status: "idle" });
    expect(fetchEstimate).not.toHaveBeenCalled();
  });

  it("is loading, then ready with the amount", async () => {
    const { result } = renderHook(() => useCostEstimate("a", async () => ({ amountUsd: 0.04 }), DELAY));
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current).toEqual({ status: "ready", amountUsd: 0.04 }));
  });

  it("is unavailable when the server has no price", async () => {
    const { result } = renderHook(() => useCostEstimate("a", async () => ({ amountUsd: null }), DELAY));
    await waitFor(() => expect(result.current).toEqual({ status: "unavailable" }));
  });

  it("is error when the check fails or throws synchronously", async () => {
    const failing = renderHook(() => useCostEstimate("a", async () => Promise.reject(new Error("boom")), DELAY));
    await waitFor(() => expect(failing.result.current).toEqual({ status: "error" }));
    const throwing = renderHook(() =>
      useCostEstimate(
        "a",
        () => {
          throw new Error("sync");
        },
        DELAY,
      ),
    );
    await waitFor(() => expect(throwing.result.current).toEqual({ status: "error" }));
  });

  it("debounces key changes and shows loading until the new answer arrives", async () => {
    const fetchEstimate = mock(async () => ({ amountUsd: 1 }));
    const { result, rerender } = renderHook(({ k }) => useCostEstimate(k, fetchEstimate, DELAY), { initialProps: { k: "a" } });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchEstimate).toHaveBeenCalledTimes(1);

    rerender({ k: "b" });
    rerender({ k: "c" });
    expect(result.current).toEqual({ status: "loading" });
    await waitFor(() => expect(result.current.status).toBe("ready"));
    expect(fetchEstimate).toHaveBeenCalledTimes(2);
  });
});

describe("bucketTextLength", () => {
  it("rounds up so the price is never understated", () => {
    expect(bucketTextLength(0)).toBe(0);
    expect(bucketTextLength(1)).toBe(100);
    expect(bucketTextLength(100)).toBe(100);
    expect(bucketTextLength(101)).toBe(200);
    expect(bucketTextLength(1001)).toBe(2000);
    expect(bucketTextLength(10_001)).toBe(15_000);
  });
});
