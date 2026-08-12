import { describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import { useLiveStreamStatus, useLiveStreamStatusFromSWR } from "./useLiveStreamStatus.ts";

describe("useLiveStreamStatus", () => {
  it("returns error when initial connection fails before any data", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: new Error("fail"), hasData: false }));
    expect(result.current).toEqual({
      status: "error",
      label: "Error",
      isStale: false,
      isInitial: true,
      showSpinner: false,
    });
  });

  it("returns reconnecting when error occurs after data exists", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: new Error("lost"), hasData: true }));
    expect(result.current).toEqual({
      status: "reconnecting",
      label: "Reconnecting",
      isStale: true,
      isInitial: false,
      showSpinner: false,
    });
  });

  it("returns connecting when no data and no error", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: true, error: undefined, hasData: false }));
    expect(result.current).toEqual({
      status: "connecting",
      label: "Connecting",
      isStale: false,
      isInitial: true,
      showSpinner: true,
    });
  });

  it("does not show spinner when connecting without validation", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: null, hasData: false }));
    expect(result.current.status).toBe("connecting");
    expect(result.current.showSpinner).toBe(false);
  });

  it("returns live when data exists and no error", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: undefined, hasData: true }));
    expect(result.current).toEqual({
      status: "live",
      label: "Live",
      isStale: false,
      isInitial: false,
      showSpinner: false,
    });
  });

  it("treats empty string error as an error", () => {
    // error != null is true for "" — callers should pass undefined/null for "no error"
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: "", hasData: false }));
    expect(result.current.status).toBe("error");
  });

  it("accepts string errors from useRPCStream", () => {
    const { result } = renderHook(() => useLiveStreamStatus({ isValidating: false, error: "connection lost", hasData: true }));
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.isStale).toBe(true);
  });

  it("updates when inputs change", () => {
    const { result, rerender } = renderHook(
      ({ isValidating, error, hasData }: { isValidating: boolean; error: Error | undefined; hasData: boolean }) =>
        useLiveStreamStatus({ isValidating, error, hasData }),
      { initialProps: { isValidating: true, error: undefined as Error | undefined, hasData: false } },
    );
    expect(result.current.status).toBe("connecting");

    rerender({ isValidating: false, error: undefined, hasData: true });
    expect(result.current.status).toBe("live");

    rerender({ isValidating: false, error: new Error("lost"), hasData: true });
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.isStale).toBe(true);
  });
});

describe("useLiveStreamStatusFromSWR", () => {
  it("derives status from SWR-shaped result", () => {
    const { result } = renderHook(() =>
      useLiveStreamStatusFromSWR({
        isValidating: false,
        error: new Error("lost"),
        data: { ok: true },
      }),
    );
    expect(result.current.status).toBe("reconnecting");
    expect(result.current.isStale).toBe(true);
  });

  it("treats undefined data as no snapshot", () => {
    const { result } = renderHook(() =>
      useLiveStreamStatusFromSWR({
        isValidating: true,
        error: undefined,
        data: undefined,
      }),
    );
    expect(result.current.status).toBe("connecting");
    expect(result.current.showSpinner).toBe(true);
  });
});
