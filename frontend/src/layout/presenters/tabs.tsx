import { Fragment, type KeyboardEvent } from "react";
import { cn } from "../../lib/utils.ts";
import { Badge, CloseButton, InsertMarker } from "./shared.tsx";
import type { Presenter, PresenterContext } from "./types.ts";

function TabStrip(ctx: PresenterContext) {
  const { node, api, visible, focused } = ctx;
  const onKeyDown = (e: KeyboardEvent, index: number) => {
    const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
    if (step) {
      const next = node.items[index + step];
      if (next) {
        e.preventDefault();
        api.select(next);
        // Roving focus: the next arrow press starts from the tab just selected.
        const tabs = e.currentTarget.closest('[role="tablist"]')?.querySelectorAll<HTMLElement>('[role="tab"]') ?? [];
        for (const tab of tabs) if (tab.dataset.tabKey === next) tab.focus();
      }
    } else if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      const key = node.items[index];
      if (key) api.select(key);
    }
  };
  return (
    <div className="flex h-tab shrink-0 items-stretch border-b border-line bg-sunken">
      <div role="tablist" aria-orientation="horizontal" className="flex min-w-0 flex-1 overflow-x-auto [scrollbar-width:none]" {...ctx.stripDrop}>
        {node.items.map((key, index) => {
          const panel = ctx.panel(key);
          if (!panel) return null;
          const selected = key === visible;
          const closable = api.registry.view(panel.viewId)?.closable !== false;
          const title = ctx.title(key);
          const url = api.urlFor(panel.viewId, panel.params);
          return (
            <Fragment key={key}>
              {ctx.insertAt === index && <InsertMarker axis="x" />}
              <div
                role="tab"
                aria-selected={selected}
                tabIndex={selected ? 0 : -1}
                data-tab-key={key}
                title={url ?? title}
                {...ctx.drag(key)}
                {...ctx.itemDrop(index, "x")}
                onClick={() => api.select(key)}
                onDoubleClick={() => api.store.dispatch({ type: "pin", key })}
                onAuxClick={e => {
                  if (e.button === 1 && closable) {
                    e.preventDefault();
                    api.close(key);
                  }
                }}
                onKeyDown={e => onKeyDown(e, index)}
                className={cn(
                  "group relative flex max-w-56 shrink-0 cursor-pointer select-none items-center gap-1.5 border-r border-line-subtle pl-2.5 pr-1.5 text-xs whitespace-nowrap focus-ring",
                  selected ? "bg-canvas text-fg" : "text-muted hover:bg-hover hover:text-fg-secondary",
                  selected && "after:absolute after:inset-x-0 after:top-0 after:h-0.5",
                  selected && (focused ? "after:bg-accent" : "after:bg-line-strong"),
                )}
              >
                {ctx.icon(key)}
                <span className={cn("truncate", panel.preview && "italic")}>{title}</span>
                <Badge badge={panel.badge} />
                {closable && (
                  <CloseButton
                    title={title}
                    hint={api.registry.view(panel.viewId)?.closeHint}
                    onClose={() => api.close(key)}
                    className={selected ? "opacity-70" : "opacity-0 group-hover:opacity-70"}
                  />
                )}
              </div>
            </Fragment>
          );
        })}
        {ctx.insertAt === node.items.length && <InsertMarker axis="x" />}
      </div>
      {ctx.actions}
    </div>
  );
}

export const tabsPresenter: Presenter = {
  header: ctx => <TabStrip {...ctx} />,
  body: ctx => ctx.node.items.map(key => <Fragment key={key}>{ctx.slot(key, key === ctx.visible)}</Fragment>),
};
