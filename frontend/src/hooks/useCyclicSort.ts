import { useCallback, useRef, useState } from "react";

export interface SortOrder {
  column: string;
  direction: "asc" | "desc";
}

export interface UseCyclicSortOptions {
  /** Callback invoked when sort changes (e.g., to reset pagination) */
  onSortChange?: () => void;
}

export interface UseCyclicSortReturn {
  /** Current sort order, or empty array if no sort is active */
  orderBy: SortOrder[];
  /** The currently sorted column, or null */
  sortedColumn: string | null;
  /** The current sort direction for the active column, or null */
  sortedDirection: "asc" | "desc" | null;
  /**
   * Cycle sort for a column: no sort → asc → desc → no sort.
   * If a different column is clicked, replaces the current sort.
   */
  handleSort: (column: string) => void;
  /** Clear the sort */
  clearSort: () => void;
  /** Get the sort direction for a specific column (for rendering sort icons) */
  getDirection: (column: string) => "asc" | "desc" | null;
}

/**
 * Manage single-column cyclic sort state for data tables.
 *
 * @example
 * const { orderBy, handleSort, getDirection } = useCyclicSort({
 *   onSortChange: () => setOffset(0),
 * });
 *
 * // In column header:
 * <button onClick={() => handleSort(column.name)}>
 *   {column.name}
 *   {getDirection(column.name) === "asc" && <ArrowUp />}
 *   {getDirection(column.name) === "desc" && <ArrowDown />}
 * </button>
 *
 * // Pass to query:
 * const data = useQuery({ orderBy: orderBy.length > 0 ? orderBy : undefined });
 */
export function useCyclicSort(options?: UseCyclicSortOptions): UseCyclicSortReturn {
  const { onSortChange } = options ?? {};
  const [orderBy, setOrderBy] = useState<SortOrder[]>([]);
  // Keep the latest callback without forcing handleSort/clearSort to change identity.
  const onSortChangeRef = useRef(onSortChange);
  onSortChangeRef.current = onSortChange;

  const sortedColumn = orderBy.length > 0 ? orderBy[0]!.column : null;
  const sortedDirection = orderBy.length > 0 ? orderBy[0]!.direction : null;

  const handleSort = useCallback((column: string) => {
    setOrderBy(prev => {
      const existing = prev.find(order => order.column === column);
      if (!existing) return [{ column, direction: "asc" }];
      if (existing.direction === "asc") return [{ column, direction: "desc" }];
      return [];
    });
    onSortChangeRef.current?.();
  }, []);

  const clearSort = useCallback(() => {
    setOrderBy([]);
    onSortChangeRef.current?.();
  }, []);

  const getDirection = useCallback(
    (column: string): "asc" | "desc" | null => {
      const order = orderBy.find(o => o.column === column);
      return order?.direction ?? null;
    },
    [orderBy],
  );

  return { orderBy, sortedColumn, sortedDirection, handleSort, clearSort, getDirection };
}
