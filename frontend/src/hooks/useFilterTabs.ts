import { useMemo } from "react";
import type { FilterTabOption } from "../components/ui/FilterTabs.tsx";

export interface FilterTabDefinition<T, F extends string> {
  id: F;
  label: string;
  /** Predicate to count matching items. Omit for "all" tab (count = items.length). */
  predicate?: (item: T) => boolean;
}

export interface UseFilterTabsReturn<F extends string> {
  tabs: FilterTabOption<F>[];
}

/**
 * Builds `FilterTabOption[]` with counts derived from a data list and filter predicates.
 *
 * Prefer stable `definitions` (module-level constant or `useMemo` with `[]`) so the
 * hook only recomputes when `items` change.
 *
 * @example
 * const AGENT_TAB_DEFS: FilterTabDefinition<AgentRow, AgentFilter>[] = [
 *   { id: "all", label: "All" },
 *   { id: "active", label: "Active", predicate: a => !a.idle },
 *   { id: "idle", label: "Idle", predicate: a => a.idle },
 * ];
 *
 * const { tabs: agentTabs } = useFilterTabs(agents, AGENT_TAB_DEFS);
 */
export function useFilterTabs<T, F extends string>(items: T[], definitions: FilterTabDefinition<T, F>[]): UseFilterTabsReturn<F> {
  const tabs = useMemo<FilterTabOption<F>[]>(
    () =>
      definitions.map(def => ({
        id: def.id,
        label: def.label,
        count: def.predicate ? items.filter(def.predicate).length : items.length,
      })),
    [items, definitions],
  );

  return { tabs };
}
