/**
 * Theme definitions. `tokens.css` holds the same values as CSS variables for
 * components; this file is the concrete copy for libraries that cannot read CSS
 * variables (Monaco, xterm) and for the page chrome. `tokens.test.ts` keeps the
 * two in step.
 */

export type ThemeId = "paper" | "charcoal";
export type ThemeMode = "light" | "dark";
export type AccentId = "indigo" | "teal" | "amber" | "rose" | "slate";
export type Density = "compact" | "default" | "comfortable";

export interface TerminalAnsi {
  black: string;
  red: string;
  green: string;
  yellow: string;
  blue: string;
  magenta: string;
  cyan: string;
  white: string;
  brightBlack: string;
  brightRed: string;
  brightGreen: string;
  brightYellow: string;
  brightBlue: string;
  brightMagenta: string;
  brightCyan: string;
  brightWhite: string;
}

export interface ThemeDef {
  id: ThemeId;
  label: string;
  mode: ThemeMode;
  surface: {
    /** App background (`--bg-primary`). */
    canvas: string;
    /** Panels and cards (`--bg-secondary`). */
    base: string;
    /** Popovers and lifted panes (`--surface-raised`). */
    raised: string;
    /** Wells and tracks (`--bg-tertiary`). */
    sunken: string;
    hover: string;
    active: string;
    input: string;
    overlay: string;
  };
  /** `control` is the boundary of fields and toggles (`--border-control`), held to 3:1; the others are decorative. */
  border: { subtle: string; default: string; strong: string; control: string };
  fg: { default: string; secondary: string; muted: string; dim: string; onAccent: string };
  status: { info: string; success: string; warning: string; danger: string };
  /** Fills that carry white text (`--status-warning-solid`, `--status-danger-solid`). */
  statusSolid: { warning: string; danger: string };
  terminal: { bg: string; fg: string; ansi: TerminalAnsi };
  syntax: {
    background: string;
    foreground: string;
    lineNumber: string;
    widgetBackground: string;
    widgetBorder: string;
    /** Selection opacity applied to the accent, as a two-digit hex alpha. */
    selectionAlpha: string;
  };
}

const PAPER: ThemeDef = {
  id: "paper",
  label: "Paper",
  mode: "light",
  surface: {
    canvas: "#fafaf9",
    base: "#f5f5f4",
    raised: "#ffffff",
    sunken: "#e7e5e4",
    hover: "rgba(0, 0, 0, 0.05)",
    active: "color-mix(in srgb, var(--accent-primary) 10%, transparent)",
    input: "#ffffff",
    overlay: "rgba(0, 0, 0, 0.5)",
  },
  border: { subtle: "#efeeed", default: "#e7e5e4", strong: "#d6d3d1", control: "#7b756f" },
  fg: { default: "#1c1917", secondary: "#44403c", muted: "#5e5853", dim: "#625c57", onAccent: "#ffffff" },
  status: { info: "#036093", success: "#026a25", warning: "#7c5005", danger: "#b20f0f" },
  statusSolid: { warning: "#b16105", danger: "#dc2626" },
  terminal: {
    bg: "#fafaf9",
    fg: "#1c1917",
    ansi: {
      black: "#1c1917",
      red: "#dc2626",
      green: "#02842e",
      yellow: "#ac5f05",
      blue: "#2563eb",
      magenta: "#9333ea",
      cyan: "#077d9a",
      white: "#f5f5f4",
      brightBlack: "#6b6560",
      brightRed: "#e60b0b",
      brightGreen: "#17843f",
      brightYellow: "#956c03",
      brightBlue: "#076dea",
      brightMagenta: "#9b3cfa",
      brightCyan: "#0b7e90",
      brightWhite: "#ffffff",
    },
  },
  syntax: {
    background: "#fafaf9",
    foreground: "#1c1917",
    lineNumber: "#6b6560",
    widgetBackground: "#f5f5f4",
    widgetBorder: "#e7e5e4",
    selectionAlpha: "4d",
  },
};

const CHARCOAL: ThemeDef = {
  id: "charcoal",
  label: "Charcoal",
  mode: "dark",
  surface: {
    canvas: "#171717",
    base: "#242424",
    raised: "#1f1f1f",
    sunken: "#1a1a1a",
    hover: "rgba(255, 255, 255, 0.05)",
    active: "rgba(255, 255, 255, 0.11)",
    input: "#1a1a1a",
    overlay: "rgba(0, 0, 0, 0.6)",
  },
  border: { subtle: "#333333", default: "#444", strong: "#575757", control: "#878787" },
  fg: { default: "#fafafa", secondary: "#e5e5e5", muted: "#b3b3b3", dim: "#a6a6a6", onAccent: "#ffffff" },
  status: { info: "#7dd3fc", success: "#22c55e", warning: "#f59e0b", danger: "#f37171" },
  statusSolid: { warning: "#b16105", danger: "#dc2626" },
  terminal: {
    bg: "#1a1a2e",
    fg: "#4ade80",
    ansi: {
      black: "#1a1a2e",
      red: "#ef4444",
      green: "#22c55e",
      yellow: "#f59e0b",
      blue: "#60a5fa",
      magenta: "#c084fc",
      cyan: "#22d3ee",
      white: "#e7e5e4",
      brightBlack: "#8a837d",
      brightRed: "#f87171",
      brightGreen: "#4ade80",
      brightYellow: "#fbbf24",
      brightBlue: "#93c5fd",
      brightMagenta: "#d8b4fe",
      brightCyan: "#67e8f9",
      brightWhite: "#fafaf9",
    },
  },
  syntax: {
    background: "#171717",
    foreground: "#fafafa",
    lineNumber: "#a6a6a6",
    widgetBackground: "#242424",
    widgetBorder: "#444",
    selectionAlpha: "80",
  },
};

export const THEMES: Record<ThemeId, ThemeDef> = { paper: PAPER, charcoal: CHARCOAL };

/** The theme each light/dark mode resolves to. */
export const THEME_FOR_MODE: Record<ThemeMode, ThemeDef> = { light: PAPER, dark: CHARCOAL };

export interface AccentDef {
  id: AccentId;
  label: string;
  /** The solid accent (`--accent-primary`). */
  color: string;
  /** `--accent-primary-hover` and `--accent-primary-soft` per mode. */
  light: { hover: string; soft: string };
  dark: { hover: string; soft: string };
}

export const DEFAULT_ACCENT: AccentId = "indigo";

export const ACCENTS: Record<AccentId, AccentDef> = {
  indigo: { id: "indigo", label: "Indigo", color: "#5a5df0", light: { hover: "#4346ee", soft: "#494bc2" }, dark: { hover: "#5a5df0", soft: "#a5b4fc" } },
  teal: { id: "teal", label: "Teal", color: "#0b7d72", light: { hover: "#09665d", soft: "#09655c" }, dark: { hover: "#0b7d72", soft: "#5eead4" } },
  amber: { id: "amber", label: "Amber", color: "#a75c05", light: { hover: "#8e4e04", soft: "#894b04" }, dark: { hover: "#a75c05", soft: "#fcd34d" } },
  rose: { id: "rose", label: "Rose", color: "#da1c46", light: { hover: "#c3193f", soft: "#a81636" }, dark: { hover: "#da1c46", soft: "#fda4af" } },
  slate: { id: "slate", label: "Slate", color: "#617087", light: { hover: "#566478", soft: "#505c6f" }, dark: { hover: "#617087", soft: "#cbd5e1" } },
};

export const ACCENT_IDS = Object.keys(ACCENTS) as AccentId[];

export const DEFAULT_DENSITY: Density = "default";
export const DENSITIES: readonly Density[] = ["compact", "default", "comfortable"];

export function isAccentId(value: string): value is AccentId {
  return Object.hasOwn(ACCENTS, value);
}

export function isDensity(value: string): value is Density {
  return (DENSITIES as readonly string[]).includes(value);
}

/** The accent as a concrete color with alpha, for libraries that need hex (Monaco, xterm). */
export function accentSelection(theme: ThemeDef, accent: AccentId): string {
  return `${ACCENTS[accent].color}${theme.syntax.selectionAlpha}`;
}
