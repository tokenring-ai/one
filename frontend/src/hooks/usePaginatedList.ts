import { useCallback, useEffect, useMemo, useState } from "react";
import { useRefSync } from "./useRefSync.ts";

export interface PaginatedItem {
  id: string;
}

export interface UsePaginatedListOptions<T extends PaginatedItem> {
  /** The first page of items from the SWR query */
  firstPage: T[] | undefined;
  /** The next-page token from the first page response */
  firstPageToken: string | undefined;
  /** Keys that, when changed, should reset accumulated pages */
  resetKeys: unknown[];
  /** Optional key to force a full refresh (bumped by caller) */
  refreshKey?: number | undefined;
  /** SWR mutate function to revalidate the first page */
  mutate: () => Promise<unknown>;
  /** Fetch the next page of items */
  fetchNextPage: (pageToken: string) => Promise<{ items: T[]; nextPageToken: string | undefined }>;
  /** Whether pagination is disabled (e.g., search mode) */
  paginationDisabled?: boolean | undefined;
  /** Called when a "load more" request fails */
  onError?: ((error: unknown) => void) | undefined;
}

export interface UsePaginatedListReturn<T> {
  /** All accumulated items (first page + loaded pages, deduplicated) */
  items: T[];
  /** Whether a "load more" request is in progress */
  loadingMore: boolean;
  /** Whether there are more pages to load */
  hasMore: boolean;
  /** Call to fetch the next page */
  loadMore: () => Promise<void>;
  /** Call to reset and re-fetch from the beginning */
  refresh: () => void;
  /** The current refresh key (for passing to child components) */
  refreshKey: number;
  /** Bump the refresh key to trigger a re-fetch */
  bumpRefreshKey: () => void;
}

/**
 * Accumulate client-side pages from a server that returns page tokens.
 * Keeps the first page from a SWR query and appends subsequent pages loaded via RPC.
 *
 * @example
 * const { items, loadingMore, hasMore, loadMore, refresh } = usePaginatedList({
 *   firstPage: result.data?.messages,
 *   firstPageToken: result.data?.nextPageToken,
 *   resetKeys: [provider, box, searchQuery],
 *   refreshKey: parentRefreshKey,
 *   mutate: result.mutate,
 *   fetchNextPage: async (pageToken) => {
 *     const page = await client.getMessages({ pageToken });
 *     return { items: page.messages, nextPageToken: page.nextPageToken };
 *   },
 *   paginationDisabled: !!searchQuery,
 * });
 */
export function usePaginatedList<T extends PaginatedItem>(options: UsePaginatedListOptions<T>): UsePaginatedListReturn<T> {
  const { firstPage, firstPageToken, resetKeys, refreshKey, mutate, fetchNextPage, paginationDisabled, onError } = options;

  const [extraItems, setExtraItems] = useState<T[]>([]);
  const [nextPageToken, setNextPageToken] = useState<string | undefined>();
  const [loadingMore, setLoadingMore] = useState(false);
  const [internalRefreshKey, setInternalRefreshKey] = useState(0);
  const effectiveRefreshKey = refreshKey ?? internalRefreshKey;

  // Keep latest callbacks for effects/async without stale closures or unstable deps
  const mutateRef = useRefSync(mutate);
  const fetchNextPageRef = useRefSync(fetchNextPage);
  const onErrorRef = useRefSync(onError);

  // Reset accumulated pages when query changes (resetKeys is the dependency list by design)
  useEffect(() => {
    setExtraItems([]);
    setNextPageToken(undefined);
  }, resetKeys);

  // Sync next-page token from the first page only while we have not loaded more
  useEffect(() => {
    if (paginationDisabled || extraItems.length > 0) return;
    setNextPageToken(firstPageToken);
  }, [firstPageToken, paginationDisabled, extraItems.length]);

  // Handle external/internal refresh (skip initial 0 to avoid double-fetch on mount)
  useEffect(() => {
    if (effectiveRefreshKey === 0) return;
    setExtraItems([]);
    setNextPageToken(undefined);
    void mutateRef.current();
  }, [effectiveRefreshKey, mutateRef]);

  const items = useMemo(() => {
    const base = firstPage ?? [];
    if (extraItems.length === 0) return base;
    const seen = new Set(base.map(m => m.id));
    return [...base, ...extraItems.filter(m => !seen.has(m.id))];
  }, [firstPage, extraItems]);

  const loadMore = useCallback(async () => {
    if (!nextPageToken || paginationDisabled) return;
    setLoadingMore(true);
    try {
      const page = await fetchNextPageRef.current(nextPageToken);
      setExtraItems(prev => {
        const seen = new Set(prev.map(m => m.id));
        const additions: T[] = [];
        for (const item of page.items) {
          if (seen.has(item.id)) continue;
          seen.add(item.id);
          additions.push(item);
        }
        return [...prev, ...additions];
      });
      setNextPageToken(page.nextPageToken);
    } catch (err) {
      onErrorRef.current?.(err);
    } finally {
      setLoadingMore(false);
    }
  }, [nextPageToken, paginationDisabled, fetchNextPageRef, onErrorRef]);

  const refresh = useCallback(() => {
    setExtraItems([]);
    setNextPageToken(undefined);
    void mutateRef.current();
  }, [mutateRef]);

  const bumpRefreshKey = useCallback(() => {
    setInternalRefreshKey(k => k + 1);
  }, []);

  return {
    items,
    loadingMore,
    hasMore: !!nextPageToken && !paginationDisabled,
    loadMore,
    refresh,
    refreshKey: effectiveRefreshKey,
    bumpRefreshKey,
  };
}
