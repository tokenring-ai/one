import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";

export interface ViewModeOption<V = string> {
  /** Unique value identifying this mode */
  value: V;
  /** Display label */
  label: string;
  /** Tooltip text */
  title: string;
  /** Icon component */
  icon: ElementType;
  /** Extra classes for per-option visibility (e.g. `hidden md:flex`) */
  hiddenClassname?: string;
}

export interface ViewModeToggleProps<V = string> {
  /** Available view modes */
  options: ViewModeOption<V>[];
  /** Currently selected mode value */
  value: V;
  /** Called when the user selects a different mode */
  onChange: (value: V) => void;
  /** Accessibility label for the group */
  "aria-label": string;
  /** Container className override */
  className?: string;
}

export default function ViewModeToggle<V extends string = string>({ options, value, onChange, "aria-label": ariaLabel, className }: ViewModeToggleProps<V>) {
  return (
    <div className={cn("flex items-center rounded-lg border border-primary p-0.5 shrink-0", className)} role="group" aria-label={ariaLabel}>
      {options.map(({ value: optionValue, label, title, icon: Icon, hiddenClassname }) => {
        const isActive = value === optionValue;

        return (
          <button
            key={optionValue}
            type="button"
            onClick={() => onChange(optionValue)}
            className={cn(
              "items-center gap-1 px-2 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer focus-ring",
              hiddenClassname ?? "flex",
              isActive ? "bg-accent text-white" : "text-muted hover:text-primary hover:bg-hover",
            )}
            aria-pressed={isActive}
            title={title}
          >
            <Icon className="w-3 h-3" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
