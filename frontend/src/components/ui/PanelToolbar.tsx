import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export interface PanelToolbarProps {
  /** Icon component (e.g., from lucide-react) */
  icon: ElementType;
  /** Tailwind gradient classes (e.g., `"from-red-500 to-rose-600"`) */
  iconGradient: string;
  /** App title shown next to the icon */
  title?: string;
  /** Middle content: dropdowns, search, selectors (renders between title and divider) */
  middle?: ReactNode;
  /** Right-aligned action buttons */
  actions: ReactNode;
  /** Whether to show the vertical divider (default: true) */
  showDivider?: boolean;
  className?: string;
}

/**
 * Compact horizontal toolbar for app panes.
 *
 * Distinct from `AppPageHeader`, which targets dashboard pages (larger padding,
 * subtitle, responsive wrapping). PanelToolbar is a fixed-height (`h-11`) single
 * line with icon badge, optional title/middle content, and right-aligned actions.
 */
export default function PanelToolbar({ icon: Icon, iconGradient, title, middle, actions, showDivider = true, className }: PanelToolbarProps) {
  return (
    <div className={cn("shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3", className)}>
      <div className={cn("w-7 h-7 rounded-lg bg-linear-to-br flex items-center justify-center shadow-sm shrink-0", iconGradient)}>
        <Icon className="w-4 h-4 text-white" />
      </div>

      {title ? <span className="text-sm font-semibold text-primary shrink-0">{title}</span> : null}

      {middle != null ? <div className="flex-1 flex items-center gap-2 min-w-0">{middle}</div> : <div className="flex-1" />}

      {showDivider ? <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" /> : null}

      {actions}
    </div>
  );
}
