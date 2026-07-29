import { useCallback, useEffect, useState } from "react";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

const THEME_STORAGE_KEY = "theme";

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function readStoredPreference(): ThemePreference {
  if (typeof window === "undefined") return "system";
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {
    // localStorage unavailable
  }
  // No stored preference — follow the OS (matches prior first-load behavior)
  return "system";
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
  const [preference, setPreferenceState] = useState<ThemePreference>(() => {
    const pref = readStoredPreference();
    applyThemeClass(resolveTheme(pref, getSystemTheme()));
    return pref;
  });
  const [systemTheme, setSystemTheme] = useState<ResolvedTheme>(() => getSystemTheme());

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = (event: MediaQueryListEvent) => {
      setSystemTheme(event.matches ? "dark" : "light");
    };
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  const resolved = resolveTheme(preference, systemTheme);

  useEffect(() => {
    applyThemeClass(resolved);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, preference);
    } catch {
      // localStorage unavailable — theme still applies for this session
    }
  }, [preference, resolved]);

  const setTheme = useCallback((next: ThemePreference) => {
    setPreferenceState(next);
  }, []);

  return [resolved, setTheme, preference] as const;
}
