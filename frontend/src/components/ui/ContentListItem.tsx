import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export interface ContentListItemProps {
  /** Whether this item is currently selected */
  selected: boolean;
  /** Click handler */
  onClick: () => void;
  /** Primary title/label text */
  title: ReactNode;
  /** Secondary title or subtitle (e.g., subject line) */
  subtitle?: ReactNode;
  /** Status badge or trailing content at the end of the title row */
  status?: ReactNode;
  /** Metadata row content (date, tags, etc.) */
  metadata?: ReactNode;
  /** Optional snippet/preview text below metadata */
  snippet?: ReactNode;
  /** Unread/attention indicator (e.g., a corner dot) */
  indicator?: ReactNode;
  /** Accent color class for the left border when selected (default: "border-l-accent") */
  selectedBorderColor?: string;
  /**
   * Emphasize the item (e.g., unread). Uses stronger title/subtitle weight and color.
   * When false, title color follows selection state.
   */
  emphasized?: boolean;
  className?: string;
  "data-testid"?: string;
}

/**
 * Selectable list item shell for content entries (posts, emails, files, etc.).
 * Provides shared selection chrome (left-border accent, hover, focus, aria-current);
 * consumers supply domain-specific title, status, metadata, and snippet nodes.
 */
export default function ContentListItem({
  selected,
  onClick,
  title,
  subtitle,
  status,
  metadata,
  snippet,
  indicator,
  selectedBorderColor = "border-l-accent",
  emphasized = false,
  className,
  "data-testid": testId,
}: ContentListItemProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full flex flex-col gap-1 px-3 py-3 text-left border-b border-primary hover:bg-hover transition-colors focus-ring cursor-pointer border-l-2",
        selected ? cn("bg-active", selectedBorderColor) : "border-l-transparent",
        className,
      )}
      aria-current={selected ? "true" : undefined}
      data-testid={testId}
    >
      <div className={cn("flex items-start justify-between gap-2", indicator != null && "pr-3")}>
        <span
          className={cn(
            "flex-1 min-w-0 truncate",
            // Compact title when a subtitle row is present (e.g. email sender + subject);
            // larger title for single-line primary content (e.g. blog post title).
            subtitle != null ? "text-xs" : "text-sm font-medium leading-tight",
            emphasized ? "text-primary font-semibold" : selected ? "text-primary" : subtitle != null ? "text-muted" : "text-secondary",
          )}
        >
          {title}
        </span>
        {status != null ? status : null}
      </div>

      {subtitle != null ? <span className={cn("text-xs truncate", emphasized ? "text-secondary font-medium" : "text-muted")}>{subtitle}</span> : null}

      {metadata != null ? <div className="flex items-center gap-2 text-xs text-muted min-w-0">{metadata}</div> : null}

      {snippet != null ? <span className="text-xs text-muted truncate">{snippet}</span> : null}

      {indicator != null ? indicator : null}
    </button>
  );
}
