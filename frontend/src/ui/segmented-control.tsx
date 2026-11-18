import type { ReactNode } from "react";
import { cn } from "../lib/utils.ts";

export interface SegmentedOption<T extends string> {
  value: T;
  label: ReactNode;
  icon?: ReactNode | undefined;
  title?: string | undefined;
  /** Extra classes, for example to hide an option at a breakpoint. */
  className?: string | undefined;
}

export interface SegmentedControlProps<T extends string> {
  value: T;
  onChange: (next: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  /** `soft` is the settings track. `accent` fills the selected option. */
  tone?: "soft" | "accent";
  size?: "sm" | "md";
  className?: string;
}

export default function SegmentedControl<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  tone = "soft",
  size = "md",
  className,
}: SegmentedControlProps<T>) {
  return (
    <div
      className={cn(
        "flex items-center gap-1 w-full sm:w-auto",
        tone === "soft" ? "bg-tertiary rounded-lg p-1" : "rounded-lg border border-control p-0.5",
        className,
      )}
      role="group"
      aria-label={ariaLabel}
    >
      {options.map(option => {
        const selected = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            title={option.title}
            onClick={() => {
              if (!selected) onChange(option.value);
            }}
            className={cn(
              "flex flex-1 sm:flex-initial items-center justify-center gap-1.5 rounded-md font-medium transition-colors cursor-pointer focus-ring",
              size === "sm" ? "px-2.5 py-1 text-xs" : "px-3 py-1.5 text-xs",
              tone === "soft"
                ? selected
                  ? "bg-secondary text-primary shadow-sm"
                  : "text-muted hover:text-primary"
                : selected
                  ? "bg-accent text-on-accent"
                  : "text-muted hover:text-primary hover:bg-hover",
              option.className,
            )}
            aria-pressed={selected}
          >
            {option.icon}
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
