import { Tag } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";

export type TagChipVariant = "default" | "accent" | "emerald" | "amber" | "rose" | "sky";
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
  default: "bg-tertiary border-primary text-muted",
  accent: "bg-accent-subtle border-accent text-accent-soft",
  emerald: "bg-emerald-500/10 border-emerald-500/30 text-emerald-600 dark:text-emerald-400",
  amber: "bg-amber-500/10 border-amber-500/30 text-amber-600 dark:text-amber-400",
  rose: "bg-rose-500/10 border-rose-500/30 text-rose-600 dark:text-rose-400",
  sky: "bg-sky-500/10 border-sky-500/30 text-sky-600 dark:text-sky-400",
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
