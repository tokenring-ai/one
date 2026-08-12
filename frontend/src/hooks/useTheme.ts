import { useCallback, useEffect, useSyncExternalStore } from "react";
import { readLocalStorageState, writeLocalStorageState } from "./useLocalStorageState.ts";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isThemePreference(value: string): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStoredPreference(): ThemePreference {
  return readLocalStorageState<ThemePreference>(THEME_STORAGE_KEY, "system", {
    // Theme is stored as a raw string (not JSON-quoted), matching historical values.
    deserialize: raw => (isThemePreference(raw) ? raw : "system"),
  });
}

function resolveTheme(preference: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? system : preference;
}

function applyThemeClass(resolved: ResolvedTheme) {
  if (typeof document === "undefined") return;
  if (resolved === "dark") {
    document.documentElement.classList.add("dark");
  } else {
    document.documentElement.classList.remove("dark");
  }
}

/**
 * Module-level store so every `useTheme()` consumer (Settings, top-bar toggle,
 * editors) stays in sync. Per-instance useState desynced as soon as one caller
 * changed the preference — so we use shared read/write helpers rather than the
 * React hook itself.
 */
let preferenceStore: ThemePreference = readStoredPreference();
let systemThemeStore: ResolvedTheme = getSystemTheme();
const preferenceListeners = new Set<() => void>();
const systemListeners = new Set<() => void>();

function emitPreference() {
  for (const listener of preferenceListeners) listener();
}

function emitSystem() {
  for (const listener of systemListeners) listener();
}

function persistAndApply(preference: ThemePreference, system: ResolvedTheme) {
  applyThemeClass(resolveTheme(preference, system));
  writeLocalStorageState(THEME_STORAGE_KEY, preference, { serialize: String });
}

// Apply once at module load so the first paint matches storage before React mounts.
persistAndApply(preferenceStore, systemThemeStore);

function setPreferenceStore(next: ThemePreference) {
  if (preferenceStore === next) {
    // Re-apply in case DOM/storage drifted (e.g. after a partial clear).
    persistAndApply(preferenceStore, systemThemeStore);
    return;
  }
  preferenceStore = next;
  persistAndApply(preferenceStore, systemThemeStore);
  emitPreference();
}

let systemListening = false;
function ensureSystemListener() {
  if (systemListening || typeof window === "undefined") return;
  systemListening = true;
  const mql = window.matchMedia("(prefers-color-scheme: dark)");
  const onChange = (event: MediaQueryListEvent) => {
    systemThemeStore = event.matches ? "dark" : "light";
    applyThemeClass(resolveTheme(preferenceStore, systemThemeStore));
    emitSystem();
  };
  mql.addEventListener("change", onChange);
}

/** Test helper — re-read storage and reset module state between cases. */
export function resetThemeStoreForTests() {
  preferenceStore = readStoredPreference();
  systemThemeStore = getSystemTheme();
  persistAndApply(preferenceStore, systemThemeStore);
  emitPreference();
  emitSystem();
}

/**
 * Theme preference hook.
 *
 * Returns `[resolved, setTheme, preference]`:
 * - `resolved` — effective light/dark for UI (editors, icons)
 * - `setTheme` — set preference to light | dark | system
 * - `preference` — stored preference including "system"
 *
 * Existing `[theme, setTheme]` destructuring stays valid.
 */
export function useTheme() {
  ensureSystemListener();

  const preference = useSyncExternalStore(
    onStoreChange => {
      preferenceListeners.add(onStoreChange);
      return () => {
        preferenceListeners.delete(onStoreChange);
      };
    },
    () => preferenceStore,
    () => "system" as ThemePreference,
  );

  const systemTheme = useSyncExternalStore(
    onStoreChange => {
      systemListeners.add(onStoreChange);
      return () => {
        systemListeners.delete(onStoreChange);
      };
    },
    () => systemThemeStore,
    () => "light" as ResolvedTheme,
  );

  // Keep class in sync when system appearance changes while preference is "system".
  useEffect(() => {
    applyThemeClass(resolveTheme(preference, systemTheme));
  }, [preference, systemTheme]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreferenceStore(next);
  }, []);

  const resolved = resolveTheme(preference, systemTheme);
  return [resolved, setTheme, preference] as const;
}
