import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useRevealSecret } from "./useRevealSecret.ts";

describe("useRevealSecret", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("starts hidden with no value and not loading", () => {
    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => "secret",
      }),
    );

    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("toggleReveal fetches and reveals the secret", async () => {
    const fetchSecret = mock(async () => "super-secret");
    const onRevealed = mock((_value: string) => {});

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
        onRevealed,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });

    expect(fetchSecret).toHaveBeenCalledTimes(1);
    expect(result.current.revealed).toBe(true);
    expect(result.current.value).toBe("super-secret");
    expect(result.current.loading).toBe(false);
    expect(onRevealed).toHaveBeenCalledWith("super-secret");
  });

  it("toggleReveal hides when already revealed", async () => {
    const fetchSecret = mock(async () => "super-secret");
    const onHidden = mock(() => {});

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
        onHidden,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });
    expect(result.current.revealed).toBe(true);

    await act(async () => {
      await result.current.toggleReveal();
    });

    expect(fetchSecret).toHaveBeenCalledTimes(1);
    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("hide clears revealed state and calls onHidden", async () => {
    const onHidden = mock(() => {});
    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => "secret",
        onHidden,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });

    act(() => {
      result.current.hide();
    });

    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("hide is a no-op when already hidden", () => {
    const onHidden = mock(() => {});
    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => "secret",
        onHidden,
      }),
    );

    act(() => {
      result.current.hide();
    });

    expect(onHidden).not.toHaveBeenCalled();
  });

  it("auto-hides after autoHideMs", async () => {
    const onHidden = mock(() => {});
    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => "secret",
        autoHideMs: 1000,
        onHidden,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });
    expect(result.current.revealed).toBe(true);

    act(() => {
      jest.advanceTimersByTime(999);
    });
    expect(result.current.revealed).toBe(true);

    act(() => {
      jest.advanceTimersByTime(1);
    });
    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(onHidden).toHaveBeenCalledTimes(1);
  });

  it("fetchForClipboard returns cached value when revealed without re-fetching", async () => {
    const fetchSecret = mock(async () => "cached-secret");
    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });
    expect(fetchSecret).toHaveBeenCalledTimes(1);

    const clipboard = await act(async () => {
      return await result.current.fetchForClipboard();
    });

    expect(clipboard).toBe("cached-secret");
    expect(fetchSecret).toHaveBeenCalledTimes(1);
    expect(result.current.revealed).toBe(true);
  });

  it("fetchForClipboard stealth-fetches without revealing", async () => {
    const fetchSecret = mock(async () => "clipboard-only");
    const onRevealed = mock((_value: string) => {});

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
        onRevealed,
      }),
    );

    const clipboard = await act(async () => {
      return await result.current.fetchForClipboard();
    });

    expect(clipboard).toBe("clipboard-only");
    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(onRevealed).not.toHaveBeenCalled();
    expect(fetchSecret).toHaveBeenCalledTimes(1);
  });

  it("calls onError and stays hidden when fetch fails on reveal", async () => {
    const error = new Error("not found");
    const fetchSecret = mock(async () => {
      throw error;
    });
    const onError = mock((_err: unknown) => {});
    const onRevealed = mock((_value: string) => {});

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
        onError,
        onRevealed,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });

    expect(result.current.revealed).toBe(false);
    expect(result.current.value).toBeNull();
    expect(result.current.loading).toBe(false);
    expect(onError).toHaveBeenCalledWith(error);
    expect(onRevealed).not.toHaveBeenCalled();
  });

  it("fetchForClipboard returns null and calls onError when fetch fails", async () => {
    const error = new Error("denied");
    const onError = mock((_err: unknown) => {});

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => {
          throw error;
        },
        onError,
      }),
    );

    let clipboard: string | null = "sentinel";
    await act(async () => {
      clipboard = await result.current.fetchForClipboard();
    });

    expect(clipboard).toBeNull();
    expect(onError).toHaveBeenCalledWith(error);
    expect(result.current.revealed).toBe(false);
  });

  it("shares loading state and guards concurrent fetches", async () => {
    let resolveFetch!: (value: string) => void;
    const fetchSecret = mock(
      () =>
        new Promise<string>(r => {
          resolveFetch = r;
        }),
    );

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret,
      }),
    );

    let togglePromise!: Promise<void>;
    let clipboardPromise!: Promise<string | null>;

    act(() => {
      togglePromise = result.current.toggleReveal();
    });
    expect(result.current.loading).toBe(true);

    let clipboardResult: string | null = "sentinel";
    await act(async () => {
      clipboardPromise = result.current.fetchForClipboard();
      clipboardResult = await clipboardPromise;
    });

    // Second call while first is in flight is rejected by the loading guard.
    expect(clipboardResult).toBeNull();
    expect(fetchSecret).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch("secret");
      await togglePromise;
    });

    expect(result.current.loading).toBe(false);
    expect(result.current.revealed).toBe(true);
    expect(result.current.value).toBe("secret");
  });

  it("sets loading while fetching and clears after", async () => {
    let resolveFetch!: (value: string) => void;
    const fetchPromise = new Promise<string>(r => {
      resolveFetch = r;
    });

    const { result } = renderHook(() =>
      useRevealSecret({
        fetchSecret: () => fetchPromise,
      }),
    );

    let togglePromise!: Promise<void>;
    act(() => {
      togglePromise = result.current.toggleReveal();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      resolveFetch("done");
      await togglePromise;
    });

    expect(result.current.loading).toBe(false);
  });

  it("clears auto-hide timer on unmount", async () => {
    const onHidden = mock(() => {});
    const { result, unmount } = renderHook(() =>
      useRevealSecret({
        fetchSecret: async () => "secret",
        autoHideMs: 5000,
        onHidden,
      }),
    );

    await act(async () => {
      await result.current.toggleReveal();
    });

    unmount();

    act(() => {
      jest.advanceTimersByTime(10_000);
    });
    // Should not throw; onHidden should not fire after unmount via timer
    // (React unmount clears the effect timer)
    expect(onHidden).not.toHaveBeenCalled();
  });
});
