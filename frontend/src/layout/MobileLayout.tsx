import { Fragment, useEffect, useRef, useState } from "react";
import { cn } from "../lib/utils.ts";
import { useLayoutApi, useLayoutState } from "./context.ts";
import { containers } from "./model.ts";
import { PanelSlot } from "./PanelHost.tsx";
import { Badge } from "./presenters/shared.tsx";
import type { PanelKey } from "./types.ts";

/**
 * Phone rendering of the same layout: every item in tree order on one strip,
 * grouped by container, one item on screen. Tapping a routable item navigates
 * exactly as on desktop.
 */
export function MobileLayout() {
  const api = useLayoutApi();
  const state = useLayoutState();
  const groups = containers(state.root).filter(c => c.items.length);
  const all = groups.flatMap(c => c.items);
  // Non-routable items (navigators) are shown locally; the URL wins again on the next navigation.
  const [local, setLocal] = useState<PanelKey | null>(null);
  useEffect(() => setLocal(null), [api.activeKey]);
  const shown = (local && all.includes(local) ? local : null) ?? (api.activeKey && all.includes(api.activeKey) ? api.activeKey : null) ?? all[0] ?? null;
  const strip = useRef<HTMLDivElement>(null);
  useEffect(() => {
    strip.current?.querySelector('[aria-selected="true"]')?.scrollIntoView({ inline: "nearest", block: "nearest" });
  }, [shown]);

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col bg-canvas">
      <div ref={strip} role="tablist" className="flex shrink-0 overflow-x-auto border-b border-line bg-sunken [scrollbar-width:none]">
        {groups.map((group, gi) => (
          <Fragment key={group.id}>
            {gi > 0 && <span aria-hidden="true" className="my-3 w-px shrink-0 bg-line-strong" />}
            {group.items.map(key => {
              const panel = state.panels[key];
              if (!panel) return null;
              const view = api.registry.view(panel.viewId);
              const Icon = view?.icon;
              return (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={key === shown}
                  onClick={() => {
                    if (view?.route !== undefined && api.urlFor(panel.viewId, panel.params)) api.select(key);
                    else setLocal(key);
                  }}
                  className={cn(
                    "flex min-h-11 shrink-0 items-center gap-1.5 border-b-2 px-3.5 text-xs whitespace-nowrap focus-ring",
                    key === shown ? "border-accent bg-canvas text-fg" : "border-transparent text-muted",
                  )}
                >
                  {Icon && <Icon className="h-3.5 w-3.5" aria-hidden="true" />}
                  {api.registry.titleOf(panel.viewId, panel.params, panel.title)}
                  <Badge badge={panel.badge} />
                </button>
              );
            })}
          </Fragment>
        ))}
      </div>
      <div className="flex min-h-0 flex-1">
        {all.map(key => (
          <PanelSlot key={key} panelKey={key} visible={key === shown} />
        ))}
        {!all.length && <p className="m-auto p-6 text-center text-xs text-muted">Nothing open in {api.app.label} yet.</p>}
      </div>
    </div>
  );
}
