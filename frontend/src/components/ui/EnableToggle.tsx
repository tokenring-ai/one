import { Loader2, Power, PowerOff } from "lucide-react";
import type { ElementType } from "react";
import { cn } from "../../lib/utils.ts";

export interface EnableToggleColorSet {
  bg: string;
  text: string;
  border: string;
  hover: string;
}

export interface EnableToggleProps {
  /** Whether the item is currently enabled */
  enabled: boolean;
  /** Called when the user toggles the item */
  onToggle: () => void;
  /** Whether an async operation is in progress */
  loading?: boolean;
  /** Whether the button is disabled (independent of loading) */
  disabled?: boolean;
  /** Human-readable name for aria-label (e.g., "email_send") */
  itemName: string;
  /** Size variant: "sm" (compact) | "md" (default) */
  size?: "sm" | "md";
  /** Whether to show text labels ("On"/"Off"). When false, icon-only. */
  showLabels?: boolean;
  /** Custom icon override for enabled state (default: Power) */
  enabledIcon?: ElementType;
  /** Custom icon override for disabled state (default: PowerOff) */
  disabledIcon?: ElementType;
  /** Custom enabled state colors (default: violet) */
  enabledColors?: EnableToggleColorSet;
  /** Custom disabled state colors */
  disabledColors?: EnableToggleColorSet;
  /** Additional class names */
  className?: string;
  "data-testid"?: string;
}

const DEFAULT_ENABLED_COLORS: EnableToggleColorSet = {
  bg: "bg-violet-500/10",
  text: "text-violet-600 dark:text-violet-400",
  border: "border-violet-500/30",
  hover: "hover:bg-violet-500/20",
};

const DEFAULT_DISABLED_COLORS: EnableToggleColorSet = {
  bg: "bg-tertiary",
  text: "text-muted",
  border: "border-primary",
  hover: "hover:text-primary hover:bg-hover",
};

const sizeStyles = {
  sm: {
    button: "p-1.5",
    icon: "w-3.5 h-3.5",
  },
  md: {
    button: "px-2 py-1",
    icon: "w-3 h-3",
  },
} as const;

/**
 * Compact on/off toggle for enabling or disabling an item (tool, hook, skill, etc.).
 * Shows Power/PowerOff (or custom icons) with optional "On"/"Off" labels, and a spinner while loading.
 */
export default function EnableToggle({
  enabled,
  onToggle,
  loading = false,
  disabled = false,
  itemName,
  size = "md",
  showLabels = true,
  enabledIcon: EnabledIcon = Power,
  disabledIcon: DisabledIcon = PowerOff,
  enabledColors = DEFAULT_ENABLED_COLORS,
  disabledColors = DEFAULT_DISABLED_COLORS,
  className,
  "data-testid": testId,
}: EnableToggleProps) {
  const colors = enabled ? enabledColors : disabledColors;
  const { button: sizeButton, icon: iconSize } = sizeStyles[size];
  const ariaLabel = enabled ? `Disable ${itemName}` : `Enable ${itemName}`;

  return (
    <button
      type="button"
      onClick={onToggle}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center gap-1 rounded-md text-xs font-medium border transition-colors focus-ring disabled:opacity-50",
        sizeButton,
        colors.bg,
        colors.text,
        colors.border,
        colors.hover,
        className,
      )}
      aria-pressed={enabled}
      aria-label={ariaLabel}
      title={ariaLabel}
      data-testid={testId}
    >
      {loading ? (
        <Loader2 className={cn(iconSize, "animate-spin")} aria-hidden="true" />
      ) : enabled ? (
        <EnabledIcon className={iconSize} aria-hidden="true" />
      ) : (
        <DisabledIcon className={iconSize} aria-hidden="true" />
      )}
      {showLabels ? (enabled ? "On" : "Off") : null}
    </button>
  );
}
