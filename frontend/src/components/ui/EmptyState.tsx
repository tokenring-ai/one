import { Loader2, Plus } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

type EmptyStateVariant = "default" | "compact" | "card" | "page";
type CtaVariant = "accent" | "emerald" | "sky" | "indigo" | "amber" | "red";

interface EmptyStateProps {
  /** Icon component (e.g. from lucide-react). Sized and styled by the variant. */
  icon?: ElementType;
  /**
   * Renders the icon inside a rounded badge with these classes (typically a
   * gradient) instead of the default muted glyph — for hero-style empty screens.
   */
  iconBadgeClassName?: string;
  title: string;
  hint?: ReactNode;
  /** Label for the primary CTA button. Rendered only alongside `onCta`. */
  ctaLabel?: string;
  onCta?: () => void;
  /** Leading icon for the CTA button (default: Plus). */
  ctaIcon?: ElementType;
  /** Swaps the CTA icon for a spinner and disables the button. */
  ctaLoading?: boolean;
  ctaVariant?: CtaVariant;
  /** Arbitrary extra action (link, secondary button) rendered below the CTA. */
  action?: ReactNode;
  /**
   * default — plain panel inside an existing container
   * compact — tighter padding for nested lists
   * card    — dashed-border card that stands alone
   * page    — fills its parent and centers vertically
   */
  variant?: EmptyStateVariant;
  className?: string;
  children?: ReactNode;
  "data-testid"?: string;
}

const containerStyles: Record<EmptyStateVariant, string> = {
  default: "px-6 py-10 text-center",
  compact: "px-4 py-8 text-center",
  card: "px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl",
  page: "h-full flex flex-col items-center justify-center px-6 py-12 text-center",
};

const iconStyles: Record<EmptyStateVariant, string> = {
  default: "w-8 h-8 mb-3 opacity-50",
  compact: "w-6 h-6 mb-2 opacity-50",
  card: "w-8 h-8 mb-3 opacity-50",
  page: "w-12 h-12 mb-4 opacity-30",
};

// The page variant is a full-screen hero, so it carries heavier typography.
const titleStyles: Record<EmptyStateVariant, string> = {
  default: "text-sm font-medium text-primary mb-1",
  compact: "text-sm font-medium text-primary mb-1",
  card: "text-sm font-medium text-primary mb-1",
  page: "text-base font-semibold text-primary mb-2",
};

const hintStyles: Record<EmptyStateVariant, string> = {
  default: "text-xs text-muted max-w-sm mx-auto",
  compact: "text-xs text-muted max-w-sm mx-auto",
  card: "text-xs text-muted max-w-sm mx-auto",
  page: "text-sm text-muted leading-relaxed max-w-md mx-auto",
};

const ctaColors: Record<CtaVariant, string> = {
  accent: "bg-accent hover:bg-accent-hover",
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  sky: "bg-sky-600 hover:bg-sky-500",
  indigo: "bg-indigo-600 hover:bg-indigo-500",
  amber: "bg-amber-600 hover:bg-amber-500",
  red: "bg-red-600 hover:bg-red-500",
};

export default function EmptyState({
  icon: Icon,
  iconBadgeClassName,
  title,
  hint,
  ctaLabel,
  onCta,
  ctaIcon: CtaIcon = Plus,
  ctaLoading = false,
  ctaVariant = "accent",
  action,
  variant = "default",
  className,
  children,
  "data-testid": testId,
}: EmptyStateProps) {
  // The compact variant nests inside dense lists, so its CTA shrinks to match.
  const smallCta = variant === "compact";

  return (
    <div className={cn(containerStyles[variant], className)} data-testid={testId}>
      {Icon &&
        (iconBadgeClassName ? (
          <div className={cn("w-14 h-14 rounded-2xl mx-auto mb-5 flex items-center justify-center shadow-lg", iconBadgeClassName)}>
            <Icon className="w-7 h-7 text-white" />
          </div>
        ) : (
          <Icon className={cn("text-muted mx-auto", iconStyles[variant])} />
        ))}
      <p className={titleStyles[variant]}>{title}</p>
      {hint && <p className={hintStyles[variant]}>{hint}</p>}
      {children}
      {ctaLabel && onCta && (
        <button
          type="button"
          onClick={onCta}
          disabled={ctaLoading}
          className={cn(
            "mt-4 inline-flex items-center justify-center gap-2 font-medium text-white rounded-lg transition-colors focus-ring cursor-pointer shadow-sm",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            smallCta ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm",
            ctaColors[ctaVariant],
          )}
        >
          {ctaLoading ? (
            <Loader2 className={cn(smallCta ? "w-3.5 h-3.5" : "w-4 h-4", "animate-spin")} />
          ) : (
            <CtaIcon className={smallCta ? "w-3.5 h-3.5" : "w-4 h-4"} />
          )}
          {ctaLabel}
        </button>
      )}
      {action && <div className="mt-4 flex justify-center">{action}</div>}
    </div>
  );
}
