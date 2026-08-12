import { type ReactElement, useCallback, useEffect, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal.tsx";
import { useRefSync } from "./useRefSync.ts";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  /** Confirm button label (maps to ConfirmModal `confirmLabel`) */
  confirmText?: string;
  /** Cancel button label (maps to ConfirmModal `cancelLabel`) */
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
}

export interface UseConfirmDialogReturn {
  /** Whether the dialog is currently open */
  isOpen: boolean;
  /** Current dialog options frozen at open time, or null when closed */
  options: ConfirmDialogOptions | null;
  /**
   * Open a confirmation dialog and return a promise that resolves
   * to `true` if confirmed, `false` if cancelled.
   *
   * If called while a dialog is already open, the previous promise
   * resolves `false` and the new options replace it.
   */
  openConfirm: (options: ConfirmDialogOptions) => Promise<boolean>;
  /** Close the dialog and resolve the pending promise with `false` */
  close: () => void;
  /** Confirm the dialog and resolve the pending promise with `true` */
  confirm: () => void;
  /**
   * Renders ConfirmModal when open.
   * Parent must mount this once: `<Dialog />`
   */
  Dialog: () => ReactElement | null;
}

/**
 * Promise-based confirmation dialog state for ConfirmModal.
 *
 * Freezes options at open time so a rapid selection change cannot retarget
 * the action, and returns a single render point instead of one state flag
 * per destructive action.
 *
 * @example
 * const { openConfirm, Dialog } = useConfirmDialog();
 *
 * const handleDelete = async (name: string) => {
 *   const ok = await openConfirm({
 *     title: "Delete?",
 *     message: `Delete "${name}"?`,
 *     confirmText: "Delete",
 *     variant: "danger",
 *   });
 *   if (!ok) return;
 *   await deleteItem(name);
 * };
 *
 * // In JSX:
 * <Dialog />
 */
export function useConfirmDialog(): UseConfirmDialogReturn {
  const [pending, setPending] = useState<{
    options: ConfirmDialogOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const pendingRef = useRefSync(pending);

  // Resolve any in-flight promise on unmount so callers never hang.
  useEffect(() => {
    return () => {
      const current = pendingRef.current;
      if (current) current.resolve(false);
    };
  }, []);

  const settle = useCallback((value: boolean) => {
    const current = pendingRef.current;
    if (!current) return;
    setPending(null);
    current.resolve(value);
  }, []);

  const close = useCallback(() => {
    settle(false);
  }, [settle]);

  const confirm = useCallback(() => {
    settle(true);
  }, [settle]);

  const openConfirm = useCallback((options: ConfirmDialogOptions): Promise<boolean> => {
    return new Promise<boolean>(resolve => {
      const existing = pendingRef.current;
      if (existing) existing.resolve(false);
      setPending({ options, resolve });
    });
  }, []);

  const Dialog = useCallback((): ReactElement | null => {
    if (!pending) return null;
    const { options } = pending;
    return (
      <ConfirmModal
        title={options.title}
        message={options.message}
        // Preserve prior ConfirmDialog default ("Confirm") when callers omit a label.
        confirmLabel={options.confirmText ?? "Confirm"}
        {...(options.cancelText !== undefined ? { cancelLabel: options.cancelText } : {})}
        {...(options.variant !== undefined ? { variant: options.variant } : {})}
        // Promise callers settle then run the action; hide default trash so
        // non-delete danger confirms (reset, close, clear) stay icon-free.
        confirmIcon={null}
        onConfirm={confirm}
        onClose={close}
      />
    );
  }, [pending, confirm, close]);

  return {
    isOpen: pending !== null,
    options: pending?.options ?? null,
    openConfirm,
    close,
    confirm,
    Dialog,
  };
}
