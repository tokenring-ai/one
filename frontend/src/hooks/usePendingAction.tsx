import { type ReactElement, useCallback, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal.tsx";
import { useRefSync } from "./useRefSync.ts";

export interface UsePendingActionOptions {
  /** Whether there are unsaved changes that should block navigation / state-changing actions */
  isDirty: boolean;
}

export interface PendingDialogOptions<TAction> {
  title?: string;
  message?: string;
  confirmLabel?: string;
  /** Runs after the queue is cleared with the confirmed action */
  onConfirm: (action: TAction) => void;
}

export interface UsePendingActionReturn<TAction> {
  /**
   * When dirty: stores `action` and returns `true` (blocked — do not execute).
   * When clean: returns `false` — caller should execute the action immediately.
   *
   * @example
   * if (queueAction({ type: "select", id })) return;
   * void navigate(id);
   */
  queueAction: (action: TAction) => boolean;
  /** The queued action, or null if none */
  pendingAction: TAction | null;
  /** Clear the queued action without executing */
  cancelPending: () => void;
  /**
   * Clear the queue and invoke `execute` with the pending action (if any).
   * Prefer `PendingDialog`'s `onConfirm` for the common confirm-modal path.
   */
  executePending: (execute: (action: TAction) => void) => void;
  /** Renders the discard ConfirmModal when an action is pending */
  PendingDialog: (options: PendingDialogOptions<TAction>) => ReactElement | null;
}

const DEFAULT_TITLE = "Discard unsaved changes?";
const DEFAULT_MESSAGE = "You have unsaved edits. Proceed and lose those changes?";
const DEFAULT_CONFIRM_LABEL = "Discard";

/**
 * Defer navigation or state-changing actions while dirty: queue the action,
 * show a discard confirmation, then execute or cancel.
 *
 * Distinct from `useDirtyState.confirmDiscard`, which is for one-off guards.
 * This hook keeps a typed queued action to run after the user confirms discard.
 */
export function usePendingAction<TAction>(options: UsePendingActionOptions): UsePendingActionReturn<TAction> {
  const { isDirty } = options;
  const [pendingAction, setPendingAction] = useState<TAction | null>(null);
  const pendingActionRef = useRefSync(pendingAction);

  const queueAction = useCallback(
    (action: TAction): boolean => {
      if (isDirty) {
        setPendingAction(action);
        return true;
      }
      return false;
    },
    [isDirty],
  );

  const cancelPending = useCallback(() => {
    setPendingAction(null);
  }, []);

  const executePending = useCallback((execute: (action: TAction) => void) => {
    const action = pendingActionRef.current;
    setPendingAction(null);
    if (action !== null) execute(action);
  }, []);

  const PendingDialog = useCallback(
    (dialogOptions: PendingDialogOptions<TAction>): ReactElement | null => {
      if (pendingAction === null) return null;
      const action = pendingAction;
      return (
        <ConfirmModal
          title={dialogOptions.title ?? DEFAULT_TITLE}
          message={dialogOptions.message ?? DEFAULT_MESSAGE}
          confirmLabel={dialogOptions.confirmLabel ?? DEFAULT_CONFIRM_LABEL}
          variant="warning"
          onConfirm={() => {
            setPendingAction(null);
            dialogOptions.onConfirm(action);
          }}
          onClose={cancelPending}
        />
      );
    },
    [pendingAction, cancelPending],
  );

  return { queueAction, pendingAction, cancelPending, executePending, PendingDialog };
}
