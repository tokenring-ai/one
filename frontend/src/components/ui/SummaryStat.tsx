import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type SummaryStatSize = "sm" | "md" | "lg";
export type SummaryStatIconPosition = "left" | "right";

export interface SummaryStatProps {
  label: string;
  value: string;
  icon: ReactNode;
  /** Optional subtitle shown below the value */
  sub?: string;
  /** Tailwind color class for icon (and value when icon is right-aligned) */
  accentClass?: string;
  /** Controls overall size: padding, gaps, and value typography */
  size?: SummaryStatSize;
  /** Controls icon position relative to the label */
  iconPosition?: SummaryStatIconPosition;
  className?: string;
  "data-testid"?: string;
}

const sizeStyles: Record<
  SummaryStatSize,
  {
    container: string;
    header: string;
    headerLeft: string;
    value: string;
  }
> = {
  sm: {
    container: "px-3 py-2.5",
    header: "mb-0.5",
    headerLeft: "gap-1.5",
    value: "text-base font-semibold tabular-nums",
  },
  md: {
    container: "px-4 py-3",
    header: "mb-1",
    headerLeft: "gap-2",
    value: "text-lg font-semibold tabular-nums",
  },
  lg: {
    container: "px-4 py-3.5",
    header: "mb-2",
    headerLeft: "gap-2",
    value: "text-xl font-semibold tabular-nums tracking-tight",
  },
};

/**
 * Compact stat card for dashboard summary rows.
 * Displays a labeled metric with an icon and optional accent color/subtitle.
 */
export default function SummaryStat({
  label,
  value,
  icon,
  sub,
  accentClass,
  size = "md",
  iconPosition = "left",
  className,
  "data-testid": testId,
}: SummaryStatProps) {
  const styles = sizeStyles[size];
  const iconOnRight = iconPosition === "right";
  // Right-aligned layouts (queue/scheduler/metrics) color the value; left-aligned keep primary text.
  const valueClass = iconOnRight ? (accentClass ?? "text-primary") : "text-primary";

  return (
    <div className={cn("bg-secondary rounded-xl border border-primary shadow-sm", styles.container, className)} data-testid={testId}>
      <div className={cn("flex items-center", styles.header, iconOnRight ? "justify-between" : styles.headerLeft)}>
        {iconOnRight ? (
          <>
            <span className="text-xs font-bold text-muted uppercase tracking-widest">{label}</span>
            <span className={cn("opacity-80", accentClass)}>{icon}</span>
          </>
        ) : (
          <>
            <span className={accentClass}>{icon}</span>
            <span className="text-xs font-bold text-muted uppercase tracking-widest">{label}</span>
          </>
        )}
      </div>
      <div className={cn(styles.value, valueClass)}>{value}</div>
      {sub ? <p className="text-xs text-muted mt-1 truncate">{sub}</p> : null}
    </div>
  );
}
