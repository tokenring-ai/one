import { Fragment } from "react";
import { cn } from "../../lib/utils.ts";
import { Badge } from "./shared.tsx";
import type { Presenter } from "./types.ts";

/** One item under a title bar (navigators, logs, details). The title bar is the drag handle. */
export const singlePresenter: Presenter = {
  header(ctx) {
    const key = ctx.node.items[0];
    const panel = key ? ctx.panel(key) : undefined;
    return (
      <div
        className={cn(
          "flex h-tab shrink-0 items-center gap-2 border-b border-line bg-sunken pl-2.5 text-xs text-fg-secondary select-none",
          ctx.focused && "shadow-[inset_0_2px_0_var(--accent-primary)]",
          panel && "cursor-grab",
        )}
        {...(key ? ctx.drag(key) : {})}
        title={panel ? "Drag to move" : undefined}
      >
        {key && ctx.icon(key)}
        <span className={cn("min-w-0 flex-1 truncate font-medium", !panel && "font-normal text-dim")}>{key && panel ? ctx.title(key) : "Empty"}</span>
        {panel && <Badge badge={panel.badge} />}
        {ctx.actions}
      </div>
    );
  },
  body: ctx => ctx.node.items.map(key => <Fragment key={key}>{ctx.slot(key, true)}</Fragment>),
};
