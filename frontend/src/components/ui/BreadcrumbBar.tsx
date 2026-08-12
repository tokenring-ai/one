import { ChevronRight } from "lucide-react";
import type { ElementType } from "react";
import { Fragment } from "react";
import { cn } from "../../lib/utils.ts";

export interface BreadcrumbSegment {
  /** Display label for this segment */
  label: string;
  /** Path or identifier for navigation */
  value: string;
}

export interface BreadcrumbAction {
  /** Icon component */
  icon: ElementType;
  /** Button label (hidden on small screens) */
  label?: string;
  /** Screen breakpoint for showing label: "sm" | "md" (default: "sm") */
  labelBreakpoint?: "sm" | "md";
  /** Click handler */
  onClick: () => void;
  /** Accessibility label */
  ariaLabel: string;
  /** Tooltip */
  title: string;
  /**
   * Optional alternate icon (e.g. EyeOff vs Eye for a toggle).
   * When provided, this is rendered instead of `icon`.
   */
  iconVariant?: ElementType;
}

export interface BreadcrumbBarProps {
  /** Path segments for the breadcrumb trail (after root) */
  segments: BreadcrumbSegment[];
  /** Label for the root segment (default: "root") */
  rootLabel?: string;
  /** Value passed to onNavigate when the root segment is clicked (default: ".") */
  rootValue?: string;
  /** Called when a segment (including root) is clicked */
  onNavigate: (value: string) => void;
  /** Right-aligned action buttons */
  actions?: BreadcrumbAction[];
  /** Container className override */
  className?: string;
}

const labelBreakpointClass = {
  sm: "hidden sm:inline",
  md: "hidden md:inline",
} as const;

function BreadcrumbActionButton({ icon: Icon, label, labelBreakpoint = "sm", onClick, ariaLabel, title, iconVariant: IconVariant }: BreadcrumbAction) {
  const ActionIcon = IconVariant ?? Icon;
  const hasLabel = Boolean(label);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      className={cn(
        "text-muted text-xs transition-colors focus-ring cursor-pointer",
        hasLabel ? "flex items-center gap-1 px-2 py-1 rounded-md hover:bg-hover" : "p-1.5 rounded-md hover:text-primary",
      )}
    >
      <ActionIcon className="w-3.5 h-3.5" />
      {hasLabel ? <span className={labelBreakpointClass[labelBreakpoint]}>{label}</span> : null}
    </button>
  );
}

/**
 * Horizontal breadcrumb navigation bar with a left-aligned path trail and
 * right-aligned action buttons. Data-source agnostic — pass pre-parsed segments
 * and optional actions.
 */
export default function BreadcrumbBar({ segments, rootLabel = "root", rootValue = ".", onNavigate, actions, className }: BreadcrumbBarProps) {
  return (
    <div className={cn("h-10 border-b border-primary bg-secondary flex items-center gap-1.5 px-3 shrink-0", className)}>
      <nav className="flex items-center gap-0.5 text-xs text-muted flex-1 min-w-0 overflow-hidden" aria-label="Breadcrumb">
        <button type="button" onClick={() => onNavigate(rootValue)} className="hover:text-primary shrink-0 focus-ring rounded px-1 cursor-pointer">
          {rootLabel}
        </button>
        {segments.map((segment, i) => {
          const isCurrent = i === segments.length - 1;
          return (
            <Fragment key={`${segment.value}-${i}`}>
              <ChevronRight className="w-3 h-3 shrink-0 text-dim" aria-hidden="true" />
              <button
                type="button"
                onClick={() => onNavigate(segment.value)}
                className={cn("hover:text-primary truncate focus-ring rounded px-1 cursor-pointer", isCurrent && "text-primary font-medium")}
                aria-current={isCurrent ? "page" : undefined}
              >
                {segment.label}
              </button>
            </Fragment>
          );
        })}
      </nav>

      {actions?.map((action, i) => (
        <BreadcrumbActionButton key={`${action.ariaLabel}-${i}`} {...action} />
      ))}
    </div>
  );
}
