import { Fragment, type KeyboardEvent, type PointerEvent, useRef } from "react";
import { cn } from "../lib/utils.ts";
import { ContainerView } from "./ContainerView.tsx";
import { useLayoutApi, useLayoutState } from "./context.ts";
import { containerById } from "./model.ts";
import type { LayoutNode, SplitNode } from "./types.ts";

const MIN_PX = 120;
const KEY_STEP = 0.03;

function Splitter({ split, index }: { split: SplitNode; index: number }) {
  const { store } = useLayoutApi();
  const ref = useRef<HTMLDivElement>(null);
  const row = split.dir === "row";

  const commit = (a: number, b: number) =>
    store.dispatch({ type: "resize", split: split.id, sizes: split.sizes.map((s, j) => (j === index - 1 ? a : j === index ? b : s)) });

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    const handle = ref.current;
    const parent = handle?.parentElement;
    const prevEl = handle?.previousElementSibling as HTMLElement | null;
    const nextEl = handle?.nextElementSibling as HTMLElement | null;
    if (!handle || !parent || !prevEl || !nextEl) return;
    e.preventDefault();
    handle.setPointerCapture(e.pointerId);
    const rect = parent.getBoundingClientRect();
    const gutters = [...parent.children]
      .filter(c => c.getAttribute("role") === "separator")
      .reduce((t, g) => t + (row ? (g as HTMLElement).offsetWidth : (g as HTMLElement).offsetHeight), 0);
    const total = Math.max(1, (row ? rect.width : rect.height) - gutters);
    const a0 = split.sizes[index - 1] ?? 0.5;
    const b0 = split.sizes[index] ?? 0.5;
    const start = row ? e.clientX : e.clientY;
    const min = Math.min(MIN_PX / total, (a0 + b0) / 2);
    let a = a0;
    const move = (ev: globalThis.PointerEvent) => {
      const delta = ((row ? ev.clientX : ev.clientY) - start) / total;
      a = Math.max(min, Math.min(a0 + b0 - min, a0 + delta));
      prevEl.style.flexGrow = String(a);
      nextEl.style.flexGrow = String(a0 + b0 - a);
    };
    const up = () => {
      handle.removeEventListener("pointermove", move);
      handle.removeEventListener("pointerup", up);
      handle.removeEventListener("pointercancel", up);
      handle.dataset.dragging = "false";
      if (Math.abs(a - a0) > 0.001) commit(a, a0 + b0 - a);
    };
    handle.dataset.dragging = "true";
    handle.addEventListener("pointermove", move);
    handle.addEventListener("pointerup", up);
    handle.addEventListener("pointercancel", up);
  };

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const dec = row ? "ArrowLeft" : "ArrowUp";
    const inc = row ? "ArrowRight" : "ArrowDown";
    if (e.key !== dec && e.key !== inc) return;
    e.preventDefault();
    const a0 = split.sizes[index - 1] ?? 0.5;
    const total = a0 + (split.sizes[index] ?? 0.5);
    const a = Math.max(0.08, Math.min(total - 0.08, a0 + (e.key === inc ? KEY_STEP : -KEY_STEP)));
    commit(a, total - a);
  };

  const even = () => {
    const total = (split.sizes[index - 1] ?? 0.5) + (split.sizes[index] ?? 0.5);
    commit(total / 2, total / 2);
  };

  return (
    <div
      ref={ref}
      role="separator"
      tabIndex={0}
      aria-orientation={row ? "vertical" : "horizontal"}
      aria-label="Resize"
      aria-valuenow={Math.round((split.sizes[index - 1] ?? 0) * 100)}
      title="Drag to resize. Double-click to even out."
      onPointerDown={onPointerDown}
      onKeyDown={onKeyDown}
      onDoubleClick={even}
      className={cn(
        "group relative z-[2] shrink-0 touch-none outline-none",
        row ? "w-pane-gap cursor-col-resize" : "h-pane-gap cursor-row-resize",
        // Wider invisible hit area.
        row ? "after:absolute after:inset-y-0 after:-inset-x-1" : "after:absolute after:inset-x-0 after:-inset-y-1",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "absolute m-auto rounded bg-transparent transition-colors group-hover:bg-accent group-focus-visible:bg-accent group-data-[dragging=true]:bg-accent",
          row ? "inset-y-0 left-1/2 w-0.5 -translate-x-1/2" : "inset-x-0 top-1/2 h-0.5 -translate-y-1/2",
        )}
      />
    </div>
  );
}

function NodeView({ node }: { node: LayoutNode }) {
  if (node.kind === "container") return <ContainerView node={node} />;
  return (
    <div className={cn("flex min-h-0 min-w-0", node.dir === "row" ? "flex-row" : "flex-col")}>
      {node.children.map((child, i) => (
        <Fragment key={child.id}>
          {i > 0 && <Splitter split={node} index={i} />}
          <div className="flex min-h-0 min-w-0 [&>*]:flex-1" style={{ flexGrow: node.sizes[i] ?? 1, flexShrink: 1, flexBasis: 0 }}>
            <NodeView node={child} />
          </div>
        </Fragment>
      ))}
    </div>
  );
}

/** Desktop rendering of the layout tree. */
export function LayoutSurface() {
  const state = useLayoutState();
  const maximized = containerById(state, state.maximized);
  return (
    <div className="flex min-h-0 min-w-0 flex-1 bg-surface p-pane-gap [&>*]:flex-1">
      <NodeView node={maximized ?? state.root} />
    </div>
  );
}
