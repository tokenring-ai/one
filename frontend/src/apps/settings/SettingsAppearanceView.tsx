import { Check, Monitor, Moon, Sun } from "lucide-react";
import { type ReactNode, useMemo } from "react";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { type ThemePreference, useTheme, useThemeSettings } from "../../hooks/useTheme.ts";
import { cn } from "../../lib/utils.ts";
import { ACCENT_IDS, ACCENTS, type Density } from "../../theme/themes.ts";
import SegmentedControl from "../../ui/segmented-control.tsx";
import { SettingsCard, SettingsRow } from "./shared.tsx";

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: "compact", label: "Compact" },
  { value: "default", label: "Default" },
  { value: "comfortable", label: "Comfortable" },
];

/** The theme card, shared by the standalone view and the combined settings page. */
export function AppearanceSection() {
  const [resolvedTheme, setTheme, preference] = useTheme();
  const { accent, setAccent, density, setDensity } = useThemeSettings();

  const themeOptions = useMemo(
    () =>
      [
        { value: "light" as const, label: "Light", icon: <Sun className="w-3.5 h-3.5" aria-hidden="true" /> },
        { value: "dark" as const, label: "Dark", icon: <Moon className="w-3.5 h-3.5" aria-hidden="true" /> },
        { value: "system" as const, label: "System", icon: <Monitor className="w-3.5 h-3.5" aria-hidden="true" /> },
      ] satisfies { value: ThemePreference; label: string; icon: ReactNode }[],
    [],
  );

  return (
    <SettingsCard>
      <SettingsRow
        title="Theme"
        description={preference === "system" ? `Follows system appearance (currently ${resolvedTheme})` : "Choose light, dark, or match your system"}
      >
        <SegmentedControl value={preference} onChange={setTheme} options={themeOptions} ariaLabel="Theme preference" />
      </SettingsRow>
      <SettingsRow title="Accent" description="Highlight color for selection, focus and primary actions">
        <div className="flex items-center gap-2" role="group" aria-label="Accent color">
          {ACCENT_IDS.map(id => {
            const def = ACCENTS[id];
            const selected = accent === id;
            return (
              <button
                key={id}
                type="button"
                aria-label={def.label}
                aria-pressed={selected}
                title={def.label}
                onClick={() => setAccent(id)}
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center cursor-pointer focus-ring transition-shadow",
                  selected && "ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{ backgroundColor: def.color, ...(selected ? { ["--tw-ring-color" as string]: def.color } : {}) }}
              >
                {selected ? <Check className="w-3.5 h-3.5 text-white" aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
      </SettingsRow>
      <SettingsRow title="Density" description="Spacing of tabs, headers and controls" border={false}>
        <SegmentedControl value={density} onChange={setDensity} options={DENSITY_OPTIONS} ariaLabel="Density" />
      </SettingsRow>
    </SettingsCard>
  );
}

export default function SettingsAppearanceView() {
  return (
    <ViewShell pad="page">
      <AppearanceSection />
    </ViewShell>
  );
}
