import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";

export interface UseNavigationStatePayloadOptions<T> {
  /**
   * Called with the parsed state payload on each new navigation.
   * Only fires once per location.key.
   */
  onPayload: (state: T) => void;
  /**
   * Optional. If true, clears the navigation state after consuming
   * (via navigate with { replace: true, state: null }).
   * Prevents re-import on back/forward navigation.
   */
  clearAfterConsume?: boolean;
  /**
   * Optional navigate function (required when clearAfterConsume is true).
   */
  navigate?: (to: string, options?: { replace: boolean; state: null }) => void;
  /**
   * Optional path to navigate to when clearing state.
   * Defaults to the current pathname when omitted.
   */
  clearNavigateTo?: string;
}

/**
 * Consume a one-shot payload from location.state, keyed to location.key.
 * Ensures the payload is only processed once per navigation even if the
 * component re-renders (or React Strict Mode re-runs effects).
 *
 * @example
 * // Simple consumption
 * useNavigationStatePayload<{ fileContent?: string }>({
 *   onPayload: (state) => {
 *     if (state.fileContent === undefined) return;
 *     loadDocument(state.fileContent);
 *   },
 * });
 *
 * @example
 * // Consume and clear (one-shot import)
 * useNavigationStatePayload<{ fileContent?: string }>({
 *   onPayload: (state) => {
 *     if (state.fileContent === undefined) return;
 *     applyImportedContent(state.fileContent);
 *   },
 *   clearAfterConsume: true,
 *   navigate,
 *   clearNavigateTo: "/web-design",
 * });
 */
export function useNavigationStatePayload<T>(options: UseNavigationStatePayloadOptions<T>): void {
  const { onPayload, clearAfterConsume = false, navigate, clearNavigateTo } = options;
  const location = useLocation();
  const appliedNavKey = useRef<string | null>(null);

  // Keep onPayload current without re-binding the effect when the callback identity changes
  const onPayloadRef = useRef(onPayload);
  onPayloadRef.current = onPayload;

  useEffect(() => {
    if (appliedNavKey.current === location.key) return;

    const state = location.state as T | null;
    if (state == null) return;

    appliedNavKey.current = location.key;
    onPayloadRef.current(state);

    if (clearAfterConsume && navigate) {
      const to = clearNavigateTo ?? location.pathname;
      navigate(to, { replace: true, state: null });
    }
  }, [location.key, location.state, location.pathname, clearAfterConsume, navigate, clearNavigateTo]);
}
