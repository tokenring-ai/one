import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type SectionLabelTone = "muted" | "accent" | "warning";

export interface SectionLabelProps {
  children: ReactNode;
  /** Right-aligned count, badge or action. */
  meta?: ReactNode | undefined;
  tone?: SectionLabelTone | undefined;
  className?: string | undefined;
}

const tones: Record<SectionLabelTone, string> = {
  muted: "text-muted",
  accent: "text-accent-soft",
  warning: "text-amber-600 dark:text-amber-500/90",
};

/**
 * The small uppercase heading that separates groups within a panel.
 *
 * It existed as four different spellings across the app — `tracking-widest` vs
 * `wider` vs `wide`, `font-bold` vs `font-semibold`, one in `font-mono` — which
 * is exactly the kind of drift that stops a set of panels reading as one product.
 */
export default function SectionLabel({ children, meta, tone = "muted", className }: SectionLabelProps) {
  return (
    <div className={cn("flex items-center gap-2 min-w-0", className)}>
      <span className={cn("flex-1 min-w-0 truncate text-xs font-bold uppercase tracking-widest", tones[tone])}>{children}</span>
      {meta != null && meta !== false ? <span className="shrink-0 text-xs text-muted">{meta}</span> : null}
    </div>
  );
}
