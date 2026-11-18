import { useSyncExternalStore } from "react";
import { readLocalStorageState, writeLocalStorageState } from "../hooks/useLocalStorageState.ts";
import { applyTheme } from "./applyTheme.ts";
import { type AccentId, DEFAULT_ACCENT, DEFAULT_DENSITY, type Density, isAccentId, isDensity, THEME_FOR_MODE, type ThemeDef } from "./themes.ts";

export type ThemePreference = "light" | "dark" | "system";
export type ResolvedTheme = "light" | "dark";

/** Raw-string keys (not JSON-quoted). "theme" keeps its historical format. */
export const THEME_STORAGE_KEY = "theme";
export const ACCENT_STORAGE_KEY = "theme-accent";
export const DENSITY_STORAGE_KEY = "theme-density";

export interface ThemeStoreState {
  preference: ThemePreference;
  system: ResolvedTheme;
  accent: AccentId;
  density: Density;
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "light";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function isThemePreference(value: string): value is ThemePreference {
  return value === "light" || value === "dark" || value === "system";
}

function readStored(): ThemeStoreState {
  return {
    preference: readLocalStorageState<ThemePreference>(THEME_STORAGE_KEY, "system", {
      deserialize: raw => (isThemePreference(raw) ? raw : "system"),
    }),
    system: getSystemTheme(),
    accent: readLocalStorageState<AccentId>(ACCENT_STORAGE_KEY, DEFAULT_ACCENT, { deserialize: raw => (isAccentId(raw) ? raw : DEFAULT_ACCENT) }),
    density: readLocalStorageState<Density>(DENSITY_STORAGE_KEY, DEFAULT_DENSITY, { deserialize: raw => (isDensity(raw) ? raw : DEFAULT_DENSITY) }),
  };
}

export function resolveMode(preference: ThemePreference, system: ResolvedTheme): ResolvedTheme {
  return preference === "system" ? system : preference;
}

/** Light resolves to Paper, dark to Charcoal. */
export function resolveThemeDef(state: Pick<ThemeStoreState, "preference" | "system">): ThemeDef {
  return THEME_FOR_MODE[resolveMode(state.preference, state.system)];
}

/**
 * Module-level store so every consumer (Settings, top-bar toggle, editors,
 * terminals) stays in sync; per-instance state desynced as soon as one caller
 * changed the preference.
 */
let state: ThemeStoreState = readStored();
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

function applyState() {
  applyTheme({ theme: resolveThemeDef(state), accent: state.accent, density: state.density });
}

function persist() {
  const raw = { serialize: String };
  writeLocalStorageState(THEME_STORAGE_KEY, state.preference, raw);
  writeLocalStorageState(ACCENT_STORAGE_KEY, state.accent, raw);
  writeLocalStorageState(DENSITY_STORAGE_KEY, state.density, raw);
}

// Apply once at module load so the first paint matches storage before React mounts.
applyState();
persist();

export function getThemeState(): ThemeStoreState {
  return state;
}

export function subscribeTheme(listener: () => void): () => void {
  ensureSystemListener();
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function update(patch: Partial<ThemeStoreState>) {
  const next = { ...state, ...patch };
  const changed = (Object.keys(patch) as (keyof ThemeStoreState)[]).some(key => state[key] !== next[key]);
  if (changed) state = next;
  // Re-apply even when unchanged, in case DOM/storage drifted (e.g. after a partial clear).
  applyState();
  persist();
  if (changed) emit();
}

export function setThemePreference(preference: ThemePreference): void {
  update({ preference });
}

export function setThemeAccent(accent: AccentId): void {
  update({ accent });
}

export function setThemeDensity(density: Density): void {
  update({ density });
}

let systemListening = false;
function ensureSystemListener() {
  if (systemListening || typeof window === "undefined" || typeof window.matchMedia !== "function") return;
  systemListening = true;
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", event => {
    state = { ...state, system: event.matches ? "dark" : "light" };
    applyState();
    emit();
  });
}

/** Test helper: re-read storage and reset module state between cases. */
export function resetThemeStoreForTests(): void {
  state = readStored();
  applyState();
  persist();
  emit();
}

const SERVER_STATE: ThemeStoreState = { preference: "system", system: "light", accent: DEFAULT_ACCENT, density: DEFAULT_DENSITY };

/** The whole theme store; re-renders on any theme, accent or density change. */
export function useThemeState(): ThemeStoreState {
  return useSyncExternalStore(subscribeTheme, getThemeState, () => SERVER_STATE);
}

/**
 * The live accent. Lives here rather than in hooks/useTheme.ts so components
 * whose tests mock that module (editors, terminals) still read it.
 */
export function useThemeAccent(): AccentId {
  return useSyncExternalStore(
    subscribeTheme,
    () => state.accent,
    () => DEFAULT_ACCENT,
  );
}
