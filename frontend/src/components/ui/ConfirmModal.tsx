import { FocusTrap } from "focus-trap-react";
import { Loader2, Trash2 } from "lucide-react";
import { type ElementType, useEffect, useId, useState } from "react";
import { cn } from "../../lib/utils.ts";

export interface ConfirmModalProps {
  /** Dialog title */
  title: string;
  /** Descriptive message explaining the action */
  message: string;
  /** Label on the confirm button (default: "Delete") */
  confirmLabel?: string;
  /** Label on the cancel button (default: "Cancel") */
  cancelLabel?: string;
  /** Visual variant: red destructive, amber warning, accent info (default: "danger") */
  variant?: "danger" | "warning" | "info";
  /**
   * Leading icon on the confirm button.
   * Defaults to Trash2 for danger and null for warning/info; pass null to hide.
   */
  confirmIcon?: ElementType | null;
  /** Async action to execute on confirm. Parent typically unmounts the modal on success. */
  onConfirm: () => void | Promise<void>;
  /** Called when the user cancels or the modal is dismissed */
  onClose: () => void;
  /** Whether to trap focus inside the dialog (default: true) */
  focusTrap?: boolean;
  /** Allow clicking the backdrop to dismiss (default: false) */
  closeOnBackdrop?: boolean;
  /** Auto-focus the confirm button on mount (default: true) */
  autoFocusConfirm?: boolean;
}

const variantClasses = {
  danger: "bg-red-600 hover:bg-red-500 text-white",
  warning: "bg-amber-600 hover:bg-amber-500 text-white",
  info: "bg-accent hover:bg-accent-hover text-white",
} as const;

export default function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  cancelLabel = "Cancel",
  variant = "danger",
  confirmIcon,
  onConfirm,
  onClose,
  focusTrap = true,
  closeOnBackdrop = false,
  autoFocusConfirm = true,
}: ConfirmModalProps) {
  const [confirming, setConfirming] = useState(false);
  const titleId = useId();

  // Escape dismisses when not mid-confirm (matches WorkflowsApp / SaveAsModal patterns).
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !confirming) onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose, confirming]);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  // undefined → variant default; null → no icon; ElementType → custom icon
  const Icon = confirmIcon === undefined ? (variant === "danger" ? Trash2 : null) : confirmIcon;

  const dialog = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={e => {
        if (closeOnBackdrop && e.target === e.currentTarget && !confirming) onClose();
      }}
    >
      <div role="dialog" aria-modal="true" aria-labelledby={titleId} className="bg-secondary border border-primary rounded-xl p-5 w-80 shadow-xl">
        <h2 id={titleId} className="text-sm font-semibold text-primary mb-2">
          {title}
        </h2>
        <p className="text-xs text-muted mb-4">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={confirming}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming}
            autoFocus={autoFocusConfirm}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed",
              variantClasses[variant],
            )}
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : Icon ? <Icon className="w-3.5 h-3.5" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );

  if (!focusTrap) return dialog;
  return <FocusTrap>{dialog}</FocusTrap>;
}
