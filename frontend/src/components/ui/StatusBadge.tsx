import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export interface StatusBadgeDefinition {
  /** Display label */
  label: string;
  /** Leading icon (takes precedence over dotColor) */
  icon?: ReactNode;
  /** Colored dot class when no icon is set (e.g. "bg-emerald-500") */
  dotColor?: string;
  /** Pulse animation on the dot */
  pulse?: boolean;
  /**
   * Color classes for the badge.
   * Pill: typically `bg-… text-… border-…`
   * Inline: typically `text-…`
   */
  colorClass: string;
}

export interface StatusBadgeProps {
  /**
   * Status key used with `statuses` to look up label/icon/colors.
   * Optional when `label` (and optional icon/dot/colorClass) are provided directly.
   */
  status?: string;
  /** Domain-specific status → style map. Looked up when `status` is set. */
  statuses?: Record<string, StatusBadgeDefinition>;
  /** Override / direct label */
  label?: string;
  /** Override / direct icon */
  icon?: ReactNode;
  /** Override / direct dot color class */
  dotColor?: string;
  /** Pulse the colored dot */
  pulse?: boolean;
  /** Override / direct color classes */
  colorClass?: string;
  /**
   * Layout variant:
   * - `"pill"` (default) — rounded-full bordered badge
   * - `"inline"` — icon + label only, no pill chrome (for run/task status lines)
   */
  variant?: "pill" | "inline";
  /** Gap between indicator and label: `"sm"` = gap-1, `"md"` = gap-1.5 */
  gap?: "sm" | "md";
  /** Tooltip */
  title?: string | undefined;
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

/**
 * Compact status pill/badge with an optional icon or colored dot indicator.
 * Domain-specific status maps stay local; this component only renders the shared chrome.
 */
export default function StatusBadge({
  status,
  statuses,
  label: labelProp,
  icon: iconProp,
  dotColor: dotColorProp,
  pulse: pulseProp,
  colorClass: colorClassProp,
  variant = "pill",
  gap = "sm",
  title,
  className,
  "data-testid": testId,
}: StatusBadgeProps) {
  const def = status != null && statuses ? statuses[status] : undefined;
  const label = labelProp ?? def?.label ?? status ?? "";
  const icon = iconProp !== undefined ? iconProp : def?.icon;
  const dotColor = dotColorProp ?? def?.dotColor;
  const pulse = pulseProp ?? def?.pulse ?? false;
  const colorClass = colorClassProp ?? def?.colorClass ?? "";

  const showDot = icon == null && Boolean(dotColor);

  return (
    <span
      className={cn(
        "inline-flex items-center shrink-0 text-xs",
        gap === "md" ? "gap-1.5" : "gap-1",
        variant === "pill" && "px-2 py-0.5 rounded-full font-medium border",
        colorClass,
        className,
      )}
      title={title}
      data-testid={testId}
    >
      {icon ?? null}
      {showDot ? <span className={cn("w-1.5 h-1.5 rounded-full", dotColor, pulse && "animate-pulse")} aria-hidden="true" /> : null}
      {label}
    </span>
  );
}
