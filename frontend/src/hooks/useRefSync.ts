import type { RefObject } from "react";
import { useRef } from "react";

/**
 * Keep a ref in sync with a value, updated during render.
 * Use the returned ref in async callbacks to always read the latest value
 * after `await` without stale closures.
 *
 * Syncs during render (not in an effect) so the ref is current before any
 * callbacks from that render run.
 *
 * @example
 * const activeNameRef = useRefSync(activeName);
 *
 * const handleClose = useCallback(async (name: string) => {
 *   await someAsyncOperation();
 *   // activeNameRef.current is always the latest, even after await
 *   if (activeNameRef.current !== name) return;
 * }, []);
 */
export function useRefSync<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}
