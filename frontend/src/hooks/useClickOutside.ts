import type { RefObject } from "react";
import { useEventListener } from "./useEventListener.ts";
import { useRefSync } from "./useRefSync.ts";

export interface UseClickOutsideOptions {
  /**
   * Whether the outside-click listener is active.
   * Checked via ref so toggling does not rebind the document listener.
   * @default true
   */
  enabled?: boolean;
  /**
   * DOM event to listen for on `document`.
   * Prefer `"mousedown"` over `"click"` to avoid races with focus loss.
   * @default "mousedown"
   */
  event?: "mousedown" | "click";
}

/**
 * Call `onOutsideClick` when a mousedown (or click) occurs outside `ref`.
 *
 * Side-effect only — the caller manages any resulting state (e.g. closing a dropdown).
 * Callback and `enabled` are read from refs so the document listener stays stable
 * across open/close toggles and handler identity changes.
 *
 * @example
 * useClickOutside(dropdownRef, () => setOpen(false));
 *
 * @example
 * useClickOutside(dropdownRef, () => setOpen(false), { enabled: open });
 */
export function useClickOutside(ref: RefObject<HTMLElement | null>, onOutsideClick: () => void, options?: UseClickOutsideOptions): void {
  const { enabled = true, event = "mousedown" } = options ?? {};

  const onOutsideClickRef = useRefSync(onOutsideClick);
  const enabledRef = useRefSync(enabled);
  const refRef = useRefSync(ref);

  useEventListener(
    event,
    e => {
      if (!enabledRef.current) return;
      const el = refRef.current.current;
      if (el == null) return;
      if (!el.contains(e.target as Node)) {
        onOutsideClickRef.current();
      }
    },
    { target: document },
  );
}
