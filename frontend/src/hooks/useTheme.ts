import { useCallback } from "react";
import {
  type ResolvedTheme,
  resolveMode,
  resolveThemeDef,
  setThemeAccent,
  setThemeDensity,
  setThemePreference,
  type ThemePreference,
  useThemeState,
} from "../theme/themeStore.ts";
import { THEME_FOR_MODE, type ThemeDef } from "../theme/themes.ts";

export type { ResolvedTheme, ThemePreference } from "../theme/themeStore.ts";
export { resetThemeStoreForTests } from "../theme/themeStore.ts";

/**
 * Page chrome colours per mode (the html background and theme-color meta).
 * Derived from the ThemeDefs; applyTheme.ts keeps the document in step.
 */
export const THEME_CHROME_COLORS: Record<ResolvedTheme, string> = {
  light: THEME_FOR_MODE.light.surface.canvas,
  dark: THEME_FOR_MODE.dark.surface.canvas,
};

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
  const state = useThemeState();
  const setTheme = useCallback((next: ThemePreference) => {
    setThemePreference(next);
  }, []);
  const resolved = resolveMode(state.preference, state.system);
  return [resolved, setTheme, state.preference] as const;
}

/** The full appearance state (theme, accent, density) and its setters. */
export function useThemeSettings() {
  const state = useThemeState();
  const theme: ThemeDef = resolveThemeDef(state);
  return {
    preference: state.preference,
    resolved: theme.mode,
    theme,
    accent: state.accent,
    density: state.density,
    setPreference: setThemePreference,
    setAccent: setThemeAccent,
    setDensity: setThemeDensity,
  };
}
