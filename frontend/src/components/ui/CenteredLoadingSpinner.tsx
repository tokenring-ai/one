import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils.ts";

export interface CenteredLoadingSpinnerProps {
  /** Spinner size */
  size?: "sm" | "md" | "lg";
  /** Optional message below the spinner */
  message?: string;
  /** Whether to fill the parent container (applies flex-1) */
  fill?: boolean;
  className?: string;
  "data-testid"?: string;
}

const spinnerSizes = {
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-8 h-8",
} as const;

/**
 * Lightweight area-level loading spinner for flex layouts, thumbnails, and
 * split panes. Prefer LoadingState for full-page loading with richer chrome.
 */
export default function CenteredLoadingSpinner({ size = "md", message, fill = false, className, "data-testid": testId }: CenteredLoadingSpinnerProps) {
  return (
    <div
      className={cn("flex items-center justify-center", message && "flex-col gap-2", fill && "flex-1", className)}
      role="status"
      aria-live="polite"
      aria-label={message ? undefined : "Loading"}
      data-testid={testId}
    >
      <Loader2 className={cn(spinnerSizes[size], "text-muted animate-spin")} aria-hidden="true" />
      {message ? <p className="text-xs text-muted">{message}</p> : null}
    </div>
  );
}
