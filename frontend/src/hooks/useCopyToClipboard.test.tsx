import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const toastSuccess = mock((_message: string, _opts?: { duration?: number }) => "id");
const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: {
    success: toastSuccess,
    error: toastError,
    warning: mock(),
    info: mock(),
    remove: mock(),
  },
}));

const { useCopyToClipboard } = await import("./useCopyToClipboard.ts");

describe("useCopyToClipboard", () => {
  let writeText: ReturnType<typeof mock>;

  beforeEach(() => {
    jest.useFakeTimers();
    toastSuccess.mockClear();
    toastError.mockClear();
    writeText = mock(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("copies text and sets copied for the feedback duration", async () => {
    const { result } = renderHook(() => useCopyToClipboard());

    let ok = false;
    await act(async () => {
      ok = await result.current.copy("hello");
    });

    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(result.current.copied).toBe(true);
    // Icon-only by default (no label) — no toast
    expect(toastSuccess).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1999);
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.copied).toBe(false);
  });

  it("respects feedbackDuration", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ feedbackDuration: 500 }));

    await act(async () => {
      await result.current.copy("x");
    });
    expect(result.current.copied).toBe(true);

    act(() => {
      jest.advanceTimersByTime(500);
    });
    expect(result.current.copied).toBe(false);
  });

  it("shows toast when label is provided", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ label: "secret" }));

    await act(async () => {
      await result.current.copy("value");
    });

    expect(toastSuccess).toHaveBeenCalledWith("Copied secret", { duration: 2000 });
    expect(result.current.copied).toBe(true);
  });

  it("shows toast when showToast is true without label", async () => {
    const { result } = renderHook(() => useCopyToClipboard({ showToast: true }));

    await act(async () => {
      await result.current.copy("value");
    });

    expect(toastSuccess).toHaveBeenCalledWith("Copied to clipboard", { duration: 2000 });
  });

  it("markCopied sets feedback without writing to clipboard", () => {
    const { result } = renderHook(() => useCopyToClipboard({ feedbackDuration: 1000 }));

    act(() => {
      result.current.markCopied();
    });
    expect(result.current.copied).toBe(true);
    expect(writeText).not.toHaveBeenCalled();

    act(() => {
      jest.advanceTimersByTime(1000);
    });
    expect(result.current.copied).toBe(false);
  });

  it("clears feedback timeout on unmount", async () => {
    const { result, unmount } = renderHook(() => useCopyToClipboard());

    await act(async () => {
      await result.current.copy("bye");
    });
    expect(result.current.copied).toBe(true);

    unmount();
    // Should not throw when timers fire after unmount
    act(() => {
      jest.advanceTimersByTime(3000);
    });
  });

  it("returns false and does not set copied when clipboard fails", async () => {
    writeText.mockImplementation(async () => {
      throw new Error("denied");
    });
    // Ensure fallback is also unavailable (jsdom default)
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: undefined,
    });

    const { result } = renderHook(() => useCopyToClipboard({ showToast: true }));

    let ok = true;
    await act(async () => {
      ok = await result.current.copy("fail");
    });

    expect(ok).toBe(false);
    expect(result.current.copied).toBe(false);
    expect(toastError).toHaveBeenCalled();
  });
});
