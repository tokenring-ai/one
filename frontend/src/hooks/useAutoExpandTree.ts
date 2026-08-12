import { useCallback, useEffect, useRef, useState } from "react";

export interface UseAutoExpandTreeOptions<T> {
  /** The list of tree nodes (e.g., topics, flows, categories) */
  items: readonly T[];
  /** Extract the node's unique key */
  getKey: (item: T) => string;
  /** Extract the item count (nodes with count > 0 qualify for auto-expand) */
  getCount: (item: T) => number;
  /** Agent ID; auto-expansion only active when an agent is running */
  agentId: string | null;
  /**
   * Whether to respect the user's manual collapse preferences.
   * When true, nodes the user has explicitly collapsed will not be
   * auto-expanded even when an agent creates items in them.
   * Default: false (always auto-expand while an agent runs).
   */
  respectUserCollapse?: boolean;
  /**
   * Optional: current expanded set from an external source (e.g. useExpandedSet).
   * When provided with setExternalExpandedSet, this hook merges into that set
   * rather than managing its own.
   */
  externalExpandedSet?: Set<string>;
  /**
   * Optional: callback to update the external expanded set.
   * Receives a function that transforms the previous set to the next set.
   */
  setExternalExpandedSet?: (updater: (prev: Set<string>) => Set<string>) => void;
}

export interface UseAutoExpandTreeReturn {
  /** Set of currently expanded node keys */
  expandedKeys: Set<string>;
  /** Set of user-manually collapsed keys (only populated when respectUserCollapse is true) */
  userCollapsedKeys: Set<string>;
  /** Check if a node is expanded */
  isExpanded: (key: string) => boolean;
  /** Toggle a node's expansion state (respects user collapse tracking) */
  toggle: (key: string) => void;
  /** Expand a specific node (clears any user-collapse mark for that key) */
  expand: (key: string) => void;
  /** Collapse a specific node (marks user-collapsed when respectUserCollapse is true) */
  collapse: (key: string) => void;
}

/**
 * Auto-expand tree/sidebar nodes while an agent is creating items inside them.
 * Optionally respects nodes the user has manually collapsed.
 *
 * Can own expansion state (standalone) or merge into an external Set via
 * externalExpandedSet + setExternalExpandedSet.
 *
 * @example
 * // Research topics — respect manual collapses
 * const { expandedKeys, toggle, expand } = useAutoExpandTree({
 *   items: topics,
 *   getKey: t => t.name,
 *   getCount: t => t.itemCount,
 *   agentId,
 *   respectUserCollapse: true,
 * });
 *
 * // Design flows — always expand while agent runs
 * const { expandedKeys, toggle } = useAutoExpandTree({
 *   items: flows,
 *   getKey: f => f.name,
 *   getCount: f => f.designCount,
 *   agentId,
 * });
 */
export function useAutoExpandTree<T>(options: UseAutoExpandTreeOptions<T>): UseAutoExpandTreeReturn {
  const { items, getKey, getCount, agentId, respectUserCollapse = false, externalExpandedSet, setExternalExpandedSet } = options;

  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(() => new Set());
  const userCollapsedRef = useRef<Set<string>>(new Set());

  // Keep extractors in refs so callers can pass inline lambdas without re-firing auto-expand every render.
  const getKeyRef = useRef(getKey);
  const getCountRef = useRef(getCount);
  getKeyRef.current = getKey;
  getCountRef.current = getCount;

  const applyUpdate = useCallback(
    (updater: (prev: Set<string>) => Set<string>) => {
      if (setExternalExpandedSet) {
        setExternalExpandedSet(updater);
      } else {
        setInternalExpanded(updater);
      }
    },
    [setExternalExpandedSet],
  );

  // Auto-expand when agent is active and items change
  useEffect(() => {
    if (!agentId) return;

    applyUpdate(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const item of items) {
        const key = getKeyRef.current(item);
        if (getCountRef.current(item) > 0 && !next.has(key) && !userCollapsedRef.current.has(key)) {
          next.add(key);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agentId, items, applyUpdate]);

  const allExpanded = externalExpandedSet ?? internalExpanded;

  const isExpanded = useCallback((key: string) => allExpanded.has(key), [allExpanded]);

  const toggle = useCallback(
    (key: string) => {
      applyUpdate(prev => {
        const next = new Set(prev);
        if (next.has(key)) {
          next.delete(key);
          if (respectUserCollapse) userCollapsedRef.current.add(key);
        } else {
          next.add(key);
          userCollapsedRef.current.delete(key);
        }
        return next;
      });
    },
    [respectUserCollapse, applyUpdate],
  );

  const expand = useCallback(
    (key: string) => {
      userCollapsedRef.current.delete(key);
      applyUpdate(prev => {
        if (prev.has(key)) return prev;
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    },
    [applyUpdate],
  );

  const collapse = useCallback(
    (key: string) => {
      if (respectUserCollapse) userCollapsedRef.current.add(key);
      applyUpdate(prev => {
        if (!prev.has(key)) return prev;
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    },
    [respectUserCollapse, applyUpdate],
  );

  return {
    expandedKeys: allExpanded,
    userCollapsedKeys: userCollapsedRef.current,
    isExpanded,
    toggle,
    expand,
    collapse,
  };
}
