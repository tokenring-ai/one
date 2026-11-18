import { ChevronLeft, ChevronRight } from "lucide-react";
import { Fragment } from "react";
import { cn } from "../../lib/utils.ts";
import { InsertMarker } from "./shared.tsx";
import type { Presenter, PresenterContext } from "./types.ts";

function step(ctx: PresenterContext, delta: number) {
  const { node, visible, api } = ctx;
  const n = node.items.length;
  if (n < 2) return;
  const i = visible ? node.items.indexOf(visible) : 0;
  const next = node.items[(i + delta + n) % n];
  if (next) api.select(next);
}

/** One large item with previous/next and a thumbnail strip (galleries, slides). */
export const carouselPresenter: Presenter = {
  header(ctx) {
    const { node, visible } = ctx;
    const i = visible ? node.items.indexOf(visible) : -1;
    return (
      <div className="flex h-tab shrink-0 items-center gap-2 border-b border-line bg-sunken pl-2.5 text-xs">
        <span className="font-mono text-[11px] text-muted tabular-nums">{node.items.length ? `${i + 1} / ${node.items.length}` : "0 / 0"}</span>
        <span className="min-w-0 flex-1 truncate font-medium text-fg-secondary">{visible ? ctx.title(visible) : ""}</span>
        {ctx.actions}
      </div>
    );
  },
  body(ctx) {
    const many = ctx.node.items.length > 1;
    const nav =
      "absolute top-1/2 z-[3] grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full border border-line bg-raised/90 text-fg-secondary shadow-[var(--elevation-popover)] hover:text-fg focus-ring";
    return (
      <div
        className="relative flex min-h-0 flex-1 bg-sunken"
        role="group"
        aria-roledescription="carousel"
        tabIndex={-1}
        onKeyDown={e => {
          if ((e.target as HTMLElement).closest("input, textarea, [contenteditable]")) return;
          if (e.key === "ArrowRight") step(ctx, 1);
          if (e.key === "ArrowLeft") step(ctx, -1);
        }}
      >
        {ctx.node.items.map(key => (
          <Fragment key={key}>{ctx.slot(key, key === ctx.visible)}</Fragment>
        ))}
        {many && (
          <>
            <button type="button" aria-label="Previous" className={cn(nav, "left-2.5")} onClick={() => step(ctx, -1)}>
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <button type="button" aria-label="Next" className={cn(nav, "right-2.5")} onClick={() => step(ctx, 1)}>
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </>
        )}
      </div>
    );
  },
  footer(ctx) {
    const { node, api, visible } = ctx;
    return (
      <div role="tablist" aria-label="Items" className="flex shrink-0 gap-1.5 overflow-x-auto border-t border-line bg-sunken px-2 py-1.5" {...ctx.stripDrop}>
        {node.items.map((key, index) => {
          const panel = ctx.panel(key);
          if (!panel) return null;
          const thumb = api.registry.view(panel.viewId)?.thumbnail?.(panel.params);
          return (
            <Fragment key={key}>
              {ctx.insertAt === index && <InsertMarker axis="x" />}
              <button
                type="button"
                role="tab"
                aria-selected={key === visible}
                title={ctx.title(key)}
                {...ctx.drag(key)}
                {...ctx.itemDrop(index, "x")}
                onClick={() => api.select(key)}
                className={cn(
                  "grid h-10 w-16 shrink-0 place-items-center overflow-hidden rounded-md border-2 bg-raised focus-ring",
                  key === visible ? "border-accent" : "border-transparent opacity-70 hover:opacity-100",
                )}
              >
                {thumb ? <img src={thumb} alt="" className="h-full w-full object-cover" /> : ctx.icon(key)}
              </button>
            </Fragment>
          );
        })}
        {ctx.insertAt === node.items.length && <InsertMarker axis="x" />}
      </div>
    );
  },
};
