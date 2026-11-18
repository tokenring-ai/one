import { type ReactElement, useCallback, useEffect, useRef, useState } from "react";

/** How long a message stays in the region. Long enough for a screen reader to pick it up, short enough not to linger in browse mode. */
const CLEAR_AFTER_MS = 8000;

/**
 * A polite, visually hidden status region for short messages ("Agent finished").
 *
 * Render `region` once where the announcements belong; call `announce(text)` to
 * speak. Each call remounts the text node, so announcing the same sentence twice
 * in a row is spoken twice, and the message is dropped after a few seconds so it
 * does not sit in the reading order. Keep messages short and human-sized: this is
 * the single channel for them, streamed text must never be sent through it.
 */
export function useAnnouncer(): { announce: (message: string) => void; region: ReactElement } {
  const [current, setCurrent] = useState({ text: "", seq: 0 });
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  const announce = useCallback((message: string) => {
    if (timer.current) clearTimeout(timer.current);
    setCurrent(prev => ({ text: message, seq: prev.seq + 1 }));
    timer.current = setTimeout(() => {
      timer.current = null;
      setCurrent(prev => ({ ...prev, text: "" }));
    }, CLEAR_AFTER_MS);
  }, []);

  const region = (
    <div role="status" aria-live="polite" aria-atomic="true" className="sr-only">
      <span key={current.seq}>{current.text}</span>
    </div>
  );

  return { announce, region };
}
