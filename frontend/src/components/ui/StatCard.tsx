import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type StatCardAccent = "up" | "down" | "neutral";

export interface StatCardProps {
  /** Label shown above the value */
  label: string;
  /** Primary value (supports ReactNode for custom formatting) */
  value: ReactNode;
  /** Optional subtitle shown below the value */
  sub?: ReactNode;
  /** Semantic accent: green for positive, red for negative, default for neutral */
  accent?: StatCardAccent;
  /** Optional className override */
  className?: string;
  "data-testid"?: string;
}

const accentClasses: Record<StatCardAccent, string> = {
  up: "text-emerald-500",
  down: "text-red-500",
  neutral: "text-primary",
};

/**
 * Compact, icon-free metric card for dense grids (e.g. financial key stats).
 * Prefer SummaryStat when an icon-based dashboard summary row is needed.
 */
export default function StatCard({ label, value, sub, accent = "neutral", className, "data-testid": testId }: StatCardProps) {
  return (
    <div className={cn("px-3 py-2.5 bg-secondary rounded-lg border border-primary", className)} data-testid={testId}>
      <div className="text-xs uppercase tracking-wide text-muted mb-1">{label}</div>
      <div className={cn("text-sm font-semibold truncate", accentClasses[accent])}>{value}</div>
      {sub != null ? <div className="text-xs text-muted mt-0.5 truncate">{sub}</div> : null}
    </div>
  );
}
