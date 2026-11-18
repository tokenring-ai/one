import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";
import TagChip from "./TagChip.tsx";

export interface ViewerHeaderProps {
  /** Primary title (e.g. filename) */
  title: string;
  /** Secondary info (e.g. dimensions, duration) */
  subtitle?: string;
  /** Keywords rendered as TagChip components */
  keywords?: string[];
  /** Action buttons rendered in a flex row */
  actions?: ReactNode;
  /** Close callback; omit to hide the close button */
  onClose?: () => void;
  className?: string;
  "data-testid"?: string;
}

/**
 * Header for detail/detail-viewer panels: title + optional subtitle, close control,
 * keyword tags, and an actions row.
 */
export default function ViewerHeader({ title, subtitle, keywords, actions, onClose, className, "data-testid": testId }: ViewerHeaderProps) {
  return (
    <div className={cn("shrink-0 px-5 pt-5 pb-4 border-b border-primary space-y-3", className)} data-testid={testId}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-xs text-muted truncate font-mono">{title}</span>
          {subtitle ? <span className="text-xs text-muted shrink-0">{subtitle}</span> : null}
        </div>
        {onClose ? (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 text-muted hover:text-primary transition-colors rounded focus-ring cursor-pointer shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        ) : null}
      </div>

      {keywords && keywords.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {keywords.map(k => (
            <TagChip key={k} label={k} showIcon={false} />
          ))}
        </div>
      ) : null}

      {actions ? <div className="flex items-center gap-2 flex-wrap">{actions}</div> : null}
    </div>
  );
}
