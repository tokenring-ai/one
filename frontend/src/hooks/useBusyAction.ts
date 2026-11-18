import { useCallback, useRef, useState } from "react";

export interface UseBusyActionReturn {
  /** Whether the action is currently in progress */
  busy: boolean;
  /**
   * Execute an async action with busy guard.
   * Prevents concurrent executions (sync guard via ref).
   * Returns the result of the async function, or `undefined` if already busy.
   */
  execute: <T>(fn: () => Promise<T>) => Promise<T | undefined>;
  /** Manually set busy state (for external control) */
  setBusy: (busy: boolean) => void;
}

/**
 * Busy/loading state for a single async action with a concurrent-execution guard.
 *
 * Use when you only need a busy flag (disable buttons, show spinners).
 * For per-entity keys (which row is loading), use `useAsyncActionGuard` instead.
 * For busy + error tracking, prefer a more complete action hook.
 *
 * @example
 * const { busy: saving, execute: executeSave } = useBusyAction();
 *
 * const handleSave = async () => {
 *   await executeSave(async () => {
 *     await rpc.save(...);
 *   });
 * };
 */
export function useBusyAction(initialBusy = false): UseBusyActionReturn {
  const [busy, setBusyState] = useState(initialBusy);
  // Ref so double-clicks in the same tick cannot both pass the guard before re-render.
  const busyRef = useRef(initialBusy);

  const setBusy = useCallback((next: boolean) => {
    busyRef.current = next;
    setBusyState(next);
  }, []);

  const execute = useCallback(async <T>(fn: () => Promise<T>): Promise<T | undefined> => {
    if (busyRef.current) return undefined;
    busyRef.current = true;
    setBusyState(true);
    try {
      return await fn();
    } finally {
      busyRef.current = false;
      setBusyState(false);
    }
  }, []);

  return { busy, execute, setBusy };
}
