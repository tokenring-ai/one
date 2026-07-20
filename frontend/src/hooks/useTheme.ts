import { useEffect, useRef, useState } from "react";

export function useTheme() {
  const initializedRef = useRef(false);

  const [theme, setThemeState] = useState<"light" | "dark">(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("theme") : null;
    if (stored === "light" || stored === "dark") {
      if (stored === "dark") {
        document.documentElement.classList.add("dark");
      }
      return stored;
    }
    const prefersDark = typeof window !== "undefined" && window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (prefersDark) {
      document.documentElement.classList.add("dark");
    }
    return prefersDark ? "dark" : "light";
  });

  useEffect(() => {
    // Skip the first render since we already set the initial theme
    if (initializedRef.current) {
      if (theme === "dark") {
        document.documentElement.classList.add("dark");
      } else {
        document.documentElement.classList.remove("dark");
      }
      localStorage.setItem("theme", theme);
    }
    initializedRef.current = true;
  }, [theme]);

  return [theme, setThemeState] as const;
}
