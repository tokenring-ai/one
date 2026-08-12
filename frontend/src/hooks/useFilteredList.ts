import { useCallback, useMemo, useState } from "react";

export interface ListFieldConfig<T> {
  /** Label for display in sort dropdown */
  label: string;
  /** Sort key identifier */
  key: string;
  /** Compare function for this field */
  compare: (a: T, b: T) => number;
}

export interface UseFilteredListOptions<T> {
  /** The source list to filter and sort */
  items: T[];
  /** Search query matcher. Return true to include the item. */
  matchesSearch: (item: T, query: string) => boolean;
  /** Optional filter predicate. Return true to include the item. */
  filterPredicate?: (item: T, filterValue: string) => boolean;
  /** Sort field configurations */
  sortFields: ListFieldConfig<T>[];
  /** Default sort field key */
  defaultSort?: string;
  /** Default filter value */
  defaultFilter?: string;
}

export interface UseFilteredListReturn<T> {
  /** The filtered and sorted list */
  items: T[];
  /** Current search query */
  search: string;
  /** Update search query */
  setSearch: (value: string) => void;
  /** Current filter value */
  filter: string;
  /** Update filter value */
  setFilter: (value: string) => void;
  /** Current sort field key */
  sort: string;
  /** Update sort field */
  setSort: (value: string) => void;
  /** Whether any filters are active (search or non-default filter) */
  hasActiveFilters: boolean;
  /** Clear all filters */
  clearFilters: () => void;
  /** Count of items matching the current filter (before search) */
  filterCount: number;
  /** Count of items matching all current filters */
  matchedCount: number;
}

/**
 * Manage combined search, filter, and sort state for a list.
 *
 * @example
 * const result = useFilteredList({
 *   items: installedPlugins,
 *   matchesSearch: (plugin, query) =>
 *     plugin.displayName.toLowerCase().includes(query) ||
 *     plugin.name.toLowerCase().includes(query),
 *   filterPredicate: (plugin, filter) =>
 *     filter === "all" || (filter === "configurable" && plugin.hasConfig),
 *   sortFields: [
 *     { key: "displayName", label: "Display name", compare: (a, b) => a.displayName.localeCompare(b.displayName) },
 *     { key: "name", label: "Package name", compare: (a, b) => a.name.localeCompare(b.name) },
 *     { key: "version", label: "Version", compare: (a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }) },
 *   ],
 *   defaultSort: "displayName",
 * });
 *
 * // In JSX:
 * <SearchInput value={result.search} onChange={result.setSearch} />
 * <select value={result.sort} onChange={e => result.setSort(e.target.value)}>
 *   {sortFields.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
 * </select>
 * <div>{result.items.map(item => <PluginCard key={item.name} plugin={item} />)}</div>
 */
export function useFilteredList<T>(options: UseFilteredListOptions<T>): UseFilteredListReturn<T> {
  const { items, matchesSearch, filterPredicate, sortFields, defaultSort, defaultFilter } = options;
  const defaultFilterValue = defaultFilter ?? "all";
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState(defaultFilterValue);
  const [sort, setSort] = useState(defaultSort ?? sortFields[0]?.key ?? "");

  const hasActiveFilters = search.trim().length > 0 || filter !== defaultFilterValue;

  const clearFilters = useCallback(() => {
    setSearch("");
    setFilter(defaultFilterValue);
  }, [defaultFilterValue]);

  const result = useMemo(() => {
    const query = search.trim().toLowerCase();

    // Apply filter first, then search, then sort
    let filtered = items;
    if (filterPredicate) {
      filtered = filtered.filter(item => filterPredicate(item, filter));
    }
    if (query) {
      filtered = filtered.filter(item => matchesSearch(item, query));
    }

    const sortField = sortFields.find(f => f.key === sort);
    if (sortField) {
      filtered = [...filtered].sort(sortField.compare);
    }

    return filtered;
  }, [items, search, filter, sort, matchesSearch, filterPredicate, sortFields]);

  const filterCount = useMemo(() => {
    if (!filterPredicate) return items.length;
    return items.filter(item => filterPredicate(item, filter)).length;
  }, [items, filter, filterPredicate]);

  return {
    items: result,
    search,
    setSearch,
    filter,
    setFilter,
    sort,
    setSort,
    hasActiveFilters,
    clearFilters,
    filterCount,
    matchedCount: result.length,
  };
}
