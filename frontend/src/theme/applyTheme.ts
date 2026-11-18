import { installMixTokens } from "./mixTokens.ts";
import { ACCENTS, type AccentId, type Density, type ThemeDef } from "./themes.ts";

export interface ResolvedThemeState {
  theme: ThemeDef;
  accent: AccentId;
  density: Density;
}

/** What the index.html first-paint script reads. Keep the shape in step with it. */
export interface ThemeBootCache {
  mode: ThemeDef["mode"];
  bg: string;
  accent: string;
  density: Density;
}

export const THEME_BOOT_CACHE_KEY = "theme-boot";

/** Inline variables applyTheme sets on <html>; they win over tokens.css in both modes. */
export const ACCENT_VARIABLES = ["--accent-primary", "--accent-primary-hover", "--accent-primary-soft"] as const;

function applyChrome(color: string) {
  document.documentElement.style.backgroundColor = color;
  let meta = document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
  }
  meta.content = color;
}

function writeBootCache(cache: ThemeBootCache) {
  try {
    localStorage.setItem(THEME_BOOT_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // No storage: the bootstrap falls back to its built-in colours.
  }
}

/**
 * Apply a resolved theme to the document: the `.dark` class (Tailwind's `dark:`
 * variant and tokens.css key off it), `data-theme` / `data-density`, the accent
 * override, and the page chrome (html background, theme-color meta) that the
 * index.html bootstrap painted before first render. Also refreshes the cache that
 * bootstrap reads on the next load.
 */
export function applyTheme({ theme, accent, density }: ResolvedThemeState): void {
  if (typeof document === "undefined") return;
  installMixTokens();
  const root = document.documentElement;
  root.classList.toggle("dark", theme.mode === "dark");
  root.setAttribute("data-theme", theme.id);
  root.setAttribute("data-density", density);

  const def = ACCENTS[accent];
  const shades = def[theme.mode];
  root.style.setProperty("--accent-primary", def.color);
  root.style.setProperty("--accent-primary-hover", shades.hover);
  root.style.setProperty("--accent-primary-soft", shades.soft);

  applyChrome(theme.surface.canvas);
  writeBootCache({ mode: theme.mode, bg: theme.surface.canvas, accent: def.color, density });
}
