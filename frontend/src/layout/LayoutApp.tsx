/**
 * One mounted app: its layout store, persistence, the one-way route effect,
 * and either the desktop surface or the phone layout.
 *
 * Data flow: URL → (resolve) → open + activate in the store → render.
 * Clicking a routable item navigates; nothing else writes focus.
 */
import { type KeyboardEvent, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { useIsMobileViewport } from "../hooks/useMediaQuery.ts";
import { type AppActions, type LayoutApi, LayoutContext, type OpenOptions, PanelMenuStore, VisibilityStore } from "./context.ts";
import { LayoutSurface } from "./LayoutSurface.tsx";
import { MobileLayout } from "./MobileLayout.tsx";
import { containerById, containerOf, containers, panelKey, visibleItem } from "./model.ts";
import { PanelHost } from "./PanelHost.tsx";
import { attachPersistence, initialLayout, type LayoutRemote } from "./persistence.ts";
import type { LayoutRegistry } from "./registry.ts";
import type { ResolvedRoute } from "./routes.ts";
import { LayoutStore } from "./store.ts";
import type { LayoutState, PanelKey } from "./types.ts";

interface LayoutAppProps {
  registry: LayoutRegistry;
  appId: string;
  /** The current URL resolved against the route table (any app). */
  route: ResolvedRoute | null;
  remote?: LayoutRemote | null;
  /** Force the phone layout (tests, previews). */
  mobile?: boolean;
  /** Called with the focused panel's title (null when the URL focuses nothing). Keep it stable. */
  onActiveTitleChange?: (title: string | null) => void;
  /** Save-as / rename / delete for this app, provided by the shell. */
  appActions?: AppActions;
}

const NO_ACTIONS: AppActions = {};

function isEditable(target: EventTarget | null): boolean {
  return target instanceof HTMLElement && !!target.closest("input, textarea, select, [contenteditable=''], [contenteditable='true'], .monaco-editor, .xterm");
}

/** Where focus goes when the focused item disappears: a routable visible item, preferring its old container. */
function fallbackUrl(api: Pick<LayoutApi, "urlFor" | "app" | "registry">, state: LayoutState, preferContainer: string | null): string {
  const order = [containerById(state, preferContainer), containers(state.root).find(c => c.primary), ...containers(state.root)];
  for (const c of order) {
    if (!c) continue;
    const key = visibleItem(c, null);
    const panel = key ? state.panels[key] : undefined;
    const url = panel ? api.urlFor(panel.viewId, panel.params) : null;
    if (url) return url;
  }
  return api.registry.routes.appPath(api.app.id) ?? "/";
}

export function LayoutApp({ registry, appId, route, remote = null, mobile, onActiveTitleChange, appActions = NO_ACTIONS }: LayoutAppProps) {
  const app = registry.app(appId);
  if (!app) throw new Error(`Unknown app "${appId}"`);
  const navigate = useNavigate();
  const location = useLocation();
  const viewportMobile = useIsMobileViewport();
  const isMobile = mobile ?? viewportMobile;

  const [store] = useState(() => new LayoutStore(registry.modelContext(appId), registry.lookup, app.layout, initialLayout(appId)));
  useEffect(() => attachPersistence(store, appId, remote), [store, appId, remote]);

  const nodes = useRef(new Map<PanelKey, HTMLDivElement>());
  /** Target of a navigation issued in the current task; a close() must not override a navigation elsewhere. */
  const navPending = useRef<string | null>(null);
  const [visibility] = useState(() => new VisibilityStore());
  const [menus] = useState(() => new PanelMenuStore());
  const myRoute = route && route.app === appId ? route : null;
  const activeKey = myRoute?.key ?? null;

  const api = useMemo<LayoutApi>(() => {
    // A view this app doesn't list (a widget linking to its own app's pages) lives at its own app's URL.
    const urlFor: LayoutApi["urlFor"] = (viewId, params) => {
      if (app.views.includes(viewId)) return registry.routes.urlFor(appId, viewId, params);
      for (const other of registry.apps) {
        const url = other.views.includes(viewId) ? registry.routes.urlFor(other.id, viewId, params) : null;
        if (url) return url;
      }
      return null;
    };
    const go = (url: string, options: { replace: boolean; state?: unknown }) => {
      navPending.current = url;
      queueMicrotask(() => {
        navPending.current = null;
      });
      void navigate(url, options);
    };
    const base = { app, registry, urlFor };
    const self: LayoutApi = {
      ...base,
      store,
      route: myRoute,
      activeKey,
      isMobile,
      visibility,
      menus,
      appActions,
      nodeFor(key) {
        let node = nodes.current.get(key);
        if (!node) {
          node = document.createElement("div");
          node.className = "flex min-h-0 min-w-0 flex-1 flex-col";
          node.dataset.panel = key;
          nodes.current.set(key, node);
        }
        return node;
      },
      open(viewId, params, options: OpenOptions = {}) {
        const view = registry.view(viewId);
        if (!view) return;
        const key = panelKey(viewId, params, view.instanceKey);
        const preview = options.preview === true;
        const url = urlFor(viewId, params);
        const exists = !!store.getState().panels[key];
        if (options.beside) {
          const state = store.getState();
          const ref = (options.beside.of ? containerOf(state, options.beside.of) : undefined) ?? containerById(state, state.focus);
          if (ref) {
            const target = { beside: ref.id, edge: options.beside.edge };
            if (exists) store.dispatch({ type: "move", key, target });
            else store.dispatch({ type: "open", panel: { key, viewId, kind: view.kind, params }, target, preview });
          }
        }
        if (!url || options.focus === false) {
          store.dispatch({ type: "open", panel: { key, viewId, kind: view.kind, params }, preview });
          if (!url && options.focus !== false) store.dispatch({ type: "activate", key });
          return;
        }
        if (exists && !preview) store.dispatch({ type: "pin", key });
        go(url, { replace: options.replace ?? exists, state: preview ? { preview: true } : null });
      },
      select(key) {
        const panel = store.getState().panels[key];
        if (!panel) return;
        const url = (panel.lastParams && urlFor(panel.viewId, panel.lastParams)) ?? urlFor(panel.viewId, panel.params);
        if (url) go(url, { replace: true });
        else store.dispatch({ type: "activate", key });
      },
      close(key) {
        const before = store.getState();
        const host = containerOf(before, key);
        if (!store.dispatch({ type: "close", key })) return;
        // Focus moves to a neighbour, unless the caller just navigated somewhere else itself (open(x); close(self)).
        const closedPanel = before.panels[key];
        const closedUrl = closedPanel ? urlFor(closedPanel.viewId, closedPanel.params) : null;
        const elsewhere = navPending.current !== null && navPending.current !== closedUrl;
        if (key === activeKey && !elsewhere) go(fallbackUrl(base, store.getState(), host?.id ?? null), { replace: true });
      },
      closeMany(keys) {
        const before = store.getState();
        const activeHost = activeKey && keys.includes(activeKey) ? containerOf(before, activeKey) : undefined;
        const closedUrls = new Set(
          keys.flatMap(key => {
            const panel = before.panels[key];
            const url = panel ? urlFor(panel.viewId, panel.params) : null;
            return url ? [url] : [];
          }),
        );
        let closedActive = false;
        for (const key of keys) {
          if (store.dispatch({ type: "close", key }) && key === activeKey) closedActive = true;
        }
        // As in close(): a navigation the caller just made elsewhere wins.
        const elsewhere = navPending.current !== null && !closedUrls.has(navPending.current);
        if (closedActive && !elsewhere) go(fallbackUrl(base, store.getState(), activeHost?.id ?? null), { replace: true });
      },
      setBadge(key, badge) {
        store.dispatch({ type: "patch", key, badge });
      },
      setTitle(key, title) {
        store.dispatch({ type: "patch", key, title });
      },
      undo() {
        if (store.undo()) reconcile();
      },
      redo() {
        if (store.redo()) reconcile();
      },
      reset() {
        const live = activeKey ? store.getState().panels[activeKey] : undefined;
        store.reset();
        // The URL still owns focus: put its resource back into the fresh layout, with what its view set.
        openActive();
        if (activeKey && live) store.dispatch({ type: "patch", key: activeKey, title: live.title ?? null, badge: live.badge ?? null });
      },
    };
    /**
     * After undo/redo the restored arrangement decides what each container shows; the URL follows
     * it to the focused panel's container, so undoing a close brings back (and focuses) the panel.
     */
    const reconcile = () => {
      if (!activeKey) return;
      const state = store.getState();
      if (!state.panels[activeKey]) {
        go(fallbackUrl(base, state, null), { replace: true });
        return;
      }
      const host = containerOf(state, activeKey);
      const shown = host ? visibleItem(host, activeKey) : activeKey;
      if (!shown || shown === activeKey) return;
      const panel = state.panels[shown];
      const url = panel ? urlFor(panel.viewId, panel.params) : null;
      if (url) go(url, { replace: true });
      else store.dispatch({ type: "activate", key: activeKey });
    };
    const openActive = () => {
      if (!myRoute?.viewId || !myRoute.key) return;
      const view = registry.view(myRoute.viewId);
      if (!view) return;
      store.dispatch({ type: "open", panel: { key: myRoute.key, viewId: myRoute.viewId, kind: view.kind, params: myRoute.params } });
      store.dispatch({ type: "activate", key: myRoute.key });
    };
    return self;
  }, [app, registry, appId, store, myRoute, activeKey, isMobile, visibility, menus, navigate, appActions]);

  // URL → layout. Idempotent: opening an open panel and activating the active one are no-ops.
  const preview = (location.state as { preview?: unknown } | null)?.preview === true;
  useLayoutEffect(() => {
    if (!myRoute?.viewId || !myRoute.key) return;
    const view = registry.view(myRoute.viewId);
    if (!view) return;
    store.dispatch({ type: "open", panel: { key: myRoute.key, viewId: myRoute.viewId, kind: view.kind, params: myRoute.params }, preview });
    store.dispatch({ type: "activate", key: myRoute.key });
    // A panel following the URL (constant instance key) remembers where it was, for its tab to return there.
    const opened = store.getState().panels[myRoute.key];
    if (opened) {
      const same = JSON.stringify(opened.params) === JSON.stringify(myRoute.params);
      store.dispatch({ type: "patch", key: myRoute.key, lastParams: same ? null : myRoute.params });
    }
    const state = store.getState();
    if (state.maximized && containerOf(state, myRoute.key)?.id !== state.maximized) store.dispatch({ type: "maximize", container: null });
  }, [store, registry, myRoute, preview, location.key]);

  // Drop the elements of panels that no longer exist (after React has unmounted their portals).
  useEffect(
    () =>
      store.subscribe(() => {
        const { panels } = store.getState();
        queueMicrotask(() => {
          for (const [key, node] of nodes.current) {
            if (!panels[key] && !store.getState().panels[key]) {
              node.remove();
              nodes.current.delete(key);
            }
          }
        });
      }),
    [store],
  );

  // Document title and the shell's breadcrumb follow the focused panel, including runtime setTitle calls.
  useEffect(() => {
    let last: string | null | undefined;
    const update = () => {
      const panel = activeKey ? store.getState().panels[activeKey] : undefined;
      const title = panel ? registry.titleOf(panel.viewId, panel.params, panel.title) : null;
      if (title === last) return;
      last = title;
      document.title = title ? `${title} · ${app.label}` : `${app.label} · TokenRing One`;
      onActiveTitleChange?.(title);
    };
    update();
    return store.subscribe(update);
  }, [activeKey, store, registry, app.label, onActiveTitleChange]);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const mod = e.metaKey || e.ctrlKey;
    const s = store.getState();
    const focused = containerById(s, s.focus) ?? (activeKey ? containerOf(s, activeKey) : undefined);
    const shown = focused ? visibleItem(focused, activeKey) : null;
    if (mod && e.key.toLowerCase() === "z" && !isEditable(e.target)) {
      e.preventDefault();
      if (e.shiftKey) api.redo();
      else api.undo();
    } else if (mod && e.key === "\\" && focused && shown) {
      e.preventDefault();
      store.dispatch({ type: "move", key: shown, target: { beside: focused.id, edge: "right" } });
    } else if (e.altKey && e.code === "KeyM" && focused) {
      e.preventDefault();
      store.dispatch({ type: "maximize", container: s.maximized === focused.id ? null : focused.id });
    } else if (e.altKey && e.code === "KeyW" && shown) {
      e.preventDefault();
      if (registry.view(s.panels[shown]?.viewId ?? "")?.closable !== false) api.close(shown);
    } else if (e.altKey && (e.code === "BracketLeft" || e.code === "BracketRight") && focused && shown) {
      e.preventDefault();
      const n = focused.items.length;
      const next = focused.items[(focused.items.indexOf(shown) + (e.code === "BracketRight" ? 1 : -1) + n) % n];
      if (next) api.select(next);
    }
  };

  return (
    <LayoutContext.Provider value={api}>
      <div className="flex min-h-0 min-w-0 flex-1" data-app={appId} onKeyDown={onKeyDown}>
        {isMobile ? <MobileLayout /> : <LayoutSurface />}
        <PanelHost />
      </div>
    </LayoutContext.Provider>
  );
}
