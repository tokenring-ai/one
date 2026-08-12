import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";
import ConfirmModal from "../components/ui/ConfirmModal.tsx";
import { cn } from "../lib/utils.ts";
import { useRefSync } from "./useRefSync.ts";

export interface UseDirtyStateOptions<T = string> {
  /** Current (potentially modified) value */
  current: T;
  /** Last saved value to compare against */
  saved: T;
  /** Comparison function. Default: reference equality (`===`). Use deepEqual for objects. */
  compare?: (a: T, b: T) => boolean;
  /** Whether to register a beforeunload warning. Default: true. */
  warnOnUnload?: boolean | undefined;
  /** Custom message for the beforeunload warning. Browsers typically ignore custom text. */
  unloadMessage?: string | undefined;
}

export interface ConfirmDiscardOptions {
  /**
   * When set, opens a ConfirmModal instead of `window.confirm`.
   * Parent must render `DiscardDialog` from the hook return value.
   */
  dialog?: {
    title?: string;
    message?: string;
    confirmLabel?: string;
  };
  /** Called when the user confirms discard (in addition to a truthy return). */
  onDiscard?: (() => void) | undefined;
}

export interface UseDirtyStateReturn {
  /** Whether there are unsaved changes */
  isDirty: boolean;
  /**
   * Mark the current value as saved (clears dirty state until `current` diverges
   * again). Prefer updating the `saved` prop after a real save; this is a
   * convenience for optimistic or immediate local clear.
   */
  markSaved: () => void;
  /** Amber dirty indicator; renders nothing when clean */
  DirtyDot: () => ReactElement | null;
  /**
   * Guard for navigation. Returns true if safe to proceed.
   * Uses `window.confirm` by default, or ConfirmModal when `dialog` is set.
   */
  confirmDiscard: (options?: ConfirmDiscardOptions) => boolean | Promise<boolean>;
  /** Renders the discard ConfirmModal when dialog-mode confirmDiscard is pending */
  DiscardDialog: () => ReactElement | null;
}

const defaultCompare = <T,>(a: T, b: T): boolean => a === b;

const DEFAULT_DISCARD_TITLE = "Unsaved changes";
const DEFAULT_DISCARD_MESSAGE = "You have unsaved changes. Discard them?";
const DEFAULT_DISCARD_LABEL = "Discard";

/** Standalone amber unsaved-changes indicator used across apps. */
export function DirtyIndicator({ className, title = "Unsaved changes" }: { className?: string; title?: string }) {
  return <span role="img" className={cn("w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0", className)} title={title} aria-label={title} />;
}

/**
 * Track unsaved changes: dirty computation, beforeunload warning, discard guard,
 * and a standard amber dirty indicator.
 */
export function useDirtyState<T = string>(options: UseDirtyStateOptions<T>): UseDirtyStateReturn {
  const { current, saved, compare = defaultCompare, warnOnUnload = true, unloadMessage = "" } = options;

  // Baseline set by markSaved(); cleared when the external `saved` prop changes.
  const [markedBaseline, setMarkedBaseline] = useState<T | null>(null);
  const prevSavedRef = useRef(saved);
  const compareRef = useRefSync(compare);

  useEffect(() => {
    const changed = !compareRef.current(prevSavedRef.current, saved);
    prevSavedRef.current = saved;
    if (changed) setMarkedBaseline(null);
  }, [saved]);

  const baseline = markedBaseline !== null ? markedBaseline : saved;
  const isDirty = !compare(current, baseline);

  const currentRef = useRefSync(current);
  const isDirtyRef = useRefSync(isDirty);

  const markSaved = useCallback(() => {
    setMarkedBaseline(currentRef.current);
  }, []);

  // Warn on browser close / refresh only while dirty.
  useEffect(() => {
    if (!warnOnUnload || !isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // oxlint-disable-next-line typescript/no-deprecated
      e.returnValue = unloadMessage;
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty, warnOnUnload, unloadMessage]);

  const [discardDialog, setDiscardDialog] = useState<{
    title: string;
    message: string;
    confirmLabel: string;
    resolve: (ok: boolean) => void;
    onDiscard?: (() => void) | undefined;
  } | null>(null);

  const confirmDiscard = useCallback((opts?: ConfirmDiscardOptions): boolean | Promise<boolean> => {
    if (!isDirtyRef.current) return true;

    if (opts?.dialog) {
      const title = opts.dialog.title ?? DEFAULT_DISCARD_TITLE;
      const message = opts.dialog.message ?? DEFAULT_DISCARD_MESSAGE;
      const confirmLabel = opts.dialog.confirmLabel ?? DEFAULT_DISCARD_LABEL;
      return new Promise<boolean>(resolve => {
        setDiscardDialog({
          title,
          message,
          confirmLabel,
          resolve,
          onDiscard: opts.onDiscard,
        });
      });
    }

    const ok = window.confirm(DEFAULT_DISCARD_MESSAGE);
    if (ok) opts?.onDiscard?.();
    return ok;
  }, []);

  const DirtyDot = useCallback((): ReactElement | null => {
    if (!isDirty) return null;
    return <DirtyIndicator />;
  }, [isDirty]);

  const DiscardDialog = useCallback((): ReactElement | null => {
    if (!discardDialog) return null;
    const pending = discardDialog;
    return (
      <ConfirmModal
        title={pending.title}
        message={pending.message}
        confirmLabel={pending.confirmLabel}
        variant="warning"
        onConfirm={() => {
          pending.onDiscard?.();
          pending.resolve(true);
          setDiscardDialog(null);
        }}
        onClose={() => {
          pending.resolve(false);
          setDiscardDialog(null);
        }}
      />
    );
  }, [discardDialog]);

  return { isDirty, markSaved, DirtyDot, confirmDiscard, DiscardDialog };
}
