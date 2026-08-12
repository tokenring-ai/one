import { createContext, type ReactNode, useCallback, useContext, useMemo, useState } from "react";
import { useLocalStorageState } from "../../hooks/useLocalStorageState.ts";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { APP_REGISTRY, DEFAULT_PINNED_APP_IDS } from "./AppRegistry.ts";

interface AppShellContextType {
  isAppSwitcherOpen: boolean;
  setAppSwitcherOpen: (open: boolean) => void;
  toggleAppSwitcher: () => void;
  pinnedAppIds: string[];
  setPinnedAppIds: (ids: string[]) => void;
  togglePinnedApp: (id: string) => boolean;
  recentApps: RecentAppEntry[];
  recordRecentApp: (id: string) => void;
  resetToDefaults: () => void;
  localStorageAvailable: boolean;
}

const AppShellContext = createContext<AppShellContextType | undefined>(undefined);
const PINNED_APPS_STORAGE_KEY = "tokenring-pinned-apps";
const RECENT_APPS_STORAGE_KEY = "tokenring-recent-apps";
export const MAX_PINNED_APPS = 7;
export const MAX_RECENT_APPS = 5;

export interface RecentAppEntry {
  id: string;
  lastVisitedAt: number;
}

function sanitizeAppIds(value: unknown, limit: number, excludeSettings = false): string[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(APP_REGISTRY.filter(app => !excludeSettings || app.id !== "settings").map(app => app.id));
  const sanitized = value.filter((id): id is string => typeof id === "string" && validIds.has(id));
  return [...new Set(sanitized)].slice(0, limit);
}

function sanitizeRecentApps(value: unknown): RecentAppEntry[] {
  if (!Array.isArray(value)) return [];
  const validIds = new Set(APP_REGISTRY.filter(app => app.id !== "settings").map(app => app.id));
  const migrationTime = Date.now();
  const entries: RecentAppEntry[] = [];

  value.forEach((item, index) => {
    const id =
      typeof item === "string"
        ? item
        : typeof item === "object" && item !== null && typeof (item as { id?: unknown }).id === "string"
          ? (item as { id: string }).id
          : null;
    if (!id || !validIds.has(id)) return;
    const storedTimestamp = typeof item === "object" && item !== null ? (item as { lastVisitedAt?: unknown }).lastVisitedAt : undefined;
    const lastVisitedAt = typeof storedTimestamp === "number" && Number.isFinite(storedTimestamp) ? storedTimestamp : migrationTime - index;
    const existing = entries.find(entry => entry.id === id);
    if (existing) existing.lastVisitedAt = Math.max(existing.lastVisitedAt, lastVisitedAt);
    else entries.push({ id, lastVisitedAt });
  });

  while (entries.length > MAX_RECENT_APPS) {
    const leastRecent = entries.reduce((oldestIndex, entry, index) => (entry.lastVisitedAt < entries[oldestIndex]!.lastVisitedAt ? index : oldestIndex), 0);
    entries.splice(leastRecent, 1);
  }
  return entries;
}

function deserializePinnedApps(raw: string): string[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [...DEFAULT_PINNED_APP_IDS];
    return sanitizeAppIds(parsed, MAX_PINNED_APPS);
  } catch {
    return [...DEFAULT_PINNED_APP_IDS];
  }
}

function deserializeRecentApps(raw: string): RecentAppEntry[] {
  try {
    return sanitizeRecentApps(JSON.parse(raw));
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

export function AppShellProvider({ children }: { children: ReactNode }) {
  const [isAppSwitcherOpen, setAppSwitcherOpen] = useState(false);
  const [localStorageAvailable, setLocalStorageAvailable] = useState(canUseLocalStorage);

  const markStorageUnavailable = useCallback(() => {
    setLocalStorageAvailable(false);
  }, []);

  const [pinnedAppIds, setPinnedAppIdsState] = useLocalStorageState<string[]>(PINNED_APPS_STORAGE_KEY, [...DEFAULT_PINNED_APP_IDS], {
    deserialize: deserializePinnedApps,
    onError: markStorageUnavailable,
  });

  const [recentApps, setRecentApps] = useLocalStorageState<RecentAppEntry[]>(RECENT_APPS_STORAGE_KEY, [], {
    deserialize: raw => deserializeRecentApps(raw).filter(entry => !pinnedAppIds.includes(entry.id)),
    onError: markStorageUnavailable,
  });

  // On first mount, drop recent entries that are already pinned (matches prior init filter).
  // The deserialize above only runs when reading storage; functional updates still need the filter in setters.
  const pinnedAppIdsRef = useRefSync(pinnedAppIds);

  const setPinnedAppIds = useCallback(
    (nextIds: string[]) => {
      const validIds = new Set(APP_REGISTRY.map(app => app.id));
      const sanitized = [...new Set(nextIds.filter(id => validIds.has(id)))].slice(0, MAX_PINNED_APPS);
      setPinnedAppIdsState(sanitized);
    },
    [setPinnedAppIdsState],
  );

  const togglePinnedApp = useCallback(
    (id: string) => {
      if (pinnedAppIds.includes(id)) {
        setPinnedAppIds(pinnedAppIds.filter(pinnedId => pinnedId !== id));
        return true;
      }
      if (pinnedAppIds.length >= MAX_PINNED_APPS) return false;
      setPinnedAppIds([...pinnedAppIds, id]);
      setRecentApps(current => current.filter(entry => entry.id !== id));
      return true;
    },
    [pinnedAppIds, setPinnedAppIds, setRecentApps],
  );

  const recordRecentApp = useCallback(
    (id: string) => {
      if (pinnedAppIdsRef.current.includes(id) || !APP_REGISTRY.some(app => app.id === id && app.id !== "settings")) return;
      setRecentApps(current => {
        const lastVisitedAt = Date.now();
        const existingIndex = current.findIndex(entry => entry.id === id);
        let next: RecentAppEntry[];
        if (existingIndex >= 0) {
          next = current.map((entry, index) => (index === existingIndex ? { ...entry, lastVisitedAt } : entry));
        } else {
          next = [...current];
          if (next.length >= MAX_RECENT_APPS) {
            const leastRecent = next.reduce((oldestIndex, entry, index) => (entry.lastVisitedAt < next[oldestIndex]!.lastVisitedAt ? index : oldestIndex), 0);
            next.splice(leastRecent, 1);
          }
          next.push({ id, lastVisitedAt });
        }
        return next;
      });
    },
    [setRecentApps],
  );

  const toggleAppSwitcher = useCallback(() => setAppSwitcherOpen(open => !open), []);
  const resetToDefaults = useCallback(() => {
    setPinnedAppIds([...DEFAULT_PINNED_APP_IDS]);
    setRecentApps([]);
    setAppSwitcherOpen(false);
  }, [setPinnedAppIds, setRecentApps]);

  const value = useMemo<AppShellContextType>(
    () => ({
      isAppSwitcherOpen,
      setAppSwitcherOpen,
      toggleAppSwitcher,
      pinnedAppIds,
      setPinnedAppIds,
      togglePinnedApp,
      recentApps,
      recordRecentApp,
      resetToDefaults,
      localStorageAvailable,
    }),
    [isAppSwitcherOpen, localStorageAvailable, pinnedAppIds, recentApps, recordRecentApp, resetToDefaults, setPinnedAppIds, toggleAppSwitcher, togglePinnedApp],
  );

  return <AppShellContext.Provider value={value}>{children}</AppShellContext.Provider>;
}

export function useAppShell() {
  const context = useContext(AppShellContext);
  if (!context) throw new Error("useAppShell must be used within an AppShellProvider");
  return context;
}
