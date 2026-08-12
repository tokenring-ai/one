import { useCallback, useMemo, useState } from "react";
import { useDebounce } from "./useDebounce.ts";

export interface UseSearchFilterOptions<T> {
  /** The source list to filter */
  items: T[];
  /**
   * Extracts a searchable string from an item.
   * Can join multiple fields for broader matching.
   */
  searchFields: (item: T) => string;
  /**
   * Optional: additional filter predicate applied alongside the search.
   * Both the search match AND this predicate must be true for an item to appear.
   */
  predicate?: (item: T) => boolean;
  /**
   * Optional: debounce delay in ms. Default: 0 (instant filter on every keystroke).
   * Set to > 0 for large lists where instant filtering is expensive.
   */
  debounceMs?: number;
}

export interface UseSearchFilterReturn<T> {
  /** The current search query string (updates immediately on every keystroke) */
  query: string;
  /** Setter for the search query */
  setQuery: (value: string) => void;
  /** Whether a search is active (non-empty trimmed query) */
  isActive: boolean;
  /** The filtered list (uses debounced query when debounceMs > 0) */
  filtered: T[];
  /** Clear the search query */
  clear: () => void;
  /** Number of items matching the current search (equals total when query is empty) */
  matchCount: number;
}

/**
 * Simple free-text search over a list with optional extra predicate and debounce.
 *
 * Prefer this for sidebar-style instant filters. Use `useFilteredList` when you also
 * need status tabs + sort, or `useCommittedSearch` when search should commit on Enter.
 *
 * @example
 * const { query, setQuery, filtered, isActive, clear } = useSearchFilter({
 *   items: plugins,
 *   searchFields: p => `${p.displayName} ${p.pluginName} ${p.description}`,
 * });
 */
export function useSearchFilter<T>(options: UseSearchFilterOptions<T>): UseSearchFilterReturn<T> {
  const { items, searchFields, predicate, debounceMs = 0 } = options;
  const [query, setQuery] = useState("");

  // Only debounce when requested. Pass a stable empty string into useDebounce when off so it
  // does not schedule timers / extra re-renders on every keystroke.
  const shouldDebounce = debounceMs > 0;
  const debouncedQuery = useDebounce(shouldDebounce ? query : "", shouldDebounce ? debounceMs : 0);
  const effectiveQuery = shouldDebounce ? debouncedQuery : query;

  const isActive = query.trim().length > 0;

  const clear = useCallback(() => {
    setQuery("");
  }, []);

  const filtered = useMemo(() => {
    const normalized = effectiveQuery.trim().toLowerCase();

    return items.filter(item => {
      if (predicate && !predicate(item)) return false;
      if (!normalized) return true;
      return searchFields(item).toLowerCase().includes(normalized);
    });
  }, [items, effectiveQuery, searchFields, predicate]);

  return {
    query,
    setQuery,
    isActive,
    filtered,
    clear,
    matchCount: filtered.length,
  };
}
