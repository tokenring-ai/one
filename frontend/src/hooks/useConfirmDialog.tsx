import { type ReactElement, useCallback, useEffect, useMemo, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal.tsx";
import {
  CONFIRM_SKIPS_CHANGED_EVENT,
  type ConfirmSkips,
  clearConfirmSkips,
  isConfirmSkipped,
  readConfirmSkips,
  setConfirmSkipped,
} from "../lib/uiPreferences.ts";
import { useRefSync } from "./useRefSync.ts";

export interface ConfirmDialogOptions {
  title: string;
  message: string;
  /** Confirm button label (maps to ConfirmModal `confirmLabel`) */
  confirmText?: string;
  /** Cancel button label (maps to ConfirmModal `cancelLabel`) */
  cancelText?: string;
  variant?: "danger" | "warning" | "info";
  /**
   * Skip-preference key. Defaults to `title`.
   * When this id is stored as skipped, `openConfirm` resolves `true` immediately.
   */
  id?: string;
  /**
   * Show “Don't ask again” and honor stored skips for this prompt.
   * @default true
   */
  dontAskAgain?: boolean;
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
    const allowSkip = options.dontAskAgain !== false;
    const skipKey = options.id ?? options.title;
    if (allowSkip && isConfirmSkipped(skipKey)) {
      const existing = pendingRef.current;
      if (existing) {
        setPending(null);
        existing.resolve(false);
      }
      return Promise.resolve(true);
    }
    return new Promise<boolean>(resolve => {
      const existing = pendingRef.current;
      if (existing) existing.resolve(false);
      setPending({ options, resolve });
    });
  }, []);

  const Dialog = useCallback((): ReactElement | null => {
    if (!pending) return null;
    const { options } = pending;
    const showDontAskAgain = options.dontAskAgain !== false;
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
        showDontAskAgain={showDontAskAgain}
        dontAskAgainKey={options.id ?? options.title}
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

/**
 * Reactive view of confirmation prompts the user chose not to see again.
 * Settings uses this to restore individual or all hidden prompts.
 */
export function useConfirmSkipPreferences(): {
  skips: ConfirmSkips;
  skippedIds: string[];
  restore: (id: string) => void;
  restoreAll: () => void;
} {
  const [skips, setSkips] = useState<ConfirmSkips>(() => readConfirmSkips());

  useEffect(() => {
    const sync = () => setSkips(readConfirmSkips());
    window.addEventListener(CONFIRM_SKIPS_CHANGED_EVENT, sync);
    return () => window.removeEventListener(CONFIRM_SKIPS_CHANGED_EVENT, sync);
  }, []);

  const restore = useCallback((id: string) => {
    setConfirmSkipped(id, false);
  }, []);

  const restoreAll = useCallback(() => {
    clearConfirmSkips();
  }, []);

  const skippedIds = useMemo(() => Object.keys(skips).sort((a, b) => a.localeCompare(b)), [skips]);

  return { skips, skippedIds, restore, restoreAll };
}
