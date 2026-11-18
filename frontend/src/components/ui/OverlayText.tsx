import { Loader2 } from "lucide-react";
import { cn } from "../../lib/utils.ts";

export type OverlayTextPosition = "top-left" | "top-center" | "center" | "bottom-center";
export type OverlayTextFont = "mono" | "sans";
export type OverlayTextSize = "xs" | "sm" | "md";

export interface OverlayTextProps {
  /** The text message to display */
  message: string;
  /** Position within the container (default: top-left) */
  position?: OverlayTextPosition;
  /** Whether clicks should pass through (default: true) */
  passThrough?: boolean;
  /** Font style (default: sans) */
  font?: OverlayTextFont;
  /** Text size (default: xs) */
  size?: OverlayTextSize;
  /** Optional background overlay for dimming the content behind */
  dimBackground?: boolean;
  /** Show a small spinner beside the message */
  spinner?: boolean;
  className?: string;
  "data-testid"?: string;
}

const positionStyles: Record<OverlayTextPosition, string> = {
  "top-left": "items-start p-4",
  "top-center": "items-start justify-center pt-8",
  center: "items-center justify-center",
  "bottom-center": "items-end justify-center pb-4",
};

const fontStyles: Record<OverlayTextFont, string> = {
  mono: "font-mono",
  sans: "",
};

const sizeStyles: Record<OverlayTextSize, string> = {
  xs: "text-xs",
  sm: "text-sm",
  md: "text-base",
};

const spinnerSizes: Record<OverlayTextSize, string> = {
  xs: "w-3 h-3",
  sm: "w-3.5 h-3.5",
  md: "w-4 h-4",
};

/**
 * Subtle text overlay for empty or loading content areas.
 * Parent must be `position: relative`. Defaults to pointer-events-none so
 * underlying UI stays interactive.
 */
export default function OverlayText({
  message,
  position = "top-left",
  passThrough = true,
  font = "sans",
  size = "xs",
  dimBackground = false,
  spinner = false,
  className,
  "data-testid": testId,
}: OverlayTextProps) {
  return (
    <div
      className={cn(
        "absolute inset-0 flex text-muted",
        positionStyles[position],
        fontStyles[font],
        sizeStyles[size],
        passThrough && "pointer-events-none",
        dimBackground && "bg-primary/40",
        className,
      )}
      role="status"
      aria-live="polite"
      data-testid={testId}
    >
      <span className={cn("inline-flex items-center", spinner && "gap-2")}>
        {spinner && <Loader2 className={cn(spinnerSizes[size], "animate-spin shrink-0")} aria-hidden="true" />}
        {message}
      </span>
    </div>
  );
}
