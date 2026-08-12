import { useCallback, useRef, useState } from "react";

export interface UseAsyncActionGuardReturn {
  /** The key currently being acted upon, or null. */
  activeKey: string | null;
  /** Set the active key (start an action). */
  start: (key: string) => void;
  /** Clear the active key (complete an action). */
  stop: () => void;
  /** Returns true if the given key is currently active. */
  isLoading: (key: string) => boolean;
  /**
   * Wraps an async function, automatically setting/clearing the active key.
   * Prevents concurrent executions (any key). Returns `undefined` if already busy.
   */
  execute: <T>(key: string, fn: () => Promise<T>) => Promise<T | undefined>;
}

/**
 * Per-entity async action guard: tracks which key is in flight for row-level spinners.
 *
 * Each call creates an independent guard (e.g. one for "launch", one for "delete").
 * Use `useBusyAction` when you only need a boolean busy flag without a key.
 *
 * @example
 * const guard = useAsyncActionGuard();
 *
 * await guard.execute(`tool:${name}`, async () => {
 *   await rpc.toggleTool(name);
 * });
 *
 * <button disabled={guard.activeKey !== null} loading={guard.isLoading(`tool:${name}`)} />
 */
export function useAsyncActionGuard(): UseAsyncActionGuardReturn {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  // Ref so concurrent starts in the same tick cannot both pass the guard.
  const activeKeyRef = useRef<string | null>(null);

  const start = useCallback((key: string) => {
    activeKeyRef.current = key;
    setActiveKey(key);
  }, []);

  const stop = useCallback(() => {
    activeKeyRef.current = null;
    setActiveKey(null);
  }, []);

  const isLoading = useCallback((key: string) => activeKey === key, [activeKey]);

  const execute = useCallback(async <T>(key: string, fn: () => Promise<T>): Promise<T | undefined> => {
    if (activeKeyRef.current !== null) return undefined;
    activeKeyRef.current = key;
    setActiveKey(key);
    try {
      return await fn();
    } finally {
      activeKeyRef.current = null;
      setActiveKey(null);
    }
  }, []);

  return { activeKey, start, stop, isLoading, execute };
}
