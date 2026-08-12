import { type TextareaHTMLAttributes, useCallback, useEffect, useLayoutEffect, useRef } from "react";

type AutoResizeTextareaProps = Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, "rows"> & {
  value: string;
  /** Minimum visible rows (default 2). */
  minRows?: number;
  /** Cap height; overflow scrolls past this (default 40). */
  maxRows?: number;
};

/**
 * Textarea that grows with content so the full value stays visible.
 * Height tracks line breaks and soft wraps; optional maxRows enables scroll.
 */
export default function AutoResizeTextarea({ value, minRows = 2, maxRows = 40, className, onChange, style, ...rest }: AutoResizeTextareaProps) {
  const ref = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = ref.current;
    if (!el) return;

    // Collapse first so scrollHeight reflects full content, not the previous fixed height.
    el.style.height = "auto";

    const computed = getComputedStyle(el);
    const lineHeight = Number.parseFloat(computed.lineHeight) || 16;
    const paddingY = (Number.parseFloat(computed.paddingTop) || 0) + (Number.parseFloat(computed.paddingBottom) || 0);
    const borderY = (Number.parseFloat(computed.borderTopWidth) || 0) + (Number.parseFloat(computed.borderBottomWidth) || 0);
    const minHeight = lineHeight * minRows + paddingY + borderY;
    const maxHeight = lineHeight * maxRows + paddingY + borderY;
    const contentHeight = el.scrollHeight;
    const next = Math.min(maxHeight, Math.max(minHeight, contentHeight));

    el.style.height = `${next}px`;
    el.style.overflowY = contentHeight > maxHeight + 1 ? "auto" : "hidden";
  }, [minRows, maxRows]);

  useLayoutEffect(() => {
    resize();
  }, [value, resize]);

  // Re-measure after fonts / layout settle (e.g. first paint with custom CSS vars).
  useEffect(() => {
    resize();
    const el = ref.current;
    if (!el || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => resize());
    observer.observe(el);
    return () => observer.disconnect();
  }, [resize]);

  return (
    <textarea
      {...rest}
      ref={ref}
      value={value}
      rows={minRows}
      onChange={event => {
        onChange?.(event);
        // Grow immediately on keystroke; value-driven layout effect covers controlled updates.
        requestAnimationFrame(resize);
      }}
      className={className}
      style={{ overflow: "hidden", resize: "none", ...style }}
    />
  );
}
