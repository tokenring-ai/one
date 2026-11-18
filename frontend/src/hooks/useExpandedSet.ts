import { useCallback, useEffect, useState } from "react";

export interface UseExpandedSetOptions {
  /**
   * When this key changes, all expanded items are collapsed.
   * Useful for resetting expansion when switching contexts (e.g., queues, agents).
   */
  resetKey?: unknown;
}

export interface UseExpandedSetReturn {
  /** Set of currently expanded item IDs */
  expandedIds: Set<string>;
  /** Check if a specific item is expanded */
  isExpanded: (id: string) => boolean;
  /** Toggle expansion state for a single item */
  toggle: (id: string) => void;
  /** Expand all provided IDs (replaces the entire set) */
  expandAll: (ids: readonly string[]) => void;
  /** Collapse all expanded items */
  collapseAll: () => void;
  /** Expand a single item (without toggling) */
  expand: (id: string) => void;
  /** Collapse a single item (without toggling) */
  collapse: (id: string) => void;
}

/**
 * Manage a Set of expanded/collapsed item IDs for expandable row lists.
 *
 * @example
 * const { isExpanded, toggle } = useExpandedSet();
 * // With auto-reset when context changes:
 * const { isExpanded, toggle } = useExpandedSet({ resetKey: selectedQueueName });
 */
export function useExpandedSet(options?: UseExpandedSetOptions): UseExpandedSetReturn {
  const { resetKey } = options ?? {};
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  // Auto-collapse when context changes
  useEffect(() => {
    setExpandedIds(new Set());
  }, [resetKey]);

  const isExpanded = useCallback((id: string) => expandedIds.has(id), [expandedIds]);

  const toggle = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const expandAll = useCallback((ids: readonly string[]) => {
    setExpandedIds(new Set(ids));
  }, []);

  const collapseAll = useCallback(() => {
    setExpandedIds(new Set());
  }, []);

  const expand = useCallback((id: string) => {
    setExpandedIds(prev => {
      if (prev.has(id)) return prev;
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  }, []);

  const collapse = useCallback((id: string) => {
    setExpandedIds(prev => {
      if (!prev.has(id)) return prev;
      const next = new Set(prev);
      next.delete(id);
      return next;
    });
  }, []);

  return { expandedIds, isExpanded, toggle, expandAll, collapseAll, expand, collapse };
}
