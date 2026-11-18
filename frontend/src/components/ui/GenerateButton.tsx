import { Loader2, WandSparkles } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export interface GenerateButtonProps {
  /** Button label (e.g. "Generate Image") */
  children: ReactNode;
  onClick: () => void;
  disabled: boolean;
  loading: boolean;
  /** Tailwind gradient classes for the button background (includes hover if desired) */
  gradient?: string;
  /** Label shown while loading (default: "Generating...") */
  loadingLabel?: string;
  /** Icon in idle state (default: WandSparkles) */
  icon?: ElementType;
  className?: string;
  "data-testid"?: string;
}

const DEFAULT_GRADIENT = "from-pink-600 to-rose-600 hover:from-pink-500 hover:to-rose-500";

/**
 * Full-width button for AI generation actions.
 *
 * Opinionated CTA: gradient background, sparkles icon, and a loading state that
 * replaces the idle icon + label with a spinner and loading text.
 */
export default function GenerateButton({
  children,
  onClick,
  disabled,
  loading,
  gradient = DEFAULT_GRADIENT,
  loadingLabel = "Generating...",
  icon: Icon = WandSparkles,
  className,
  "data-testid": testId,
}: GenerateButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-busy={loading || undefined}
      className={cn(
        "w-full flex items-center justify-center gap-2 py-3 bg-linear-to-r disabled:opacity-50 text-white text-sm font-semibold rounded-xl transition-all cursor-pointer disabled:cursor-not-allowed focus-ring shadow-button-primary",
        gradient,
        className,
      )}
      data-testid={testId}
    >
      {loading ? (
        <>
          <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" /> {loadingLabel}
        </>
      ) : (
        <>
          <Icon className="w-4 h-4" aria-hidden="true" /> {children}
        </>
      )}
    </button>
  );
}
