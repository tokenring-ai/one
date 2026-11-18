import { createContext, useCallback, useContext, useEffect, useMemo, useSyncExternalStore } from "react";
import { type OpenOptions, type PanelMenu, useLayoutApi } from "./context.ts";
import { panelKey } from "./model.ts";
import type { PanelBadge, PanelKey, ViewParams } from "./types.ts";

export interface PanelHandle {
  key: PanelKey;
  viewId: string;
  /** Params the panel was opened with (fixed for its lifetime). */
  params: ViewParams;
  /**
   * The URL's params while the URL focuses this panel, else null. Differs from
   * `params` for views whose instance key ignores some params (one marketplace
   * panel showing whichever item the URL names).
   */
  routeParams: ViewParams | null;
  /** The URL focuses this panel. */
  isActive: boolean;
  /** On screen (its container shows it and the container is not hidden by a maximized one). */
  isVisible: boolean;
  setTitle(title: string | null): void;
  setBadge(badge: PanelBadge | null): void;
  close(): void;
}

export interface PanelIdentity {
  key: PanelKey;
  viewId: string;
  params: ViewParams;
}

export const PanelIdentityContext = createContext<PanelIdentity | null>(null);

/** The panel a view is rendered in. */
export function usePanel(): PanelHandle {
  const identity = useContext(PanelIdentityContext);
  if (!identity) throw new Error("usePanel must be used inside a layout panel");
  const api = useLayoutApi();
  const isVisible = useSyncExternalStore(
    api.visibility.subscribe,
    () => api.visibility.get(identity.key),
    () => false,
  );
  const { key } = identity;
  const isActive = api.activeKey === key;
  const routeParams = isActive ? (api.route?.params ?? null) : null;
  // Stable while nothing relevant changes, so effects can depend on the handle or its functions.
  const actions = useMemo(
    () => ({
      setTitle: (title: string | null) => api.setTitle(key, title),
      setBadge: (badge: PanelBadge | null) => api.setBadge(key, badge),
      close: () => api.close(key),
    }),
    [key, api],
  );
  return useMemo(() => ({ ...identity, routeParams, isActive, isVisible, ...actions }), [identity, routeParams, isActive, isVisible, actions]);
}

/**
 * Adds a section to this panel's area ⋯ menu (actions on what the view shows,
 * such as the selected agent). Pass null for none. Safe to call with fresh
 * closures every render.
 */
export function usePanelMenu(menu: PanelMenu | null): void {
  const identity = useContext(PanelIdentityContext);
  if (!identity) throw new Error("usePanelMenu must be used inside a layout panel");
  const { menus } = useLayoutApi();
  const { key } = identity;
  useEffect(() => {
    menus.set(key, menu);
  });
  useEffect(() => () => menus.set(key, null), [menus, key]);
}

/** Navigate to a view in the current app (preview, or pinned by default). */
export function usePaneLink(): (viewId: string, params?: ViewParams, options?: OpenOptions) => void {
  const api = useLayoutApi();
  return useCallback((viewId, params = {}, options) => api.open(viewId, params, options), [api]);
}

/** Imperative layout access for views: open without focus (a chat beside a document), close, query. */
export function useLayout() {
  const api = useLayoutApi();
  return {
    open: (viewId: string, params: ViewParams, options?: OpenOptions) => api.open(viewId, params, options),
    close(viewId: string, params: ViewParams = {}) {
      const info = api.registry.lookup(viewId);
      if (info) api.close(panelKey(viewId, params, info.instanceKey));
    },
    /** Closes every panel matching `test` in one go (focus moves once, to something that stays open). */
    closeWhere(test: (panel: { key: PanelKey; viewId: string; params: ViewParams }) => boolean) {
      api.closeMany(
        Object.values(api.store.getState().panels)
          .filter(test)
          .map(panel => panel.key),
      );
    },
    has(viewId: string, params: ViewParams = {}): boolean {
      const info = api.registry.lookup(viewId);
      return !!info && !!api.store.getState().panels[panelKey(viewId, params, info.instanceKey)];
    },
    urlFor: (viewId: string, params: ViewParams) => api.urlFor(viewId, params),
  };
}
