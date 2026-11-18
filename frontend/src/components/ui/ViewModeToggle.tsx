import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";
import SegmentedControl from "../../ui/segmented-control.tsx";

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
    <SegmentedControl
      ariaLabel={ariaLabel}
      value={value}
      onChange={onChange}
      tone="accent"
      size="sm"
      className={cn("w-auto shrink-0", className)}
      options={options.map(({ value: optionValue, label, title, icon: Icon, hiddenClassname }) => ({
        value: optionValue,
        label,
        title,
        className: hiddenClassname,
        icon: <Icon className="w-3 h-3" />,
      }))}
    />
  );
}
