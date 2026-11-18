import formatError from "@tokenring-ai/utility/error/formatError";
import { Trash2 } from "lucide-react";
import { type ElementType, useId, useState } from "react";
import { setConfirmSkipped } from "../../lib/uiPreferences.ts";
import { cn } from "../../lib/utils.ts";
import ModalShell from "./ModalShell.tsx";

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
  /**
   * Show a “Don't ask again” checkbox. When checked and confirm succeeds,
   * the skip is stored under `dontAskAgainKey` (default: `title`).
   * @default true
   */
  showDontAskAgain?: boolean;
  /**
   * localStorage skip key. Defaults to `title`.
   * Pass a stable, feature-qualified key (e.g. "checkpoints:delete") when the
   * title is generic, so unrelated features don't share the skip flag.
   */
  dontAskAgainKey?: string;
}

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
  showDontAskAgain = true,
  dontAskAgainKey,
}: ConfirmModalProps) {
  const [confirming, setConfirming] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dontAskAgainId = useId();
  const skipKey = dontAskAgainKey ?? title;

  const handleConfirm = async () => {
    setConfirming(true);
    setError(null);
    try {
      await onConfirm();
      if (showDontAskAgain && dontAskAgain) setConfirmSkipped(skipKey, true);
    } catch (e: unknown) {
      setError(formatError(e));
    } finally {
      setConfirming(false);
    }
  };

  // undefined → variant default; null → no icon; ElementType → custom icon
  const Icon = confirmIcon === undefined ? (variant === "danger" ? Trash2 : null) : confirmIcon;

  return (
    <ModalShell
      title={title}
      onClose={onClose}
      busy={confirming}
      focusTrap={focusTrap}
      closeOnBackdrop={closeOnBackdrop}
      showCloseButton={false}
      error={error}
      cancelLabel={cancelLabel}
      confirmLabel={confirmLabel}
      confirmIcon={Icon}
      tone={variant === "info" ? "default" : variant}
      autoFocusConfirm={autoFocusConfirm}
      onConfirm={() => void handleConfirm()}
    >
      <p className={cn("text-xs text-muted", showDontAskAgain ? "mb-3" : "mb-4")}>{message}</p>
      {showDontAskAgain ? (
        <label htmlFor={dontAskAgainId} className="flex items-center gap-2 mb-4 cursor-pointer select-none">
          <input
            id={dontAskAgainId}
            type="checkbox"
            checked={dontAskAgain}
            onChange={e => setDontAskAgain(e.target.checked)}
            disabled={confirming}
            className="accent-accent cursor-pointer disabled:cursor-not-allowed"
          />
          <span className="text-xs text-muted">Don't ask again</span>
        </label>
      ) : null}
    </ModalShell>
  );
}
