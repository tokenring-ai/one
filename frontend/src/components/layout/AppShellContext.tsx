import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { DEFAULT_PINNED_DASHBOARD_IDS, VISIBLE_DASHBOARD_MANIFESTS } from "../../shell/appCatalog.ts";

interface AppShellContextType {
  isSwitcherOpen: boolean;
  setSwitcherOpen: (open: boolean) => void;
  toggleSwitcher: () => void;
  pinnedDashboardIds: string[];
  setPinnedDashboardIds: (ids: string[]) => void;
  togglePinnedDashboard: (id: string) => boolean;
  recentDashboards: RecentDashboardEntry[];
  recordRecentDashboard: (id: string) => void;
  resetToDefaults: () => void;
  localStorageAvailable: boolean;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);
export const PINNED_DASHBOARDS_STORAGE_KEY = "tokenring-pinned-dashboards";
export const RECENT_DASHBOARDS_STORAGE_KEY = "tokenring-recent-dashboards";
/** Keys used before dashboards replaced apps; read once and renamed. */
const LEGACY_STORAGE_KEYS: ReadonlyArray<readonly [legacy: string, current: string]> = [
  ["tokenring-pinned-apps", PINNED_DASHBOARDS_STORAGE_KEY],
  ["tokenring-recent-apps", RECENT_DASHBOARDS_STORAGE_KEY],
];
export const MAX_PINNED_DASHBOARDS = 7;
export const MAX_RECENT_DASHBOARDS = 5;

export interface RecentDashboardEntry {
  id: string;
  lastVisitedAt: number;
}

/** Settings is reachable from the rail's own button, so it is never pinned or recent. */
const PINNABLE_IDS = new Set(VISIBLE_DASHBOARD_MANIFESTS.filter(dashboard => dashboard.id !== "settings").map(dashboard => dashboard.id));

function sanitizeDashboardIds(value: unknown, limit: number): string[] {
  if (!Array.isArray(value)) return [];
  const sanitized = value.filter((id): id is string => typeof id === "string" && PINNABLE_IDS.has(id));
  return [...new Set(sanitized)].slice(0, limit);
}

function sanitizeRecentDashboards(value: unknown): RecentDashboardEntry[] {
  if (!Array.isArray(value)) return [];
  const migrationTime = Date.now();
  const entries: RecentDashboardEntry[] = [];

  value.forEach((item, index) => {
    const id =
      typeof item === "string"
        ? item
        : typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id
          : null;
    if (!id || !PINNABLE_IDS.has(id)) return;
    const storedTimestamp = typeof item === "object" && item !== null ? (item as { lastVisitedAt?: unknown }).lastVisitedAt : undefined;
    const lastVisitedAt = typeof storedTimestamp === "number" && Number.isFinite(storedTimestamp) ? storedTimestamp : migrationTime - index;
    const existing = entries.find(entry => entry.id === id);
    if (existing) existing.lastVisitedAt = Math.max(existing.lastVisitedAt, lastVisitedAt);
    else entries.push({ id, lastVisitedAt });
  });

  while (entries.length > MAX_RECENT_DASHBOARDS) {
    const leastRecent = entries.reduce((oldestIndex, entry, index) => (entry.lastVisitedAt < entries[oldestIndex]!.lastVisitedAt ? index : oldestIndex), 0);
    entries.splice(leastRecent, 1);
  }
  return entries;
}

function deserializePinnedDashboards(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PINNED_DASHBOARD_IDS];
    return sanitizeDashboardIds(parsed, MAX_PINNED_DASHBOARDS);
  } catch {
    return [...DEFAULT_PINNED_DASHBOARD_IDS];
  }
}

function deserializeRecentDashboards(raw: string): RecentDashboardEntry[] {
  try {
    return sanitizeRecentDashboards(JSON.parse(raw));
  } catch {
    return [];
  }
}

function canUseLocalStorage(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = "__tokenring_storage_test__";
    localStorage.setItem(key, key);
    localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

/** Moves pre-dashboard pin/recent storage to the current keys. Safe to run repeatedly. */
export function migrateLegacyShellStorage(): void {
  if (typeof window === "undefined") return;
  try {
    for (const [legacy, current] of LEGACY_STORAGE_KEYS) {
      const value = localStorage.getItem(legacy);
      if (value === null) continue;
      if (localStorage.getItem(current) === null) localStorage.setItem(current, value);
      localStorage.removeItem(legacy);
    }
  } catch {
    // Storage unavailable; the hooks below report it.
  }
}

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [isSwitcherOpen, setSwitcherOpen] = useState(false);
  const [localStorageAvailable, setLocalStorageAvailable] = useState(() => {
    migrateLegacyShellStorage();
    return canUseLocalStorage();
  });

  const markStorageUnavailable = useCallback(() => {
    setLocalStorageAvailable(false);
  }, []);

  const [pinnedDashboardIds, setPinnedDashboardIdsState] = useLocalStorageState<string[]>(PINNED_DASHBOARDS_STORAGE_KEY, [...DEFAULT_PINNED_DASHBOARD_IDS], {
    deserialize: deserializePinnedDashboards,
    onError: markStorageUnavailable,
  });

  const [recentDashboards, setRecentDashboards] = useLocalStorageState<RecentDashboardEntry[]>(RECENT_DASHBOARDS_STORAGE_KEY, [], {
    deserialize: raw => deserializeRecentDashboards(raw).filter(entry => !pinnedDashboardIds.includes(entry.id)),
    onError: markStorageUnavailable,
  });

  // The deserialize above only runs when reading storage; functional updates still need the filter in setters.
  const pinnedDashboardIdsRef = useRefSync(pinnedDashboardIds);

  const setPinnedDashboardIds = useCallback(
    (nextIds: string[]) => {
      setPinnedDashboardIdsState(sanitizeDashboardIds(nextIds, MAX_PINNED_DASHBOARDS));
    },
    [setPinnedDashboardIdsState],
  );

  const togglePinnedDashboard = useCallback(
    (id: string) => {
      if (pinnedDashboardIds.includes(id)) {
        setPinnedDashboardIds(pinnedDashboardIds.filter(pinnedId => pinnedId !== id));
        return true;
      }
      if (pinnedDashboardIds.length >= MAX_PINNED_DASHBOARDS) return false;
      setPinnedDashboardIds([...pinnedDashboardIds, id]);
      setRecentDashboards(current => current.filter(entry => entry.id !== id));
      return true;
    },
    [pinnedDashboardIds, setPinnedDashboardIds, setRecentDashboards],
  );

  const recordRecentDashboard = useCallback(
    (id: string) => {
      if (pinnedDashboardIdsRef.current.includes(id) || !PINNABLE_IDS.has(id)) return;
      setRecentDashboards(current => {
        const lastVisitedAt = Date.now();
        const existingIndex = current.findIndex(entry => entry.id === id);
        let next: RecentDashboardEntry[];
        if (existingIndex >= 0) {
          next = current.map((entry, index) => (index === existingIndex ? { ...entry, lastVisitedAt } : entry));
        } else {
          next = [...current];
          if (next.length >= MAX_RECENT_DASHBOARDS) {
            const leastRecent = next.reduce((oldestIndex, entry, index) => (entry.lastVisitedAt < next[oldestIndex]!.lastVisitedAt ? index : oldestIndex), 0);
            next.splice(leastRecent, 1);
          }
          next.push({ id, lastVisitedAt });
        }
        return next;
      });
    },
    [setRecentDashboards],
  );

  const toggleSwitcher = useCallback(() => setSwitcherOpen(open => !open), []);
  const resetToDefaults = useCallback(() => {
    setPinnedDashboardIds([...DEFAULT_PINNED_DASHBOARD_IDS]);
    setRecentDashboards([]);
    setSwitcherOpen(false);
  }, [setPinnedDashboardIds, setRecentDashboards]);

  const value = useMemo<AppShellContextType>(
    () => ({
      isSwitcherOpen,
      setSwitcherOpen,
      toggleSwitcher,
      pinnedDashboardIds,
      setPinnedDashboardIds,
      togglePinnedDashboard,
      recentDashboards,
      recordRecentDashboard,
      resetToDefaults,
      localStorageAvailable,
    }),
    [
      isSwitcherOpen,
      localStorageAvailable,
      pinnedDashboardIds,
      recentDashboards,
      recordRecentDashboard,
      resetToDefaults,
      setPinnedDashboardIds,
      toggleSwitcher,
      togglePinnedDashboard,
    ],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error("useAppShell must be used within an AppShellProvider");
  return context;
}
