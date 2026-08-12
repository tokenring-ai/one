import { useCallback, useState } from "react";
import { useRefSync } from "./useRefSync.ts";

export interface UseTabStateOptions<T extends string> {
  /** Default tab when none is explicitly selected. Falls back to `tabIds[0]`. */
  defaultTab?: T;
  /**
   * Fired when the active tab actually changes (via `setActiveTab` or `resetTab`).
   * Use this to clear related search/filter state for the new tab context.
   */
  onTabChange?: (newTab: T, oldTab: T) => void;
}

export interface UseTabStateReturn<T extends string> {
  /** Currently selected tab */
  activeTab: T;
  /** Select a tab; no-ops (and does not call `onTabChange`) when already active */
  setActiveTab: (tab: T) => void;
  /** Return to the default tab (e.g. when the parent entity changes) */
  resetTab: () => void;
}

/**
 * Manages tab selection with an optional change callback for resetting related UI state.
 *
 * Counts and labels stay with the caller (typically `useFilterTabs` for counted tabs).
 * This hook only owns which tab is active.
 *
 * @example
 * const { activeTab, setActiveTab, resetTab } = useTabState(
 *   ["conversations", "channels", "people"] as const,
 *   {
 *     defaultTab: "conversations",
 *     onTabChange: () => {
 *       setQuery("");
 *       setSubFilter("all");
 *     },
 *   },
 * );
 */
export function useTabState<T extends string>(tabIds: readonly T[], options?: UseTabStateOptions<T>): UseTabStateReturn<T> {
  const defaultTab = options?.defaultTab ?? tabIds[0];
  if (defaultTab === undefined) {
    throw new Error("useTabState requires a non-empty tabIds array or an explicit defaultTab");
  }

  const [activeTab, setActiveTabState] = useState<T>(defaultTab);
  const activeTabRef = useRefSync(activeTab);
  const defaultTabRef = useRefSync(defaultTab);
  const onTabChangeRef = useRefSync(options?.onTabChange);

  const setActiveTab = useCallback(
    (tab: T) => {
      const current = activeTabRef.current;
      if (current === tab) return;
      setActiveTabState(tab);
      onTabChangeRef.current?.(tab, current);
    },
    [activeTabRef, onTabChangeRef],
  );

  const resetTab = useCallback(() => {
    const next = defaultTabRef.current;
    const current = activeTabRef.current;
    if (current === next) return;
    setActiveTabState(next);
    onTabChangeRef.current?.(next, current);
  }, [activeTabRef, defaultTabRef, onTabChangeRef]);

  return {
    activeTab,
    setActiveTab,
    resetTab,
  };
}
