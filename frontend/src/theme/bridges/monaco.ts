import type { ResolvedTheme } from "../themeStore.ts";
import { ACCENTS, type AccentId, accentSelection, DEFAULT_ACCENT, THEME_FOR_MODE } from "../themes.ts";

export const MONACO_THEME_NAME: Record<ResolvedTheme, string> = {
  light: "tokenring-light",
  dark: "tokenring-dark",
};

interface MonacoThemeHost {
  editor: {
    defineTheme: (name: string, theme: object) => void;
  };
}

/**
 * Monaco's built-in `vs` and `vs-dark` token colors that fall under 4.5:1 on the Paper and Charcoal
 * editor backgrounds, replaced by the nearest shade that reaches it (contrast.test.ts checks every
 * remaining built-in token). Foreground values are hex without the leading `#`, as Monaco expects.
 */
export const MONACO_TOKEN_FIXES: Record<ResolvedTheme, Array<{ token: string; foreground: string }>> = {
  light: [
    { token: "number", foreground: "098255" },
    { token: "attribute.value.number", foreground: "098255" },
    { token: "attribute.value.unit", foreground: "098255" },
    { token: "annotation", foreground: "727272" },
    { token: "metatag.html", foreground: "727272" },
    { token: "metatag.xml", foreground: "727272" },
    { token: "tag.id.pug", foreground: "4d72a7" },
    { token: "tag.class.pug", foreground: "4d72a7" },
    { token: "metatag.content.html", foreground: "e60000" },
    { token: "attribute.name", foreground: "e60000" },
    { token: "string.sql", foreground: "e60000" },
    { token: "operator.sql", foreground: "647281" },
  ],
  dark: [
    { token: "variable.predefined", foreground: "6980b9" },
    { token: "tag.id.pug", foreground: "6184b4" },
    { token: "tag.class.pug", foreground: "6184b4" },
    { token: "string.sql", foreground: "ff1919" },
  ],
};

/** Editor colors for one mode, from its ThemeDef and the live accent. */
export function monacoThemeData(resolved: ResolvedTheme, accent: AccentId = DEFAULT_ACCENT) {
  const theme = THEME_FOR_MODE[resolved];
  return {
    base: resolved === "dark" ? "vs-dark" : "vs",
    inherit: true,
    rules: MONACO_TOKEN_FIXES[resolved],
    colors: {
      "editor.background": theme.syntax.background,
      "editor.foreground": theme.syntax.foreground,
      "editor.selectionBackground": accentSelection(theme, accent),
      "editorCursor.foreground": ACCENTS[accent].color,
      "editorLineNumber.foreground": theme.syntax.lineNumber,
      "editorWidget.background": theme.syntax.widgetBackground,
      "editorWidget.border": theme.syntax.widgetBorder,
    },
  };
}

/** Register both Paper and Charcoal editor themes. Safe to call more than once (re-registering refreshes the active one). */
export function defineMonacoThemes(monaco: MonacoThemeHost, accent: AccentId = DEFAULT_ACCENT): void {
  for (const resolved of ["light", "dark"] as const) {
    monaco.editor.defineTheme(MONACO_THEME_NAME[resolved], monacoThemeData(resolved, accent));
  }
}

export function monacoThemeName(resolved: ResolvedTheme): string {
  return MONACO_THEME_NAME[resolved];
}
