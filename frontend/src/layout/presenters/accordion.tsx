import { ChevronDown } from "lucide-react";
import { Fragment } from "react";
import { cn } from "../../lib/utils.ts";
import { Badge, CloseButton, InsertMarker } from "./shared.tsx";
import type { Presenter, PresenterContext } from "./types.ts";

function Sections(ctx: PresenterContext) {
  const { node, api } = ctx;
  const open = new Set(node.expanded ?? []);
  const toggle = (key: string) => {
    const opening = !open.has(key);
    api.store.dispatch({ type: "toggle", key });
    if (opening) api.select(key); // opening a section focuses it (and navigates if it has a route)
  };
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto" {...ctx.stripDrop}>
      {node.items.map((key, index) => {
        const panel = ctx.panel(key);
        if (!panel) return null;
        const isOpen = open.has(key);
        const title = ctx.title(key);
        const closable = api.registry.view(panel.viewId)?.closable !== false;
        return (
          <Fragment key={key}>
            {ctx.insertAt === index && <InsertMarker axis="y" />}
            <section className={cn("flex min-h-0 flex-col border-b border-line-subtle", isOpen ? "min-h-32 flex-1 basis-0 overflow-hidden" : "flex-none")}>
              <div
                role="button"
                tabIndex={0}
                aria-expanded={isOpen}
                aria-current={api.activeKey === key ? "true" : undefined}
                {...ctx.drag(key)}
                {...ctx.itemDrop(index, "y")}
                onClick={() => toggle(key)}
                onKeyDown={e => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    toggle(key);
                  }
                }}
                className={cn(
                  "group flex h-[calc(var(--tab-h)-4px)] shrink-0 cursor-pointer items-center gap-1.5 px-1.5 text-[11px] font-semibold tracking-wide uppercase select-none focus-ring",
                  api.activeKey === key ? "text-accent-soft" : "text-muted hover:bg-hover hover:text-fg-secondary",
                )}
              >
                <ChevronDown className={cn("h-3.5 w-3.5 shrink-0 transition-transform", !isOpen && "-rotate-90")} aria-hidden="true" />
                {ctx.icon(key)}
                <span className="min-w-0 flex-1 truncate">{title}</span>
                <Badge badge={panel.badge} />
                {closable && (
                  <CloseButton
                    title={title}
                    hint={api.registry.view(panel.viewId)?.closeHint}
                    onClose={() => api.close(key)}
                    className="opacity-0 group-hover:opacity-70"
                  />
                )}
              </div>
              {/* Each open section scrolls on its own: a widget taller than its share can neither spill
                  over the next section nor be cut off with no way to reach the rest. */}
              {isOpen ? <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{ctx.slot(key, true)}</div> : ctx.slot(key, false)}
            </section>
          </Fragment>
        );
      })}
      {ctx.insertAt === node.items.length && <InsertMarker axis="y" />}
    </div>
  );
}

export const accordionPresenter: Presenter = {
  header: ctx => (
    <div className="flex h-tab shrink-0 items-center gap-2 border-b border-line bg-sunken pl-2.5">
      <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-wide text-muted uppercase">
        {ctx.api.registry.kind(ctx.node.accepts[0] ?? "")?.label ?? "Sections"}
      </span>
      {ctx.actions}
    </div>
  ),
  body: ctx => <Sections {...ctx} />,
};
