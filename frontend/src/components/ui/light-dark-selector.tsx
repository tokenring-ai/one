import { Moon, Sun } from "lucide-react";
import { useTheme } from "../../hooks/useTheme.ts";

export function LightDarkSelector() {
  const [resolved, setTheme, preference] = useTheme();

  // Explicit toggle between light and dark (leaves system mode)
  const onClick = () => setTheme(resolved === "dark" ? "light" : "dark");

  const label =
    preference === "system"
      ? `System theme (currently ${resolved}). Click to use ${resolved === "dark" ? "light" : "dark"} mode`
      : resolved === "dark"
        ? "Switch to light mode"
        : "Switch to dark mode";

  return (
    <button
      type="button"
      onClick={onClick}
      className="p-1.5 rounded-md transition-colors duration-200 text-muted cursor-pointer hover:bg-hover active:scale-[0.98] focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-background bg-secondary"
      title={label}
      aria-label={label}
    >
      {resolved === "dark" ? <Sun className="w-4 h-4 transition-transform duration-200" /> : <Moon className="w-4 h-4 transition-transform duration-200" />}
    </button>
  );
}
