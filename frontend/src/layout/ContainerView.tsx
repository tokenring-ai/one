import { Check, Columns2, Ellipsis, Layers, Link as LinkIcon, Maximize2, Minimize2, Pencil, Pin, Plus, RotateCcw, Rows2, Save, Trash2, X } from "lucide-react";
import { createElement, type DragEvent, Fragment, useEffect, useRef, useState, useSyncExternalStore } from "react";
import ConfirmModal from "../components/ui/ConfirmModal.tsx";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu.tsx";
import { toastManager } from "../components/ui/toast.tsx";
import { cn } from "../lib/utils.ts";
import { AppNameDialog } from "./AppNameDialog.tsx";
import { useLayoutApi, useLayoutState } from "./context.ts";
import { currentDrag, dragSourceProps, endDrag, onDragEnd } from "./dnd.ts";
import { ANY_KIND, acceptsKind, hasRoom, type Placement, panelKey, visibleItem } from "./model.ts";
import { PanelSlot } from "./PanelHost.tsx";
import { PRESENTERS } from "./presenters/index.ts";
import type { PresenterContext } from "./presenters/types.ts";
import type { ContainerNode, Edge, PanelKey } from "./types.ts";

type DropState = { type: "zone"; zone: Edge | "center" } | { type: "blocked"; message: string } | { type: "index"; index: number };

const ZONE_INSET: Record<Edge | "center", string> = {
  center: "6px",
  left: "6px 50% 6px 6px",
  right: "6px 6px 6px 50%",
  top: "6px 6px 50% 6px",
  bottom: "50% 6px 6px 6px",
};

function zoneAt(e: DragEvent<HTMLElement>, el: HTMLElement): Edge | "center" {
  const r = el.getBoundingClientRect();
  const x = (e.clientX - r.left) / r.width;
  const y = (e.clientY - r.top) / r.height;
  const m = Math.min(x, 1 - x, y, 1 - y);
  if (m >= 0.25) return "center";
  if (m === x) return "left";
  if (m === 1 - x) return "right";
  return m === y ? "top" : "bottom";
}

export function ContainerView({ node }: { node: ContainerNode }) {
  const api = useLayoutApi();
  const state = useLayoutState();
  const [drop, setDrop] = useState<DropState | null>(null);
  const sectionRef = useRef<HTMLElement>(null);
  useEffect(() => onDragEnd(() => setDrop(null)), []);

  const visible = visibleItem(node, api.activeKey);
  const focused = state.focus ? state.focus === node.id : !!(api.activeKey && node.items.includes(api.activeKey));
  const acceptLabel = node.accepts.includes(ANY_KIND) ? "anything" : node.accepts.map(k => api.registry.kind(k)?.plural ?? k).join(" and ");
  // Named for what it shows, so a screen reader hears "Coding Agent" rather than "tabs container".
  const shown = visible ? state.panels[visible] : undefined;
  const regionLabel = shown
    ? api.registry.titleOf(shown.viewId, shown.params, shown.title)
    : node.accepts.includes(ANY_KIND)
      ? "Empty area"
      : `Area for ${acceptLabel}`;

  const refusal = (key: PanelKey): string | null => {
    const panel = state.panels[key];
    if (!panel) return "Can't move that here.";
    if (!acceptsKind(node, panel.kind)) return `Only ${acceptLabel} here. Drop on an edge to split.`;
    if (!hasRoom(node, key)) return "This shows one item. Drop on an edge to split.";
    return null;
  };
  const dragKey = () => {
    const drag = currentDrag();
    return drag && drag.app === api.app.id ? drag.key : null;
  };
  const commit = (target: Placement) => {
    const key = dragKey();
    endDrag();
    setDrop(null);
    if (key) api.store.dispatch({ type: "move", key, target });
  };
  const setDropIfChanged = (next: DropState) => setDrop(prev => (prev && JSON.stringify(prev) === JSON.stringify(next) ? prev : next));

  const indexDrop = (index: number | ((e: DragEvent<HTMLElement>) => number)) => ({
    onDragOver: (e: DragEvent<HTMLElement>) => {
      const key = dragKey();
      if (!key) return;
      e.stopPropagation();
      const why = refusal(key);
      if (why) {
        setDropIfChanged({ type: "blocked", message: why });
        return;
      }
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setDropIfChanged({ type: "index", index: typeof index === "number" ? index : index(e) });
    },
    onDrop: (e: DragEvent<HTMLElement>) => {
      const key = dragKey();
      if (!key || refusal(key)) return;
      e.preventDefault();
      e.stopPropagation();
      commit({ container: node.id, index: typeof index === "number" ? index : index(e) });
    },
  });

  const ctx: PresenterContext = {
    node,
    state,
    api,
    visible,
    focused,
    panel: key => state.panels[key],
    title: key => {
      const p = state.panels[key];
      return p ? api.registry.titleOf(p.viewId, p.params, p.title) : key;
    },
    icon: key => {
      const p = state.panels[key];
      const view = p && api.registry.view(p.viewId);
      return view ? createElement(view.icon, { className: "h-3.5 w-3.5 shrink-0 opacity-80", "aria-hidden": true }) : null;
    },
    slot: (key, isVisible) => <PanelSlot panelKey={key} visible={isVisible && (!state.maximized || state.maximized === node.id)} />,
    actions: <ContainerActions node={node} visible={visible} />,
    drag: key => dragSourceProps(api.app.id, key),
    itemDrop: (index, axis) =>
      indexDrop(e => {
        const r = e.currentTarget.getBoundingClientRect();
        const before = axis === "x" ? e.clientX < r.left + r.width / 2 : e.clientY < r.top + r.height / 2;
        return before ? index : index + 1;
      }),
    stripDrop: indexDrop(node.items.length),
    insertAt: drop?.type === "index" ? drop.index : null,
  };

  const presenter = PRESENTERS[node.presenter].presenter;
  const overlay =
    drop?.type === "zone" ? (
      <div
        aria-hidden="true"
        className="pointer-events-none absolute z-10 rounded-md border-[1.5px] border-accent-line bg-accent-tint transition-all"
        style={{ inset: ZONE_INSET[drop.zone] }}
      >
        <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full bg-raised px-2 py-0.5 text-[11px] whitespace-nowrap text-accent-soft shadow-[var(--elevation-popover)]">
          {drop.zone === "center" ? "Add here" : `Split ${drop.zone}`}
        </span>
      </div>
    ) : drop?.type === "blocked" ? (
      <div aria-hidden="true" className="pointer-events-none absolute inset-1.5 z-10 rounded-md border-[1.5px] border-dashed border-line-strong bg-fg/5">
        <span className="absolute top-1/2 left-1/2 max-w-[90%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-raised px-2 py-0.5 text-center text-[11px] text-muted shadow-[var(--elevation-popover)]">
          {drop.message}
        </span>
      </div>
    ) : null;

  return (
    <section
      ref={sectionRef}
      data-container={node.id}
      aria-label={regionLabel}
      onPointerDownCapture={() => api.store.dispatch({ type: "focus", container: node.id })}
      onDragLeave={e => {
        if (!sectionRef.current?.contains(e.relatedTarget as Node | null)) setDrop(null);
      }}
      className={cn("flex min-h-0 min-w-0 flex-col overflow-hidden rounded-pane border bg-canvas", focused ? "border-accent-line" : "border-line")}
    >
      {presenter.header?.(ctx)}
      <div
        className="relative flex min-h-0 min-w-0 flex-1 flex-col"
        onDragOver={e => {
          const key = dragKey();
          if (!key) return;
          const zone = zoneAt(e, e.currentTarget);
          if (zone === "center") {
            const why = refusal(key);
            if (why) {
              setDropIfChanged({ type: "blocked", message: why });
              return;
            }
          } else if (node.items.length === 1 && node.items[0] === key) {
            // Splitting a container's only item off itself would do nothing.
            setDrop(null);
            return;
          }
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          setDropIfChanged({ type: "zone", zone });
        }}
        onDrop={e => {
          const key = dragKey();
          if (!key) return;
          const zone = zoneAt(e, e.currentTarget);
          if (zone === "center" && refusal(key)) return;
          e.preventDefault();
          commit(zone === "center" ? { container: node.id } : { beside: node.id, edge: zone });
        }}
      >
        {presenter.body(ctx)}
        {node.items.length === 0 && <EmptyContainer node={node} />}
        {overlay}
      </div>
      {presenter.footer?.(ctx)}
    </section>
  );
}

function EmptyContainer({ node }: { node: ContainerNode }) {
  const api = useLayoutApi();
  const what = node.accepts.includes(ANY_KIND) ? "anything" : node.accepts.map(k => api.registry.kind(k)?.plural ?? k).join(" or ");
  return (
    <div className="flex flex-1 items-center justify-center p-6 text-center text-xs text-muted">
      <p className="max-w-60">Nothing open here. Drag {what} here, or open one from the app.</p>
    </div>
  );
}

function ContainerActions({ node, visible }: { node: ContainerNode; visible: PanelKey | null }) {
  const api = useLayoutApi();
  const state = useLayoutState();
  const panel = visible ? state.panels[visible] : undefined;
  const view = panel ? api.registry.view(panel.viewId) : undefined;
  const maximized = state.maximized === node.id;
  const kindsHere = [...new Set(node.items.map(k => state.panels[k]?.kind).filter((k): k is string => !!k))];
  const many = node.items.length > 1;
  const item = "gap-2 text-xs";
  const icon = "h-3.5 w-3.5 text-muted";
  const dispatch = api.store.dispatch;
  const [dialog, setDialog] = useState<"save" | "rename" | "reset" | "delete" | null>(null);
  // The shown view's own commands (actions on what it displays) come first.
  const viewMenu = useSyncExternalStore(
    api.menus.subscribe,
    () => (visible ? api.menus.get(visible) : undefined),
    () => undefined,
  );
  // Views of this app the container could show that aren't open (a closed widget, a navigator).
  const addable = api.app.views.flatMap(viewId => {
    const view = api.registry.view(viewId);
    if (!view || !acceptsKind(node, view.kind)) return [];
    const key = panelKey(viewId, {}, view.instanceKey);
    if (state.panels[key] || !hasRoom(node, key)) return [];
    // Routable views that need params (a document, an agent) are opened from their app, not from here.
    if (view.route !== undefined && api.urlFor(viewId, {}) === null) return [];
    return [{ view, key }];
  });
  const addView = (entry: (typeof addable)[number]) => {
    const { view, key } = entry;
    dispatch({ type: "open", panel: { key, viewId: view.id, kind: view.kind, params: {} }, target: { container: node.id } });
    api.select(key);
  };
  const { saveAs, rename, remove } = api.appActions;
  const url = panel ? api.urlFor(panel.viewId, panel.params) : null;
  return (
    <div className="flex shrink-0 items-center gap-px border-l border-line-subtle px-1">
      <button
        type="button"
        aria-label={maximized ? "Restore layout" : "Maximize"}
        title={maximized ? "Restore layout" : "Maximize"}
        onClick={() => dispatch({ type: "maximize", container: maximized ? null : node.id })}
        className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-hover hover:text-fg focus-ring"
      >
        {maximized ? <Minimize2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Maximize2 className="h-3.5 w-3.5" aria-hidden="true" />}
      </button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            aria-label="Container options"
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-hover hover:text-fg focus-ring"
          >
            <Ellipsis className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-56">
          {viewMenu && viewMenu.items.length > 0 && panel && (
            <>
              <DropdownMenuLabel>{viewMenu.label ?? api.registry.titleOf(panel.viewId, panel.params, panel.title)}</DropdownMenuLabel>
              {viewMenu.items.map(entry => (
                <Fragment key={entry.id}>
                  {entry.separated && <DropdownMenuSeparator />}
                  <DropdownMenuItem className={cn(item, entry.danger && "text-error")} disabled={entry.disabled} onSelect={() => entry.onSelect()}>
                    {entry.icon && createElement(entry.icon, { className: cn(icon, entry.danger && "text-error"), "aria-hidden": true })} {entry.label}
                  </DropdownMenuItem>
                </Fragment>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {/* This tab: what you'd do with the item you're looking at. */}
          {visible && panel && (
            <>
              <DropdownMenuLabel>{api.registry.titleOf(panel.viewId, panel.params, panel.title)}</DropdownMenuLabel>
              {panel.preview && (
                <DropdownMenuItem className={item} onSelect={() => dispatch({ type: "pin", key: visible })}>
                  <Pin className={icon} aria-hidden="true" /> Keep open
                </DropdownMenuItem>
              )}
              {url && (
                <DropdownMenuItem
                  className={item}
                  onSelect={() => {
                    const href = new URL(url, window.location.origin).href;
                    void Promise.resolve()
                      .then(() => navigator.clipboard.writeText(href))
                      .then(
                        () => toastManager.success("Link copied"),
                        () => toastManager.info(href),
                      );
                  }}
                >
                  <LinkIcon className={icon} aria-hidden="true" /> Copy link
                </DropdownMenuItem>
              )}
              <DropdownMenuItem
                className={item}
                disabled={!many}
                onSelect={() => dispatch({ type: "move", key: visible, target: { beside: node.id, edge: "right" } })}
              >
                <Columns2 className={icon} aria-hidden="true" /> Move to a split on the right
              </DropdownMenuItem>
              <DropdownMenuItem
                className={item}
                disabled={!many}
                onSelect={() => dispatch({ type: "move", key: visible, target: { beside: node.id, edge: "bottom" } })}
              >
                <Rows2 className={icon} aria-hidden="true" /> Move to a split below
              </DropdownMenuItem>
              {view?.closable !== false && (
                <DropdownMenuItem className={item} onSelect={() => api.close(visible)} title={view?.closeHint}>
                  <X className={icon} aria-hidden="true" /> Close
                </DropdownMenuItem>
              )}
              <DropdownMenuSeparator />
            </>
          )}
          {addable.length > 0 && (
            <>
              <DropdownMenuLabel>Add here</DropdownMenuLabel>
              {addable.map(entry => (
                <DropdownMenuItem key={entry.view.id} className={item} onSelect={() => addView(entry)}>
                  <Plus className={icon} aria-hidden="true" /> {api.registry.titleOf(entry.view.id, {})}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
            </>
          )}
          {/* How this area presents its items and what it takes: occasional, so one level down. */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger className={item}>
              <Layers className={icon} aria-hidden="true" /> Arrange this area
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {Object.values(PRESENTERS).map(entry => {
                const current = entry.id === node.presenter;
                const tooMany = entry.id === "single" && many;
                return (
                  <DropdownMenuItem
                    key={entry.id}
                    className={item}
                    disabled={current || tooMany}
                    onSelect={() => dispatch({ type: "present", container: node.id, presenter: entry.id })}
                  >
                    {createElement(entry.icon, { className: icon, "aria-hidden": true })} Show as {entry.label.toLowerCase()}
                    {current && <Check className="ml-auto h-3.5 w-3.5 text-accent" aria-hidden="true" />}
                  </DropdownMenuItem>
                );
              })}
              <DropdownMenuSeparator />
              {node.accepts.includes(ANY_KIND) ? (
                <DropdownMenuItem
                  className={item}
                  disabled={!kindsHere.length}
                  onSelect={() => dispatch({ type: "accepts", container: node.id, accepts: kindsHere })}
                >
                  <Layers className={icon} aria-hidden="true" /> Only take what's here now
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className={item} onSelect={() => dispatch({ type: "accepts", container: node.id, accepts: [ANY_KIND] })}>
                  <Layers className={icon} aria-hidden="true" /> Take any kind of item
                </DropdownMenuItem>
              )}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuSeparator />
          <DropdownMenuLabel>{api.app.label} app</DropdownMenuLabel>
          {saveAs && (
            <DropdownMenuItem className={item} onSelect={() => setDialog("save")}>
              <Save className={icon} aria-hidden="true" /> Save layout as new app…
            </DropdownMenuItem>
          )}
          {rename && (
            <DropdownMenuItem className={item} onSelect={() => setDialog("rename")}>
              <Pencil className={icon} aria-hidden="true" /> Rename…
            </DropdownMenuItem>
          )}
          <DropdownMenuItem className={item} onSelect={() => setDialog("reset")}>
            <RotateCcw className={icon} aria-hidden="true" /> Reset layout…
          </DropdownMenuItem>
          {remove && (
            <DropdownMenuItem className={item} onSelect={() => setDialog("delete")}>
              <Trash2 className={icon} aria-hidden="true" /> Delete app…
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
      {dialog === "save" && saveAs && (
        <AppNameDialog
          title="Save as new app"
          description={`Saves this arrangement of ${api.app.label} as its own app in the rail.`}
          initialName={`My ${api.app.label}`}
          confirmLabel="Save app"
          onSubmit={name => saveAs(name, api.store.getState())}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "rename" && rename && (
        <AppNameDialog
          title="Rename app"
          description="The new name shows in the rail and the app switcher."
          initialName={api.app.label}
          confirmLabel="Rename"
          onSubmit={name => rename(name, api.store.getState())}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "reset" && (
        <ConfirmModal
          title={`Reset ${api.app.label} layout?`}
          message="Puts every area and tab back the way the app ships. Your open items close; nothing else is lost. Undo (Ctrl/⌘+Z) brings the arrangement back."
          confirmLabel="Reset layout"
          variant="warning"
          onConfirm={() => api.reset()}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === "delete" && remove && (
        <ConfirmModal
          title={`Delete ${api.app.label}?`}
          message="This removes the saved app and its layout. The app it was based on is not affected."
          confirmLabel="Delete app"
          variant="danger"
          onConfirm={() => remove()}
          onClose={() => setDialog(null)}
        />
      )}
    </div>
  );
}
