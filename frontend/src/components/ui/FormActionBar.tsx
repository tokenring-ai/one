import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";
import Button, { type ButtonVariant } from "../../ui/button.tsx";

type VariantName = "accent" | "primary" | "emerald" | "sky" | "indigo" | "amber" | "red" | "danger";

/** @deprecated Palette names map onto `primary`, `warning` (amber) or `danger` (red). Prefer those. */
export type FormActionBarVariant = VariantName;
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
  variant?: VariantName;
  /** Whether to show a top border and background (default: false) */
  separated?: boolean;
  /** Padding/spacing size (default: "sm") */
  size?: FormActionBarSize;
  /** Additional actions rendered between cancel and submit */
  actions?: ReactNode;
  /**
   * Leading content shown before the buttons — a validation summary or save
   * feedback. Takes the remaining width, so the buttons stay right-aligned.
   */
  status?: ReactNode | undefined;
  /**
   * Click handler for the primary button. Given one, the button becomes a plain
   * button rather than a form submit, so the bar also works outside a `<form>`.
   */
  onSubmit?: (() => void) | undefined;
  className?: string;
  "data-testid"?: string;
}

const variantToButton: Record<VariantName, ButtonVariant> = {
  accent: "primary",
  primary: "primary",
  emerald: "primary",
  sky: "primary",
  indigo: "primary",
  amber: "warning",
  red: "danger",
  danger: "danger",
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
  status,
  onSubmit,
  className,
  "data-testid": testId,
}: FormActionBarProps) {
  // Default: disable cancel while loading so users can't dismiss mid-submit.
  const isCancelDisabled = cancelDisabled ?? loading;

  return (
    <div
      className={cn("flex items-center justify-end gap-2", separated ? "shrink-0 px-4 py-3 border-t border-primary bg-secondary" : "pt-1", className)}
      data-testid={testId}
    >
      {status != null ? <div className="flex-1 min-w-0 text-xs">{status}</div> : null}
      <Button type="button" variant="secondary" size={size} onClick={onCancel} disabled={isCancelDisabled}>
        {cancelLabel}
      </Button>

      {actions}

      <Button
        type={onSubmit ? "button" : "submit"}
        variant={variantToButton[variant]}
        size={size}
        busy={loading}
        disabled={disabled}
        {...(SubmitIcon ? { icon: SubmitIcon } : {})}
        {...(onSubmit ? { onClick: onSubmit } : {})}
      >
        {submitLabel}
      </Button>
    </div>
  );
}
