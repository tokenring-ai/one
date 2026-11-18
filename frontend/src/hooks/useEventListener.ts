import { type RefObject, useEffect } from "react";
import { useRefSync } from "./useRefSync.ts";

export type EventListenerTarget = EventTarget | null | undefined;

export interface UseEventListenerOptions {
  /**
   * Target to attach the listener to.
   * Accepts `window`, `document`, an element, a MediaQueryList, or a ref to any of those.
   * @default window
   */
  target?: EventListenerTarget | RefObject<EventListenerTarget>;
  /**
   * When false, the listener is not attached.
   * @default true
   */
  enabled?: boolean;
  /** Equivalent to `addEventListener` capture option. */
  capture?: boolean;
  /** Equivalent to `addEventListener` passive option. */
  passive?: boolean;
  /** Equivalent to `addEventListener` once option. */
  once?: boolean;
}

function resolveTarget(target: UseEventListenerOptions["target"]): EventTarget | null {
  if (target == null) {
    return typeof window !== "undefined" ? window : null;
  }
  if (typeof target === "object" && "current" in target) {
    return target.current ?? null;
  }
  return target;
}

/**
 * Subscribe to a DOM event with automatic cleanup.
 *
 * The handler is stored in a ref so its identity can change freely without
 * rebinding the listener. Rebinds when `type`, `enabled`, `target`, or listener
 * options (`capture` / `passive` / `once`) change.
 *
 * @example document Escape while open
 * useEventListener(
 *   "keydown",
 *   e => {
 *     if (e.key === "Escape") onClose();
 *   },
 *   { target: document, enabled: open },
 * );
 *
 * @example window (default target)
 * useEventListener("resize", handleResize);
 *
 * @example element ref
 * useEventListener("scroll", onScroll, { target: containerRef });
 */
export function useEventListener<K extends keyof WindowEventMap>(type: K, handler: (event: WindowEventMap[K]) => void, options?: UseEventListenerOptions): void;
export function useEventListener<K extends keyof DocumentEventMap>(
  type: K,
  handler: (event: DocumentEventMap[K]) => void,
  options: UseEventListenerOptions & { target: Document | RefObject<Document | null> },
): void;
export function useEventListener<K extends keyof HTMLElementEventMap, T extends HTMLElement>(
  type: K,
  handler: (event: HTMLElementEventMap[K]) => void,
  options: UseEventListenerOptions & { target: T | RefObject<T | null> },
): void;
export function useEventListener(type: string, handler: (event: Event) => void, options?: UseEventListenerOptions): void;
export function useEventListener(type: string, handler: (event: Event) => void, options?: UseEventListenerOptions): void {
  const { target, enabled = true, capture, passive, once } = options ?? {};
  const handlerRef = useRefSync(handler);

  useEffect(() => {
    if (!enabled) return;

    const eventTarget = resolveTarget(target);
    if (eventTarget == null || typeof eventTarget.addEventListener !== "function") return;

    let listenerOptions: AddEventListenerOptions | undefined;
    if (capture !== undefined || passive !== undefined || once !== undefined) {
      listenerOptions = {};
      if (capture !== undefined) listenerOptions.capture = capture;
      if (passive !== undefined) listenerOptions.passive = passive;
      if (once !== undefined) listenerOptions.once = once;
    }

    const listener = (event: Event) => {
      handlerRef.current(event);
    };

    eventTarget.addEventListener(type, listener, listenerOptions);
    return () => eventTarget.removeEventListener(type, listener, listenerOptions);
  }, [type, target, enabled, capture, passive, once, handlerRef]);
}
