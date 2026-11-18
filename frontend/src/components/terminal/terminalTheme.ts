import type { ITheme } from "@xterm/xterm";
import type { ResolvedTheme } from "../../theme/themeStore.ts";
import { type AccentId, accentSelection, DEFAULT_ACCENT, THEME_FOR_MODE } from "../../theme/themes.ts";

/**
 * xterm measures cells from concrete colors, so the palette comes from the
 * ThemeDef (themes.ts) rather than CSS variables; selection follows the accent.
 */

export const TERMINAL_FONT = '"JetBrains Mono", "Fira Code", monospace';
export const TERMINAL_DEFAULT_FONT_SIZE = 12;
export const TERMINAL_FONT_SIZES = [10, 11, 12, 14, 16, 18, 20] as const;

/** The dark panel color, shared by the xterm theme and the surrounding chrome. */
export const TERMINAL_DARK_BACKGROUND = THEME_FOR_MODE.dark.terminal.bg;

export function terminalTheme(resolved: ResolvedTheme, accent: AccentId = DEFAULT_ACCENT): ITheme {
  const theme = THEME_FOR_MODE[resolved];
  return {
    background: theme.terminal.bg,
    foreground: theme.terminal.fg,
    cursor: theme.terminal.fg,
    cursorAccent: theme.terminal.bg,
    selectionBackground: accentSelection(theme, accent),
    ...theme.terminal.ansi,
  };
}
