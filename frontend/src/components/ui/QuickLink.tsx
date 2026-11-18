import { ArrowRight } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type QuickLinkSize = "sm" | "md";

export interface QuickLinkProps {
  /** Display title */
  title: string;
  /** Short description shown below the title */
  description: string;
  /** Icon rendered inside the gradient badge */
  icon: ReactNode;
  /** Tailwind gradient class for the icon badge (e.g. "from-red-500 to-rose-600") */
  gradient: string;
  /** Click handler */
  onClick: () => void;
  /** Optional size variant: sm for compact links, md for dashboard footer cards */
  size?: QuickLinkSize;
  className?: string;
  "data-testid"?: string;
}

const sizeStyles: Record<
  QuickLinkSize,
  {
    container: string;
    badge: string;
    icon: string;
    title: string;
  }
> = {
  sm: {
    container: "gap-2.5 px-3 py-2.5",
    badge: "w-8 h-8 rounded-lg",
    icon: "[&>svg]:w-3.5 [&>svg]:h-3.5",
    title: "text-xs font-medium text-primary",
  },
  md: {
    container: "gap-3 px-4 py-3",
    badge: "w-9 h-9 rounded-lg",
    icon: "[&>svg]:w-4 [&>svg]:h-4",
    title: "text-sm font-medium text-primary",
  },
};

/**
 * Card-style navigation button with a gradient icon badge, title, description, and trailing arrow.
 * Used for quick navigation links at the bottom of dashboards and related app entry points.
 */
export default function QuickLink({ title, description, icon, gradient, onClick, size = "md", className, "data-testid": testId }: QuickLinkProps) {
  const styles = sizeStyles[size];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center bg-secondary border border-primary rounded-xl text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer shadow-sm",
        styles.container,
        className,
      )}
      data-testid={testId}
    >
      <div className={cn("bg-linear-to-br flex items-center justify-center shrink-0 [&>svg]:text-white", styles.badge, styles.icon, gradient)}>{icon}</div>
      <div className="min-w-0 flex-1">
        <p className={styles.title}>{title}</p>
        <p className="text-xs text-muted">{description}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" aria-hidden="true" />
    </button>
  );
}
