import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "../../lib/utils.ts";

export type ChangeIndicatorSize = "sm" | "md" | "lg";
export type ChangeIndicatorAlign = "left" | "right" | "center";

export interface ChangeIndicatorProps {
  /** The absolute change value (e.g. +2.50) */
  change: number | null | undefined;
  /** The percentage change value (e.g. +1.23) */
  changePercent?: number | null | undefined;
  /** Value formatter for the absolute change (default: 2 decimal places) */
  formatChange?: ((value: number) => string) | undefined;
  /** Value formatter for the percentage (default: 2 decimal places) */
  formatPercent?: ((value: number) => string) | undefined;
  /** Whether to show the percentage (default: true when changePercent is provided) */
  showPercent?: boolean | undefined;
  /** Whether to show the arrow icon (default: true) */
  showIcon?: boolean | undefined;
  /** Icon size variant (default: "md") */
  size?: ChangeIndicatorSize | undefined;
  /** Text alignment (default: "left") */
  align?: ChangeIndicatorAlign | undefined;
  /** Color for positive changes (default: "text-emerald-500") */
  upColor?: string | undefined;
  /** Color for negative changes (default: "text-red-500") */
  downColor?: string | undefined;
  /** Color for flat/zero changes (default: "text-muted") */
  flatColor?: string | undefined;
  /** Fallback display when change is null/undefined/NaN (default: "—") */
  flatDisplay?: string | undefined;
  /** Optional className override */
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

const iconSizeClasses: Record<ChangeIndicatorSize, string> = {
  sm: "w-3 h-3",
  md: "w-4 h-4",
  lg: "w-5 h-5",
};

const alignClasses: Record<ChangeIndicatorAlign, string> = {
  left: "justify-start",
  right: "justify-end",
  center: "justify-center",
};

function defaultFormat(value: number): string {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** "+" only for strictly positive values. */
export function changeSign(value: number): string {
  return value > 0 ? "+" : "";
}

function isValidNumber(value: number | null | undefined): value is number {
  return value != null && Number.isFinite(value);
}

/**
 * Compact inline display for positive/negative numeric changes.
 * Shows a directional arrow, signed value, and optionally a percentage in parentheses.
 */
export default function ChangeIndicator({
  change,
  changePercent,
  formatChange = defaultFormat,
  formatPercent = defaultFormat,
  showPercent,
  showIcon = true,
  size = "md",
  align = "left",
  upColor = "text-emerald-500",
  downColor = "text-red-500",
  flatColor = "text-muted",
  flatDisplay = "—",
  className,
  "data-testid": testId,
}: ChangeIndicatorProps) {
  if (!isValidNumber(change)) {
    return (
      <span className={cn("inline-flex items-center gap-0.5", alignClasses[align], flatColor, className)} data-testid={testId}>
        {flatDisplay}
      </span>
    );
  }

  const isUp = change > 0;
  const isDown = change < 0;
  const colorClass = isUp ? upColor : isDown ? downColor : flatColor;
  const iconClass = iconSizeClasses[size];
  const shouldShowPercent = showPercent ?? isValidNumber(changePercent);

  return (
    <span className={cn("inline-flex items-center gap-0.5", alignClasses[align], colorClass, className)} data-testid={testId}>
      {showIcon && isUp ? <ArrowUpRight className={iconClass} aria-hidden="true" /> : null}
      {showIcon && isDown ? <ArrowDownRight className={iconClass} aria-hidden="true" /> : null}
      {changeSign(change)}
      {formatChange(change)}
      {shouldShowPercent && isValidNumber(changePercent) ? (
        <>
          {" "}
          ({changeSign(changePercent)}
          {formatPercent(changePercent)}%)
        </>
      ) : null}
    </span>
  );
}
