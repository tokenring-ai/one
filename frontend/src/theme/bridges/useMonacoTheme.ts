import { useCallback, useEffect, useRef } from "react";
import { useTheme } from "../../hooks/useTheme.ts";
import { useThemeAccent } from "../themeStore.ts";
import { defineMonacoThemes, monacoThemeName } from "./monaco.ts";

interface MonacoThemeHost {
  editor: {
    defineTheme: (name: string, theme: object) => void;
  };
}

/** `theme` and `beforeMount` props for `@monaco-editor/react`. */
export function useMonacoTheme() {
  const [resolved] = useTheme();
  const accent = useThemeAccent();
  const monacoRef = useRef<MonacoThemeHost | null>(null);
  const accentRef = useRef(accent);
  accentRef.current = accent;

  const beforeMount = useCallback((monaco: MonacoThemeHost) => {
    monacoRef.current = monaco;
    defineMonacoThemes(monaco, accentRef.current);
  }, []);

  useEffect(() => {
    if (monacoRef.current) defineMonacoThemes(monacoRef.current, accent);
  }, [accent]);

  return { theme: monacoThemeName(resolved), beforeMount };
}
