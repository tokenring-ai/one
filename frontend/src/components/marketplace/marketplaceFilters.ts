import { useCallback, useSyncExternalStore } from "react";
import { ALL_CATEGORIES, type MarketplaceKind, type MarketplaceSort } from "./marketplaceItems.ts";

/**
 * Storefront filters, held outside React and keyed per storefront.
 *
 * Every host swaps the storefront out for the item detail page, which unmounts
 * it; with the filters in component state, "Back" from an item reset the kind,
 * category, tag, search and sort the user had narrowed down to. In memory only.
 */
export interface MarketplaceFilters {
  kind: MarketplaceKind | null;
  category: string;
  tag: string | null;
  query: string;
  sort: MarketplaceSort;
}

export const DEFAULT_MARKETPLACE_FILTERS: MarketplaceFilters = {
  kind: null,
  category: ALL_CATEGORIES,
  tag: null,
  query: "",
  sort: "alphabetical",
};

/** What "Clear filters" resets: everything that narrows the grid, but not the sort order. */
export const CLEARED_MARKETPLACE_FILTERS: Partial<MarketplaceFilters> = {
  kind: DEFAULT_MARKETPLACE_FILTERS.kind,
  category: DEFAULT_MARKETPLACE_FILTERS.category,
  tag: DEFAULT_MARKETPLACE_FILTERS.tag,
  query: DEFAULT_MARKETPLACE_FILTERS.query,
};

let filtersByKey: ReadonlyMap<string, MarketplaceFilters> = new Map();
const listeners = new Set<() => void>();

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getMarketplaceFilters(key: string): MarketplaceFilters {
  return filtersByKey.get(key) ?? DEFAULT_MARKETPLACE_FILTERS;
}

export function updateMarketplaceFilters(key: string, patch: Partial<MarketplaceFilters>): void {
  const current = getMarketplaceFilters(key);
  const next = { ...current, ...patch };
  if ((Object.keys(next) as (keyof MarketplaceFilters)[]).every(field => next[field] === current[field])) return;
  const map = new Map(filtersByKey);
  map.set(key, next);
  filtersByKey = map;
  for (const listener of listeners) listener();
}

/** The filters of one storefront, and a setter that merges a patch into them. */
export function useMarketplaceFilters(key: string): [MarketplaceFilters, (patch: Partial<MarketplaceFilters>) => void] {
  const filters = useSyncExternalStore(
    subscribe,
    () => getMarketplaceFilters(key),
    () => DEFAULT_MARKETPLACE_FILTERS,
  );
  const update = useCallback((patch: Partial<MarketplaceFilters>) => updateMarketplaceFilters(key, patch), [key]);
  return [filters, update];
}

/** Test helper. */
export function resetMarketplaceFilters(): void {
  filtersByKey = new Map();
  for (const listener of listeners) listener();
}
