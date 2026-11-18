import { afterEach, beforeEach, describe, expect, it, jest, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useRemoteChangeDetection } from "./useRemoteChangeDetection.ts";

describe("useRemoteChangeDetection", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    mock.restore();
  });

  describe("streaming strategy", () => {
    it("does not call onRemoteChange when remote matches markLoaded", () => {
      const onRemoteChange = mock(() => {});
      // Mirror real apps: markLoaded during load, then isDocumentReady becomes true
      const { result, rerender } = renderHook(
        ({ remoteMeta, isDocumentReady, isDirty }) =>
          useRemoteChangeDetection({
            documentKey: "topic/item",
            isDocumentReady,
            isDirty,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: string) => meta,
            },
            onRemoteChange,
          }),
        { initialProps: { remoteMeta: "t1" as string | null, isDocumentReady: false, isDirty: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });
      rerender({ remoteMeta: "t1", isDocumentReady: true, isDirty: false });
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("calls onRemoteChange when remote updatedAt changes and not dirty", () => {
      const onRemoteChange = mock(() => {});
      const { result, rerender } = renderHook(
        ({ remoteMeta, isDocumentReady }) =>
          useRemoteChangeDetection({
            documentKey: "topic/item",
            isDocumentReady,
            isDirty: false,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: string) => meta,
            },
            onRemoteChange,
          }),
        { initialProps: { remoteMeta: "t1" as string | null, isDocumentReady: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });
      rerender({ remoteMeta: "t1", isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();

      rerender({ remoteMeta: "t2", isDocumentReady: true });
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("skips onRemoteChange when dirty", () => {
      const onRemoteChange = mock(() => {});
      const { result, rerender } = renderHook(
        ({ remoteMeta, isDirty, isDocumentReady }) =>
          useRemoteChangeDetection({
            documentKey: "topic/item",
            isDocumentReady,
            isDirty,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: string) => meta,
            },
            onRemoteChange,
          }),
        { initialProps: { remoteMeta: "t1" as string | null, isDirty: true, isDocumentReady: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });
      rerender({ remoteMeta: "t2", isDirty: true, isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("skips when document is not ready", () => {
      const onRemoteChange = mock(() => {});
      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "topic/item",
          isDocumentReady: false,
          isDirty: false,
          strategy: {
            type: "streaming",
            remoteMeta: "t2",
            getUpdatedAt: (meta: string) => meta,
          },
          onRemoteChange,
        }),
      );
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("skips when documentKey is null", () => {
      const onRemoteChange = mock(() => {});
      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: null,
          isDocumentReady: true,
          isDirty: false,
          strategy: {
            type: "streaming",
            remoteMeta: "t2",
            getUpdatedAt: (meta: string) => meta,
          },
          onRemoteChange,
        }),
      );
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("uses getUpdatedAt to extract the timestamp from structured meta", () => {
      const onRemoteChange = mock(() => {});
      const { result, rerender } = renderHook(
        ({ remoteMeta, isDocumentReady }) =>
          useRemoteChangeDetection({
            documentKey: "doc",
            isDocumentReady,
            isDirty: false,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: { updatedAt: string }) => meta.updatedAt,
            },
            onRemoteChange,
          }),
        { initialProps: { remoteMeta: { updatedAt: "a" } as { updatedAt: string } | null, isDocumentReady: false } },
      );

      act(() => {
        result.current.markLoaded("a");
      });
      rerender({ remoteMeta: { updatedAt: "a" }, isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();

      rerender({ remoteMeta: { updatedAt: "b" }, isDocumentReady: true });
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("markLoaded(null) clears the baseline so the next remote update refreshes", () => {
      const onRemoteChange = mock(() => {});
      const { result, rerender } = renderHook(
        ({ remoteMeta, isDocumentReady }) =>
          useRemoteChangeDetection({
            documentKey: "topic/item",
            isDocumentReady,
            isDirty: false,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: string) => meta,
            },
            onRemoteChange,
          }),
        { initialProps: { remoteMeta: "t1" as string | null, isDocumentReady: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });
      rerender({ remoteMeta: "t1", isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();

      // Pause detection so we can clear the baseline without firing
      rerender({ remoteMeta: "t1", isDocumentReady: false });
      act(() => {
        result.current.markLoaded(null);
      });
      // Same remote meta counts as a change once the baseline is cleared
      rerender({ remoteMeta: "t1", isDocumentReady: true });
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("keeps the baseline across documentKey changes until markLoaded updates it", () => {
      const onRemoteChange = mock(() => {});
      const { result, rerender } = renderHook(
        ({ documentKey, remoteMeta, isDocumentReady }) =>
          useRemoteChangeDetection({
            documentKey,
            isDocumentReady,
            isDirty: false,
            strategy: {
              type: "streaming",
              remoteMeta,
              getUpdatedAt: (meta: string) => meta,
            },
            onRemoteChange,
          }),
        { initialProps: { documentKey: "a/1" as string | null, remoteMeta: "t1" as string | null, isDocumentReady: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });
      rerender({ documentKey: "a/1", remoteMeta: "t1", isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();

      // Same updatedAt after navigation should not force a refresh (load will markLoaded again)
      rerender({ documentKey: "b/2", remoteMeta: "t1", isDocumentReady: true });
      expect(onRemoteChange).not.toHaveBeenCalled();

      rerender({ documentKey: "b/2", remoteMeta: "t2", isDocumentReady: true });
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("fires when ready with remote meta but no markLoaded baseline", () => {
      const onRemoteChange = mock(() => {});
      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "topic/item",
          isDocumentReady: true,
          isDirty: false,
          strategy: {
            type: "streaming",
            remoteMeta: "t1",
            getUpdatedAt: (meta: string) => meta,
          },
          onRemoteChange,
        }),
      );
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });
  });

  describe("polling strategy", () => {
    it("polls at the configured interval and refreshes on updatedAt change", async () => {
      let remoteUpdatedAt = "t1";
      const poll = mock(async () => ({ content: "x", updatedAt: remoteUpdatedAt }));
      const onRemoteChange = mock(async () => {});

      const { result } = renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: true,
          isDirty: false,
          strategy: { type: "polling", poll, intervalMs: 1000 },
          onRemoteChange,
        }),
      );

      act(() => {
        result.current.markLoaded("t1");
      });

      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
      });
      expect(poll).toHaveBeenCalled();
      expect(onRemoteChange).not.toHaveBeenCalled();

      remoteUpdatedAt = "t2";
      await act(async () => {
        jest.advanceTimersByTime(1000);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onRemoteChange).toHaveBeenCalledTimes(1);
    });

    it("does not poll when dirty", async () => {
      const poll = mock(async () => ({ content: "x", updatedAt: "t2" }));
      const onRemoteChange = mock(async () => {});

      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: true,
          isDirty: true,
          strategy: { type: "polling", poll, intervalMs: 500 },
          onRemoteChange,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });
      expect(poll).not.toHaveBeenCalled();
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("does not poll when document is not ready", async () => {
      const poll = mock(async () => ({ content: "x", updatedAt: "t2" }));
      const onRemoteChange = mock(async () => {});

      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: false,
          isDirty: false,
          strategy: { type: "polling", poll, intervalMs: 500 },
          onRemoteChange,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });
      expect(poll).not.toHaveBeenCalled();
    });

    it("ignores poll errors", async () => {
      const poll = mock(async () => {
        throw new Error("network blip");
      });
      const onRemoteChange = mock(async () => {});

      const { result } = renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: true,
          isDirty: false,
          strategy: { type: "polling", poll, intervalMs: 500 },
          onRemoteChange,
        }),
      );

      act(() => {
        result.current.markLoaded("t1");
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(poll).toHaveBeenCalled();
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("skips onRemoteChange when dirty flips mid-flight", async () => {
      let resolvePoll: (value: { content: string; updatedAt: string }) => void = () => {};
      const poll = mock(
        () =>
          new Promise<{ content: string; updatedAt: string }>(resolve => {
            resolvePoll = resolve;
          }),
      );
      const onRemoteChange = mock(async () => {});

      const { result, rerender } = renderHook(
        ({ isDirty }) =>
          useRemoteChangeDetection({
            documentKey: "flow/page",
            isDocumentReady: true,
            isDirty,
            strategy: { type: "polling", poll, intervalMs: 500 },
            onRemoteChange,
          }),
        { initialProps: { isDirty: false } },
      );

      act(() => {
        result.current.markLoaded("t1");
      });

      await act(async () => {
        jest.advanceTimersByTime(500);
        await Promise.resolve();
      });
      expect(poll).toHaveBeenCalled();

      // User starts editing while poll is in flight
      rerender({ isDirty: true });

      await act(async () => {
        resolvePoll({ content: "remote", updatedAt: "t2" });
        await Promise.resolve();
        await Promise.resolve();
      });
      expect(onRemoteChange).not.toHaveBeenCalled();
    });

    it("clears the interval on unmount", async () => {
      const poll = mock(async () => ({ content: "x", updatedAt: "t1" }));
      const onRemoteChange = mock(async () => {});

      const { unmount } = renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: true,
          isDirty: false,
          strategy: { type: "polling", poll, intervalMs: 500 },
          onRemoteChange,
        }),
      );

      unmount();

      await act(async () => {
        jest.advanceTimersByTime(2000);
        await Promise.resolve();
      });
      expect(poll).not.toHaveBeenCalled();
    });

    it("uses default interval of 3000ms", async () => {
      const poll = mock(async () => null);
      const onRemoteChange = mock(async () => {});

      renderHook(() =>
        useRemoteChangeDetection({
          documentKey: "flow/page",
          isDocumentReady: true,
          isDirty: false,
          strategy: { type: "polling", poll },
          onRemoteChange,
        }),
      );

      await act(async () => {
        jest.advanceTimersByTime(2999);
        await Promise.resolve();
      });
      expect(poll).not.toHaveBeenCalled();

      await act(async () => {
        jest.advanceTimersByTime(1);
        await Promise.resolve();
      });
      expect(poll).toHaveBeenCalledTimes(1);
    });
  });
});
