import { Tag } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";

export type TagChipVariant = "neutral" | "default" | "accent" | "success" | "warning" | "danger" | "info" | "emerald" | "amber" | "rose" | "sky";
export type TagChipIconSize = "xs" | "sm";

export interface TagChipProps {
  /** Tag label text */
  label: string;
  /** Leading icon (default: Tag from lucide-react) */
  icon?: ElementType;
  /** Icon size: "xs" (w-2.5 h-2.5) or "sm" (w-3 h-3) (default: "xs") */
  iconSize?: TagChipIconSize;
  /** Whether to show the icon (default: true) */
  showIcon?: boolean;
  /** Color variant (default: "default") */
  variant?: TagChipVariant;
  /** Optional click handler (makes the chip interactive) */
  onClick?: () => void;
  /** Whether the chip is in a "selected" state (for filter tags) */
  selected?: boolean;
  className?: string;
  "data-testid"?: string;
}

const variantStyles: Record<TagChipVariant, string> = {
  neutral: "bg-sunken border-default text-muted",
  default: "bg-sunken border-default text-muted",
  accent: "bg-accent-subtle border-accent text-accent-soft",
  success: "bg-success-subtle border-success text-success",
  warning: "bg-warning-subtle border-warning text-warning",
  danger: "bg-danger-subtle border-danger text-danger",
  info: "bg-info-subtle border-info text-info",
  emerald: "bg-success-subtle border-success text-success",
  amber: "bg-warning-subtle border-warning text-warning",
  rose: "bg-danger-subtle border-danger text-danger",
  sky: "bg-info-subtle border-info text-info",
};

const iconSizeStyles: Record<TagChipIconSize, string> = {
  xs: "w-2.5 h-2.5",
  sm: "w-3 h-3",
};

/**
 * Small pill/badge for a single tag label, optionally with a leading icon.
 * Presentational by default; pass onClick (and selected) for filter-style chips.
 */
export default function TagChip({
  label,
  icon: Icon = Tag,
  iconSize = "xs",
  showIcon = true,
  variant = "default",
  onClick,
  selected = false,
  className,
  "data-testid": testId,
}: TagChipProps) {
  const interactive = typeof onClick === "function";
  const classes = cn(
    "inline-flex items-center gap-1 px-2 py-0.5 border rounded-full text-xs",
    variantStyles[variant],
    selected && "bg-accent-subtle border-accent text-accent-soft",
    interactive && "cursor-pointer transition-colors focus-ring hover:opacity-90",
    className,
  );

  const content = (
    <>
      {showIcon ? <Icon className={cn(iconSizeStyles[iconSize], "shrink-0")} aria-hidden="true" /> : null}
      <span className="truncate">{label}</span>
    </>
  );

  if (interactive) {
    return (
      <button type="button" onClick={onClick} className={classes} aria-pressed={selected} data-testid={testId}>
        {content}
      </button>
    );
  }

  return (
    <span className={classes} data-testid={testId}>
      {content}
    </span>
  );
}
