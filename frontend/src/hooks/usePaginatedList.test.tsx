import { describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import { type PaginatedItem, usePaginatedList } from "./usePaginatedList.ts";

type Item = PaginatedItem & { name: string };

function item(id: string, name = id): Item {
  return { id, name };
}

function createOptions(overrides: Partial<Parameters<typeof usePaginatedList<Item>>[0]> = {}) {
  const mutate = mock(() => Promise.resolve(undefined));
  const fetchNextPage = mock(async (_pageToken: string) => ({
    items: [item("extra-1")],
    nextPageToken: undefined as string | undefined,
  }));
  return {
    firstPage: [item("a"), item("b")] as Item[] | undefined,
    firstPageToken: "token-1" as string | undefined,
    resetKeys: ["folder-a"] as unknown[],
    mutate,
    fetchNextPage,
    ...overrides,
  };
}

describe("usePaginatedList", () => {
  it("returns first page items and hasMore when a page token is present", () => {
    const options = createOptions();
    const { result } = renderHook(() => usePaginatedList(options));

    expect(result.current.items).toEqual([item("a"), item("b")]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);
  });

  it("returns an empty list when firstPage is undefined", () => {
    const options = createOptions({ firstPage: undefined, firstPageToken: undefined });
    const { result } = renderHook(() => usePaginatedList(options));

    expect(result.current.items).toEqual([]);
    expect(result.current.hasMore).toBe(false);
  });

  it("disables pagination when paginationDisabled is true", () => {
    const options = createOptions({ paginationDisabled: true });
    const { result } = renderHook(() => usePaginatedList(options));

    expect(result.current.hasMore).toBe(false);
  });

  it("appends the next page via loadMore and updates hasMore", async () => {
    const fetchNextPage = mock(async () => ({
      items: [item("c")],
      nextPageToken: "token-2",
    }));
    const options = createOptions({ fetchNextPage });
    const { result } = renderHook(() => usePaginatedList(options));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchNextPage).toHaveBeenCalledWith("token-1");
    expect(result.current.items.map(i => i.id)).toEqual(["a", "b", "c"]);
    expect(result.current.hasMore).toBe(true);
    expect(result.current.loadingMore).toBe(false);
  });

  it("deduplicates items that overlap the first page and prior extras", async () => {
    const fetchNextPage = mock(async () => ({
      items: [item("b"), item("c"), item("c")],
      nextPageToken: undefined,
    }));
    const options = createOptions({ fetchNextPage });
    const { result } = renderHook(() => usePaginatedList(options));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(result.current.items.map(i => i.id)).toEqual(["a", "b", "c"]);
    expect(result.current.hasMore).toBe(false);
  });

  it("does not call fetchNextPage when pagination is disabled or there is no token", async () => {
    const fetchNextPage = mock(async () => ({
      items: [item("c")],
      nextPageToken: undefined,
    }));
    const options = createOptions({
      fetchNextPage,
      firstPageToken: undefined,
      paginationDisabled: true,
    });
    const { result } = renderHook(() => usePaginatedList(options));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(fetchNextPage).not.toHaveBeenCalled();
  });

  it("sets loadingMore while loadMore is in flight", async () => {
    let resolvePage!: (value: { items: Item[]; nextPageToken: string | undefined }) => void;
    const fetchNextPage = mock(
      () =>
        new Promise<{ items: Item[]; nextPageToken: string | undefined }>(resolve => {
          resolvePage = resolve;
        }),
    );
    const options = createOptions({ fetchNextPage });
    const { result } = renderHook(() => usePaginatedList(options));

    let loadPromise: Promise<void>;
    act(() => {
      loadPromise = result.current.loadMore();
    });

    await waitFor(() => {
      expect(result.current.loadingMore).toBe(true);
    });

    await act(async () => {
      resolvePage({ items: [item("c")], nextPageToken: undefined });
      await loadPromise;
    });

    expect(result.current.loadingMore).toBe(false);
  });

  it("calls onError when loadMore fails and clears loadingMore", async () => {
    const onError = mock((_err: unknown) => {});
    const fetchNextPage = mock(async () => {
      throw new Error("network down");
    });
    const options = createOptions({ fetchNextPage, onError });
    const { result } = renderHook(() => usePaginatedList(options));

    await act(async () => {
      await result.current.loadMore();
    });

    expect(onError).toHaveBeenCalled();
    const err = onError.mock.calls[0]?.[0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("network down");
    expect(result.current.loadingMore).toBe(false);
    expect(result.current.items.map(i => i.id)).toEqual(["a", "b"]);
  });

  it("resets accumulated pages when resetKeys change", async () => {
    const fetchNextPage = mock(async () => ({
      items: [item("c")],
      nextPageToken: "token-2",
    }));
    const { result, rerender } = renderHook(
      ({ resetKeys, firstPageToken }) =>
        usePaginatedList(
          createOptions({
            resetKeys,
            firstPageToken,
            fetchNextPage,
          }),
        ),
      {
        initialProps: {
          resetKeys: ["folder-a"] as unknown[],
          firstPageToken: "token-1" as string | undefined,
        },
      },
    );

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items.map(i => i.id)).toEqual(["a", "b", "c"]);

    rerender({ resetKeys: ["folder-b"], firstPageToken: "token-new" });

    expect(result.current.items.map(i => i.id)).toEqual(["a", "b"]);
    // After reset, token re-syncs from firstPageToken
    expect(result.current.hasMore).toBe(true);
  });

  it("refresh clears extras and calls mutate", async () => {
    const mutate = mock(() => Promise.resolve(undefined));
    const fetchNextPage = mock(async () => ({
      items: [item("c")],
      nextPageToken: undefined,
    }));
    const options = createOptions({ mutate, fetchNextPage });
    const { result } = renderHook(() => usePaginatedList(options));

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.items).toHaveLength(3);

    act(() => {
      result.current.refresh();
    });

    expect(result.current.items.map(i => i.id)).toEqual(["a", "b"]);
    expect(mutate).toHaveBeenCalled();
  });

  it("does not mutate on mount when refreshKey is 0, but mutates when bumped", async () => {
    const mutate = mock(() => Promise.resolve(undefined));
    const { result, rerender } = renderHook(({ refreshKey }) => usePaginatedList(createOptions({ mutate, refreshKey })), { initialProps: { refreshKey: 0 } });

    expect(mutate).not.toHaveBeenCalled();

    rerender({ refreshKey: 1 });
    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });

    // After refresh, extras are cleared
    expect(result.current.items.map(i => i.id)).toEqual(["a", "b"]);
  });

  it("bumpRefreshKey triggers mutate when no external refreshKey is provided", async () => {
    const mutate = mock(() => Promise.resolve(undefined));
    const options = createOptions({ mutate });
    const { result } = renderHook(() => usePaginatedList(options));

    expect(result.current.refreshKey).toBe(0);

    act(() => {
      result.current.bumpRefreshKey();
    });

    await waitFor(() => {
      expect(mutate).toHaveBeenCalledTimes(1);
    });
    expect(result.current.refreshKey).toBe(1);
  });

  it("does not overwrite nextPageToken after extra pages have been loaded", async () => {
    const fetchNextPage = mock(async () => ({
      items: [item("c")],
      nextPageToken: "token-after-load",
    }));
    const { result, rerender } = renderHook(
      ({ firstPageToken }) =>
        usePaginatedList(
          createOptions({
            firstPageToken,
            fetchNextPage,
          }),
        ),
      { initialProps: { firstPageToken: "token-1" as string | undefined } },
    );

    await act(async () => {
      await result.current.loadMore();
    });
    expect(result.current.hasMore).toBe(true);

    // Parent revalidates first page with a different token — must not clobber accumulated state
    rerender({ firstPageToken: "token-from-swr-revalidate" });
    expect(result.current.items.map(i => i.id)).toEqual(["a", "b", "c"]);

    // Still has the token from the last loaded page, not the revalidated first-page token
    await act(async () => {
      await result.current.loadMore();
    });
    expect(fetchNextPage).toHaveBeenLastCalledWith("token-after-load");
  });
});
