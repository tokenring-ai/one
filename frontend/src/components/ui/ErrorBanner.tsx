import { AlertCircle, AlertTriangle, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type ErrorBannerVariant = "warning" | "error" | "info";

export interface ErrorBannerProps {
  /** Banner title */
  title: string;
  /** Detailed message */
  message: string;
  /** Visual variant (default: "warning") */
  variant?: ErrorBannerVariant;
  /** Optional leading icon (default: AlertTriangle for warning/error, Info for info) */
  icon?: ReactNode;
  /** Optional action button (e.g., "Retry") */
  action?: { label: string; onClick: () => void };
  /** Container className override */
  className?: string;
  "data-testid"?: string;
}

const variantStyles: Record<
  ErrorBannerVariant,
  {
    container: string;
    icon: string;
    action: string;
  }
> = {
  warning: {
    container: "bg-warning/10 border-b border-warning/30",
    icon: "text-warning",
    action: "text-warning hover:bg-warning/20",
  },
  error: {
    container: "bg-red-500/10 border-b border-red-500/30",
    icon: "text-red-500",
    action: "text-red-500 hover:bg-red-500/20",
  },
  info: {
    container: "bg-accent/10 border-b border-accent/30",
    icon: "text-accent",
    action: "text-accent hover:bg-accent/20",
  },
};

function defaultIcon(variant: ErrorBannerVariant, iconClassName: string): ReactNode {
  if (variant === "info") {
    return <Info className={iconClassName} aria-hidden="true" />;
  }
  if (variant === "error") {
    return <AlertCircle className={iconClassName} aria-hidden="true" />;
  }
  return <AlertTriangle className={iconClassName} aria-hidden="true" />;
}

/**
 * Inline error/warning/info banner displayed at the top of a panel or page.
 * Shows an icon, title, detail message, and optional action button.
 */
export default function ErrorBanner({ title, message, variant = "warning", icon, action, className, "data-testid": testId }: ErrorBannerProps) {
  const styles = variantStyles[variant];
  const iconClassName = cn("w-4 h-4 shrink-0 mt-0.5", styles.icon);

  return (
    <div role="alert" className={cn("shrink-0 px-4 py-2.5 flex items-start gap-2", styles.container, className)} data-testid={testId}>
      {icon ?? defaultIcon(variant, iconClassName)}
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-primary">{title}</p>
        <p className="text-xs text-muted">{message}</p>
      </div>
      {action ? (
        <button
          type="button"
          onClick={action.onClick}
          className={cn("shrink-0 self-center px-2 py-1 text-xs font-medium rounded-md transition-colors focus-ring cursor-pointer", styles.action)}
        >
          {action.label}
        </button>
      ) : null}
    </div>
  );
}
