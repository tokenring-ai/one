import type { KeyboardEvent, ReactNode } from "react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";

export interface ActionLink {
  /** Label shown on the link/button */
  label: string;
  /** Icon rendered before the label */
  icon: ReactNode;
  /** Click handler (used when href is not set) */
  onClick?: () => void;
  /** Navigation target; renders a router Link when set */
  href?: string;
  /** Optional tooltip */
  title?: string;
  /** Whether this action is primary (more prominent styling) */
  primary?: boolean;
}

export interface PlatformCardProps {
  /** Display name of the platform/service */
  name: string;
  /** Short description shown below the name */
  description: string;
  /** Detail/status text shown below the description */
  detail: string;
  /** Tailwind gradient class for the icon badge (e.g. "from-purple-500 to-violet-600") */
  gradient: string;
  /** Optional icon rendered inside the gradient badge */
  icon?: ReactNode;
  /** Status badge rendered next to the name */
  statusBadge?: ReactNode;
  /** Array of action links rendered at the bottom */
  actions?: ActionLink[];
  /** Whether the card is in a muted/disabled state */
  muted?: boolean;
  /** When set, the card body is clickable (action clicks do not bubble) */
  onClick?: () => void;
  className?: string;
  "data-testid"?: string;
}

const actionBaseClass =
  "inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-primary bg-tertiary transition-colors focus-ring";

function ActionButton({ action }: { action: ActionLink }) {
  const className = cn(
    actionBaseClass,
    action.primary ? "text-primary hover:bg-hover hover:border-accent-muted" : "text-muted hover:text-primary hover:bg-hover",
  );

  // Stop propagation so action clicks do not trigger the card's onClick.
  const stop = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
  };

  if (action.href) {
    return (
      <Link to={action.href} className={className} title={action.title} onClick={stop}>
        {action.icon}
        {action.label}
      </Link>
    );
  }

  return (
    <button
      type="button"
      onClick={event => {
        stop(event);
        action.onClick?.();
      }}
      className={cn(className, "cursor-pointer")}
      title={action.title}
    >
      {action.icon}
      {action.label}
    </button>
  );
}

/**
 * Rich entity card for an integration, platform, or service.
 * Shows a gradient icon badge, name, optional status badge, description,
 * detail text, and contextual action links.
 *
 * Supports non-clickable cards (default) and whole-card click via `onClick`.
 * When both `onClick` and `actions` are set, action clicks do not bubble.
 */
export default function PlatformCard({
  name,
  description,
  detail,
  gradient,
  icon,
  statusBadge,
  actions,
  muted = false,
  onClick,
  className,
  "data-testid": testId,
}: PlatformCardProps) {
  const hasActions = actions != null && actions.length > 0;
  const isClickable = onClick != null;
  // Only expose a button role when the whole card is the sole interactive target.
  // When actions are present, avoid nesting interactive controls inside a button role.
  const cardAsButton = isClickable && !hasActions;

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (!cardAsButton) return;
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onClick();
    }
  };

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl transition-colors",
        muted ? "opacity-80" : "hover:border-accent-muted",
        isClickable && "cursor-pointer",
        cardAsButton && "focus-ring",
        className,
      )}
      onClick={onClick}
      onKeyDown={cardAsButton ? onKeyDown : undefined}
      role={cardAsButton ? "button" : undefined}
      tabIndex={cardAsButton ? 0 : undefined}
      data-testid={testId}
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "w-8 h-8 rounded-lg bg-linear-to-br shrink-0 flex items-center justify-center",
            icon != null && "[&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-white",
            gradient,
          )}
          aria-hidden="true"
        >
          {icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-primary">{name}</p>
            {statusBadge}
          </div>
          <p className="text-xs text-muted mt-0.5">{description}</p>
          <p className="text-xs text-secondary mt-1.5 leading-relaxed">{detail}</p>
        </div>
      </div>

      {hasActions ? (
        <div className="flex flex-wrap items-center gap-1.5">
          {actions.map(action => (
            <ActionButton key={`${action.label}:${action.href ?? ""}`} action={action} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
