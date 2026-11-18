import { FocusTrap } from "focus-trap-react";
import { X } from "lucide-react";
import { type ElementType, type ReactNode, useEffect, useId } from "react";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { cn } from "../../lib/utils.ts";
import Button, { type ButtonVariant } from "../../ui/button.tsx";

export interface ModalShellProps {
  /** Whether the modal is shown; false renders nothing (default true) */
  open?: boolean;
  /** Dialog title */
  title: string;
  /** Called when the user dismisses the modal (Escape, close button, backdrop, cancel) */
  onClose: () => void;
  /** Dialog body content, rendered between the header and the footer */
  children: ReactNode;
  /** Optional description rendered under the title */
  description?: ReactNode;
  /** Modal card width class (default "w-80") */
  width?: string;
  /** Extra classes on the dialog card */
  className?: string;
  /** Whether the card keeps the default p-5 padding (default true) */
  padded?: boolean;
  /** Extra classes on the backdrop overlay */
  backdropClassName?: string;
  /** Whether to trap focus inside the dialog (default true) */
  focusTrap?: boolean;
  /** Allow clicking the backdrop to dismiss (default false) */
  closeOnBackdrop?: boolean;
  /** In-flight flag: Escape, close, cancel and confirm are disabled while true */
  busy?: boolean;
  /** Show the header X close button (default true; false renders a bare heading like ConfirmModal) */
  showCloseButton?: boolean;
  /** Optional icon rendered before the title in the header */
  headerIcon?: ReactNode;
  /** Replaces the default header row classes (title + close button) */
  headerClassName?: string;
  /** Extra classes on the dialog title */
  titleClassName?: string;
  /** Replaces the built-in cancel/confirm footer */
  footer?: ReactNode;
  /** Extra classes on the built-in footer row */
  footerClassName?: string;
  /** Error message shown just above the footer (e.g. a failed async action) */
  error?: string | null;
  /** Cancel button label (default "Cancel") */
  cancelLabel?: string;
  /** Confirm button label */
  confirmLabel?: string;
  /** Leading icon on the confirm button; replaced by a spinner while busy */
  confirmIcon?: ElementType | null;
  /** Extra disable condition for the confirm button (in addition to busy) */
  confirmDisabled?: boolean;
  /** Confirm button color. `confirmClassName` still overrides it for older callers. */
  tone?: "default" | "danger" | "warning";
  /** Extra classes for the confirm button. Prefer `tone`. */
  confirmClassName?: string;
  /** Auto-focus the confirm button on mount (default false) */
  autoFocusConfirm?: boolean;
  /** Action executed when the confirm button is clicked */
  onConfirm?: () => void;
}

/**
 * Open ModalShells in the order they opened. Only the last (topmost) one answers Escape, so a
 * confirm dialog stacked on an editor modal closes alone instead of taking its parent with it.
 */
const escapeStack: symbol[] = [];

/**
 * Shared dialog chrome for the app's modals: Escape-to-close listener, FocusTrap,
 * backdrop, title / close button header, error line, and a Cancel/confirm footer.
 * Body content and per-modal styling come in through props so every modal keeps
 * its own look while sharing the behavior.
 */
export default function ModalShell({
  open = true,
  title,
  onClose,
  children,
  description,
  width = "w-80",
  className,
  padded = true,
  backdropClassName,
  focusTrap = true,
  closeOnBackdrop = false,
  busy = false,
  showCloseButton = true,
  headerIcon,
  headerClassName,
  titleClassName,
  footer,
  footerClassName,
  error,
  cancelLabel = "Cancel",
  confirmLabel,
  confirmIcon,
  confirmDisabled = false,
  tone = "default",
  confirmClassName,
  autoFocusConfirm = false,
  onConfirm,
}: ModalShellProps) {
  const titleId = useId();

  // Escape dismisses the topmost modal when not mid-action. onClose/busy are read through refs
  // so a re-render never re-registers (which would reorder the stack).
  const onCloseRef = useRefSync(onClose);
  const busyRef = useRefSync(busy);
  useEffect(() => {
    if (!open) return;
    const token = Symbol("modal");
    escapeStack.push(token);
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (escapeStack[escapeStack.length - 1] !== token) return;
      // A busy top modal still owns Escape: it must not fall through to the one beneath.
      e.preventDefault();
      if (!busyRef.current) onCloseRef.current();
    };
    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
      const index = escapeStack.lastIndexOf(token);
      if (index !== -1) escapeStack.splice(index, 1);
    };
  }, [open]);

  const confirmVariant: ButtonVariant = tone === "danger" ? "danger" : tone === "warning" ? "warning" : "primary";

  const dialog = (
    <div
      className={cn("fixed inset-0 z-modal flex items-center justify-center bg-overlay backdrop-blur-sm", backdropClassName)}
      onClick={
        closeOnBackdrop
          ? e => {
              if (e.target === e.currentTarget && !busy) onClose();
            }
          : undefined
      }
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className={cn("bg-secondary border border-primary rounded-xl shadow-xl", padded && "p-5", width, className)}
      >
        {showCloseButton || headerIcon || description ? (
          <div className={headerClassName ?? "flex items-center justify-between mb-4"}>
            <div className={cn("min-w-0", headerIcon && "flex items-center gap-2")}>
              {headerIcon}
              <div className="min-w-0">
                <h2 id={titleId} className={cn("text-sm font-semibold text-primary", titleClassName)}>
                  {title}
                </h2>
                {description && <p className="text-xs text-muted mt-0.5">{description}</p>}
              </div>
            </div>
            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                disabled={busy}
                className="p-1 text-muted hover:text-primary focus-ring rounded shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <h2 id={titleId} className={cn("text-sm font-semibold text-primary mb-2", titleClassName)}>
            {title}
          </h2>
        )}

        {children}

        {error && (
          <p className="text-xs text-danger mt-3" role="alert">
            {error}
          </p>
        )}

        {footer ??
          (onConfirm ? (
            <div className={cn("flex gap-2", footerClassName)}>
              <Button type="button" variant="secondary" size="sm" className="flex-1" onClick={onClose} disabled={busy}>
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant={confirmVariant}
                size="sm"
                className={cn("flex-1", confirmClassName)}
                busy={busy}
                disabled={confirmDisabled}
                onClick={onConfirm}
                {...(confirmIcon ? { icon: confirmIcon } : {})}
                {...(autoFocusConfirm ? { autoFocus: true } : {})}
              >
                {confirmLabel}
              </Button>
            </div>
          ) : null)}
      </div>
    </div>
  );

  if (!open) return null;
  if (!focusTrap) return dialog;
  // ModalShell owns Escape (topmost-only, above). focus-trap's own Escape handling would
  // preventDefault the event first and deactivate the trap while the modal stays open.
  return <FocusTrap focusTrapOptions={{ escapeDeactivates: false }}>{dialog}</FocusTrap>;
}
