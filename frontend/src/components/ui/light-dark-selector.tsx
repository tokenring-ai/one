import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.ts";

export function LightDarkSelector() {
  const [theme, setTheme] = useTheme();
  const onClick = () => setTheme(theme === "dark" ? "light" : "dark");

  return (
    <button
      type="button"
      onClick={onClick}
      className={`p-1.5 rounded-md transition-colors duration-200 text-muted cursor-pointer hover:bg-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background ${
        theme === "dark" ? "bg-secondary" : "bg-secondary"
      }`}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
    >
      {theme === "dark" ? <Sun className="w-4 h-4 transition-transform duration-200" /> : <Moon className="w-4 h-4 transition-transform duration-200" />}
    </button>
  );
}
