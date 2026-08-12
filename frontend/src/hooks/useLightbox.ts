import { useCallback, useEffect, useRef, useState } from "react";
import { useEventListener } from "./useEventListener.ts";

export interface UseLightboxOptions {
  /**
   * A key that identifies the current item. When this changes, the lightbox
   * is automatically closed (e.g., user navigated to a different image).
   */
  itemKey?: string | number;
  /**
   * Condition that prevents closing. When true, Escape is ignored.
   * Useful for preventing closure during in-flight async operations.
   */
  blocked?: boolean;
}

export interface UseLightboxReturn {
  /** Whether the lightbox is currently open */
  isOpen: boolean;
  /** Open the lightbox */
  open: () => void;
  /** Close the lightbox */
  close: () => void;
  /** Toggle the lightbox */
  toggle: () => void;
}

/**
 * Manage a fullscreen overlay (lightbox) with auto-reset and Escape dismissal.
 *
 * @example
 * // ImageViewer — auto-close when image changes
 * const { isOpen, open, close } = useLightbox({ itemKey: image.filename });
 *
 * return (
 *   <>
 *     <img onClick={open} />
 *     {isOpen && <LightboxOverlay onClose={close} />}
 *   </>
 * );
 *
 * @example (with guard)
 * const { isOpen, open, close } = useLightbox({
 *   itemKey: image.filename,
 *   blocked: loading,
 * });
 */
export function useLightbox(options?: UseLightboxOptions): UseLightboxReturn {
  const { itemKey, blocked = false } = options ?? {};
  const [isOpen, setIsOpen] = useState(false);
  const prevKey = useRef(itemKey);

  // Auto-close when the underlying item changes
  useEffect(() => {
    if (itemKey !== undefined && prevKey.current !== itemKey && isOpen) {
      setIsOpen(false);
    }
    prevKey.current = itemKey;
  }, [itemKey, isOpen]);

  // Escape key dismissal — document listener because the lightbox backdrop may not be focused
  useEventListener(
    "keydown",
    e => {
      if (e.key === "Escape" && !blocked) {
        setIsOpen(false);
      }
    },
    { target: document, enabled: isOpen },
  );

  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => setIsOpen(prev => !prev), []);

  return { isOpen, open, close, toggle };
}
