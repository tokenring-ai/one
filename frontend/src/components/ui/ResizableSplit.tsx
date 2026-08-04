import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";

const HANDLE_PX = 8;

interface ResizableSplitProps {
  /** Split orientation: 'vertical' = top/bottom panes, 'horizontal' = left/right panes */
  direction?: "vertical" | "horizontal";
  /** Initial fraction (0–1) allocated to the first pane. Default: 0.5 */
  initialRatio?: number;
  /** Minimum size in px for the first pane. Default: 80 */
  minFirst?: number;
  /** Minimum size in px for the second pane. Default: 80 */
  minSecond?: number;
  children: [React.ReactNode, React.ReactNode];
  className?: string;
  ariaLabel?: string;
}

/**
 * Splits its two children into resizable panes divided by a draggable handle.
 *
 * The component must be placed inside a container that provides a defined
 * size along the split axis (e.g. `flex-1 min-h-0` for a vertical split).
 */
export default function ResizableSplit({
  direction = "vertical",
  initialRatio = 0.5,
  minFirst = 80,
  minSecond = 80,
  children,
  className = "",
  ariaLabel = "Resize panels",
}: ResizableSplitProps) {
  const initialClampedRatio = Math.max(0.05, Math.min(0.95, initialRatio));
  const [ratio, setRatio] = useState(initialClampedRatio);
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVertical = direction === "vertical";

  const clampRatio = useCallback(
    (next: number) => {
      const rect = containerRef.current?.getBoundingClientRect();
      const totalSize = rect ? (isVertical ? rect.height : rect.width) : 0;
      if (totalSize <= 0) return Math.max(0.05, Math.min(0.95, next));
      const usableSize = Math.max(1, totalSize - HANDLE_PX);
      if (minFirst + minSecond >= usableSize) return minFirst / Math.max(1, minFirst + minSecond);
      return Math.max(minFirst / usableSize, Math.min(1 - minSecond / usableSize, next));
    },
    [isVertical, minFirst, minSecond],
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => setRatio(current => clampRatio(current)));
    observer.observe(container);
    return () => observer.disconnect();
  }, [clampRatio]);

  const startDrag = useCallback(
    (startEvent: React.PointerEvent) => {
      if (startEvent.button !== 0) return;
      startEvent.preventDefault();
      setDragging(true);

      const onMove = (e: PointerEvent) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalSize = isVertical ? rect.height : rect.width;
        const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;

        setRatio(clampRatio(offset / totalSize));
      };

      const onUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };

      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [clampRatio, isVertical],
  );

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerClass = `flex ${isVertical ? "flex-col" : "flex-row"} ${className}`;

  const firstStyle: React.CSSProperties = isVertical
    ? { flexBasis: `${ratio * 100}%`, flexShrink: 0, minHeight: minFirst, overflow: "hidden" }
    : { flexBasis: `${ratio * 100}%`, flexShrink: 0, minWidth: minFirst, overflow: "hidden" };

  const secondStyle: React.CSSProperties = isVertical
    ? { flex: "1 1 0", minHeight: minSecond, overflow: "hidden" }
    : { flex: "1 1 0", minWidth: minSecond, overflow: "hidden" };

  const handleClass = [
    "group shrink-0 relative flex items-center justify-center select-none touch-none transition-colors focus:outline-none focus:bg-accent-muted",
    isVertical ? "w-full cursor-row-resize" : "h-full cursor-col-resize",
    dragging ? "bg-accent-muted-hover" : "bg-secondary hover:bg-accent-muted",
  ].join(" ");

  const handleSizeStyle: React.CSSProperties = isVertical ? { height: HANDLE_PX } : { width: HANDLE_PX };

  const gripDotsClass = `flex gap-[3px] ${isVertical ? "flex-row" : "flex-col"} items-center justify-center pointer-events-none`;

  return (
    <div ref={containerRef} className={containerClass}>
      {/* First pane */}
      <div style={firstStyle}>{children[0]}</div>

      {/* Drag handle */}
      <div
        role="separator"
        aria-label={ariaLabel}
        aria-orientation={isVertical ? "horizontal" : "vertical"}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(ratio * 100)}
        tabIndex={0}
        onPointerDown={startDrag}
        onDoubleClick={() => setRatio(clampRatio(initialClampedRatio))}
        className={handleClass}
        style={handleSizeStyle}
        onKeyDown={e => {
          // Allow keyboard resizing with arrow keys
          const rect = containerRef.current?.getBoundingClientRect();
          const total = rect ? (isVertical ? rect.height : rect.width) : 400;
          const step = (e.shiftKey ? 32 : 8) / Math.max(1, total);
          if ((isVertical && e.key === "ArrowDown") || (!isVertical && e.key === "ArrowRight")) {
            e.preventDefault();
            setRatio(r => clampRatio(r + step));
          } else if ((isVertical && e.key === "ArrowUp") || (!isVertical && e.key === "ArrowLeft")) {
            e.preventDefault();
            setRatio(r => clampRatio(r - step));
          } else if (e.key === "Home") {
            e.preventDefault();
            setRatio(clampRatio(0));
          } else if (e.key === "End") {
            e.preventDefault();
            setRatio(clampRatio(1));
          }
        }}
      >
        {/* Visible border lines on each edge */}
        <div className={["absolute", isVertical ? "top-0 left-0 right-0 h-px" : "left-0 top-0 bottom-0 w-px", "bg-border"].join(" ")} />
        <div className={["absolute", isVertical ? "bottom-0 left-0 right-0 h-px" : "right-0 top-0 bottom-0 w-px", "bg-border"].join(" ")} />

        {/* Grip indicator */}
        <div className={gripDotsClass}>
          {[0, 1, 2, 3, 4].map(i => (
            <div
              key={i}
              className={[
                "rounded-full transition-colors",
                isVertical ? "w-5 h-[3px]" : "w-[3px] h-5",
                dragging ? "bg-accent-soft" : "bg-muted/50 group-hover:bg-accent-soft/70",
              ].join(" ")}
            />
          ))}
        </div>
      </div>

      {/* Second pane */}
      <div style={secondStyle}>{children[1]}</div>
    </div>
  );
}
