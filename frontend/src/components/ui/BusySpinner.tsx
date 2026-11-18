import { cn } from "../../lib/utils.ts";

export type BusySpinnerSize = "xs" | "sm" | "md";

export interface BusySpinnerProps {
  size?: BusySpinnerSize | undefined;
  /** Accessible label. Omit inside an element that already names the activity. */
  label?: string | undefined;
  className?: string | undefined;
}

const sizes: Record<BusySpinnerSize, string> = {
  xs: "w-3 h-3 border-2",
  sm: "w-3.5 h-3.5 border-2",
  md: "w-4 h-4 border-2",
};

/**
 * The amber ring that marks an agent, task or run as working.
 *
 * Distinct from `LoadingState`, which is a block-level "this panel is still
 * fetching". This is an inline status glyph, and it had been hand-written as the
 * same six-class string in ten different files.
 */
export default function BusySpinner({ size = "xs", label, className }: BusySpinnerProps) {
  return (
    <span
      className={cn("inline-block shrink-0 rounded-full border-accent-line border-t-accent animate-spin", sizes[size], className)}
      {...(label ? { role: "status", "aria-label": label } : { "aria-hidden": true })}
    />
  );
}
