import { Loader2, Play } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";

export type LaunchButtonIconSize = "sm" | "md";
export type LaunchButtonVariant = "labeled" | "icon";

export interface LaunchButtonProps {
  /** Whether the operation is in progress */
  loading: boolean;
  /** Click handler (called only when not loading/disabled) */
  onClick: () => void;
  /** Disable the button independently of loading (e.g. missing prerequisites) */
  disabled?: boolean;
  /** Label in default state (default: "Launch") */
  label?: string;
  /** Label in loading state (default: "Launching…") */
  loadingLabel?: string;
  /** Icon in default state (default: Play) */
  icon?: ElementType;
  /** Icon size: "sm" (w-3 h-3) or "md" (w-3.5 h-3.5) (default: "md") */
  iconSize?: LaunchButtonIconSize;
  /** Layout variant: "labeled" (icon + text) or "icon" (icon only) */
  variant?: LaunchButtonVariant;
  /** Background color classes (default: "bg-accent hover:bg-accent-hover") */
  bgClassName?: string;
  /** Tooltip text */
  title?: string;
  /** Accessibility label */
  "aria-label"?: string;
  /** Additional class names */
  className?: string;
  "data-testid"?: string;
}

const iconSizeClass: Record<LaunchButtonIconSize, string> = {
  sm: "w-3 h-3",
  md: "w-3.5 h-3.5",
};

/**
 * Compact action button that toggles between a primary action state (icon + label)
 * and a loading state (spinner + loading label). Used for initiating async operations
 * like launching agents, running workflows, or starting processes.
 *
 * The `loading` prop both shows the spinner and disables the button to prevent double-clicks.
 * Use `disabled` for additional prerequisites (empty selection, missing type, etc.).
 */
export default function LaunchButton({
  loading,
  onClick,
  disabled = false,
  label = "Launch",
  loadingLabel = "Launching…",
  icon: Icon = Play,
  iconSize = "md",
  variant = "labeled",
  bgClassName = "bg-accent hover:bg-accent-hover",
  title,
  "aria-label": ariaLabel,
  className,
  "data-testid": testId,
}: LaunchButtonProps) {
  const sizeClass = iconSizeClass[iconSize];
  const isIconOnly = variant === "icon";
  const isDisabled = loading || disabled;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isDisabled}
      title={title}
      aria-label={ariaLabel ?? (isIconOnly ? (loading ? loadingLabel : label) : undefined)}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex items-center transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed",
        isIconOnly ? "p-1 rounded shrink-0" : cn("gap-1.5 px-2.5 py-1.5 text-white text-xs font-semibold rounded-lg", bgClassName),
        isIconOnly ? bgClassName : undefined,
        className,
      )}
      data-testid={testId}
    >
      {loading ? (
        <Loader2 className={cn(sizeClass, "animate-spin")} aria-hidden="true" />
      ) : (
        <Icon className={cn(sizeClass, Icon === Play && "fill-current")} aria-hidden="true" />
      )}
      {!isIconOnly ? (loading ? loadingLabel : label) : null}
    </button>
  );
}
