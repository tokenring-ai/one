import { Loader2 } from "lucide-react";
import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type FormActionBarVariant = "accent" | "emerald" | "sky" | "indigo" | "amber" | "red";
export type FormActionBarSize = "sm" | "md";

export interface FormActionBarProps {
  /** Label for the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Called when cancel is clicked */
  onCancel: () => void;
  /** Label for the primary button (e.g., "Save", "Send", "Create") */
  submitLabel: string;
  /** Icon for the primary button when not loading */
  submitIcon?: ElementType;
  /** Whether the primary button is in loading state */
  loading?: boolean;
  /** Whether to disable the primary button (in addition to loading) */
  disabled?: boolean;
  /**
   * Whether to disable the cancel button.
   * When omitted, cancel is disabled while `loading` is true.
   */
  cancelDisabled?: boolean;
  /** Color variant for the primary button (default: "accent") */
  variant?: FormActionBarVariant;
  /** Whether to show a top border and background (default: false) */
  separated?: boolean;
  /** Padding/spacing size (default: "sm") */
  size?: FormActionBarSize;
  /** Additional actions rendered between cancel and submit */
  actions?: ReactNode;
  className?: string;
  "data-testid"?: string;
}

const variantColors: Record<FormActionBarVariant, string> = {
  accent: "bg-accent hover:bg-accent-hover",
  emerald: "bg-emerald-600 hover:bg-emerald-500",
  sky: "bg-sky-600 hover:bg-sky-500",
  indigo: "bg-indigo-600 hover:bg-indigo-500",
  amber: "bg-amber-600 hover:bg-amber-500",
  red: "bg-red-600 hover:bg-red-500",
};

/**
 * Footer bar for forms: Cancel on the left of the action group, primary submit on the right.
 * Data-agnostic — only renders buttons; parent owns form state and submission.
 */
export default function FormActionBar({
  cancelLabel = "Cancel",
  onCancel,
  submitLabel,
  submitIcon: SubmitIcon,
  loading = false,
  disabled = false,
  cancelDisabled,
  variant = "accent",
  separated = false,
  size = "sm",
  actions,
  className,
  "data-testid": testId,
}: FormActionBarProps) {
  const submitDisabled = loading || disabled;
  // Default: disable cancel while loading so users can't dismiss mid-submit.
  const isCancelDisabled = cancelDisabled ?? loading;

  const pad = size === "md" ? "px-4 py-1.5" : "px-3 py-1.5";
  const submitPad = size === "md" ? "px-4 py-1.5" : "px-3 py-1.5";

  return (
    <div
      className={cn("flex items-center justify-end gap-2", separated ? "shrink-0 px-4 py-3 border-t border-primary bg-secondary" : "pt-1", className)}
      data-testid={testId}
    >
      <button
        type="button"
        onClick={onCancel}
        disabled={isCancelDisabled}
        className={cn(
          pad,
          "text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer transition-colors",
          "disabled:opacity-50 disabled:cursor-not-allowed",
        )}
      >
        {cancelLabel}
      </button>

      {actions}

      <button
        type="submit"
        disabled={submitDisabled}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-medium text-white rounded-lg focus-ring cursor-pointer shadow-sm",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          submitPad,
          variantColors[variant],
        )}
      >
        {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : SubmitIcon ? <SubmitIcon className="w-3.5 h-3.5" /> : null}
        {submitLabel}
      </button>
    </div>
  );
}
