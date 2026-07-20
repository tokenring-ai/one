import type React from "react";
import { useCallback, useRef, useState } from "react";

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
}: ResizableSplitProps) {
  const [ratio, setRatio] = useState(Math.max(0.05, Math.min(0.95, initialRatio)));
  const [dragging, setDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const isVertical = direction === "vertical";

  const startDrag = useCallback(
    (startEvent: React.MouseEvent) => {
      startEvent.preventDefault();
      setDragging(true);

      const onMove = (e: MouseEvent) => {
        const container = containerRef.current;
        if (!container) return;

        const rect = container.getBoundingClientRect();
        const totalSize = isVertical ? rect.height : rect.width;
        const offset = isVertical ? e.clientY - rect.top : e.clientX - rect.left;

        // Clamp so neither pane goes below its minimum
        const minFirstRatio = minFirst / totalSize;
        const minSecondRatio = minSecond / totalSize;
        const clamped = Math.max(minFirstRatio, Math.min(1 - minSecondRatio - HANDLE_PX / totalSize, offset / totalSize));

        setRatio(clamped);
      };

      const onUp = () => {
        setDragging(false);
        document.body.style.cursor = "";
        document.body.style.userSelect = "";
        window.removeEventListener("mousemove", onMove);
        window.removeEventListener("mouseup", onUp);
      };

      document.body.style.cursor = isVertical ? "row-resize" : "col-resize";
      document.body.style.userSelect = "none";
      window.addEventListener("mousemove", onMove);
      window.addEventListener("mouseup", onUp);
    },
    [isVertical, minFirst, minSecond],
  );

  // ── Styles ──────────────────────────────────────────────────────────────────

  const containerClass = `flex ${isVertical ? "flex-col" : "flex-row"} ${className}`;

  const firstStyle: React.CSSProperties = isVertical
    ? { flexBasis: `${ratio * 100}%`, flexShrink: 0, minHeight: 0, overflow: "hidden" }
    : { flexBasis: `${ratio * 100}%`, flexShrink: 0, minWidth: 0, overflow: "hidden" };

  const secondStyle: React.CSSProperties = isVertical
    ? { flex: "1 1 0", minHeight: 0, overflow: "hidden" }
    : { flex: "1 1 0", minWidth: 0, overflow: "hidden" };

  const handleClass = [
    "group shrink-0 relative flex items-center justify-center select-none transition-colors",
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
        onMouseDown={startDrag}
        className={handleClass}
        style={handleSizeStyle}
        onKeyDown={e => {
          // Allow keyboard resizing with arrow keys
          const step = 0.02;
          if ((isVertical && e.key === "ArrowDown") || (!isVertical && e.key === "ArrowRight")) {
            e.preventDefault();
            setRatio(r => Math.min(0.95, r + step));
          } else if ((isVertical && e.key === "ArrowUp") || (!isVertical && e.key === "ArrowLeft")) {
            e.preventDefault();
            setRatio(r => Math.max(0.05, r - step));
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
