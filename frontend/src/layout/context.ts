import { type ComponentType, createContext, useContext, useSyncExternalStore } from "react";
import type { LayoutRegistry } from "./registry.ts";
import type { ResolvedRoute } from "./routes.ts";
import type { LayoutStore } from "./store.ts";
import type { AppManifest, Edge, LayoutState, PanelBadge, PanelKey, ViewParams } from "./types.ts";

export interface OpenOptions {
  /** Preview items are replaced by the next preview open in the same container. */
  preview?: boolean;
  /** Default true: routable views navigate (and so take focus). false only adds the item. */
  focus?: boolean;
  /**
   * Put the item in a new container split off another: the container holding
   * panel `of`, else the focused container. An item that is already open moves there.
   */
  beside?: { edge: Edge; of?: PanelKey };
  /** Replace the current history entry instead of adding one (default: replace only when switching to an open item). */
  replace?: boolean;
}

/** Which mounted panels are currently on screen; written by slots, read by `usePanel().isVisible`. */
export class VisibilityStore {
  private visible = new Map<PanelKey, boolean>();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  get = (key: PanelKey) => this.visible.get(key) ?? false;
  set(key: PanelKey, visible: boolean) {
    if (this.visible.get(key) === visible) return;
    this.visible.set(key, visible);
    for (const l of this.listeners) l();
  }
}

/** One command a view adds to its area's ⋯ menu. */
export interface PanelMenuItem {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  onSelect(): void;
  disabled?: boolean;
  /** Destructive: shown in the danger colour. */
  danger?: boolean;
  /** Starts a new group (a separator above it). */
  separated?: boolean;
}

/** A view's own section of its area's ⋯ menu, shown while the view is the one on screen there. */
export interface PanelMenu {
  /** Heading for the section; defaults to the panel's title. */
  label?: string;
  items: readonly PanelMenuItem[];
}

/**
 * Menus views contribute, by panel. Views publish on every render so closures
 * stay fresh; listeners only hear about changes to what the menu shows.
 */
export class PanelMenuStore {
  private menus = new Map<PanelKey, { menu: PanelMenu; signature: string }>();
  private listeners = new Set<() => void>();
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
  get = (key: PanelKey): PanelMenu | undefined => this.menus.get(key)?.menu;
  set(key: PanelKey, menu: PanelMenu | null) {
    const before = this.menus.get(key)?.signature;
    const signature = menu ? JSON.stringify([menu.label, menu.items.map(i => [i.id, i.label, i.disabled, i.danger, i.separated])]) : undefined;
    if (menu && signature) this.menus.set(key, { menu, signature });
    else this.menus.delete(key);
    if (before !== signature) for (const l of this.listeners) l();
  }
}

/** App-level actions the shell provides (saving arrangements as apps). */
export interface AppActions {
  saveAs?: (label: string, state: LayoutState) => Promise<void>;
  rename?: (label: string, state: LayoutState) => Promise<void>;
  remove?: () => Promise<void>;
}

export interface LayoutApi {
  app: AppManifest;
  registry: LayoutRegistry;
  store: LayoutStore;
  /** This app's resolved route, or null when the URL focuses nothing here. */
  route: ResolvedRoute | null;
  activeKey: PanelKey | null;
  isMobile: boolean;
  visibility: VisibilityStore;
  menus: PanelMenuStore;
  /** Detached element a panel renders into; slots attach it. */
  nodeFor(key: PanelKey): HTMLDivElement;
  /** Open a view in this app. Routable views navigate; others are added and activated in place. */
  open(viewId: string, params: ViewParams, options?: OpenOptions): void;
  /** Bring an item forward (navigates for routable views). */
  select(key: PanelKey): void;
  close(key: PanelKey): void;
  /** Close several panels at once; focus moves once, to an item that stays open. */
  closeMany(keys: readonly PanelKey[]): void;
  setBadge(key: PanelKey, badge: PanelBadge | null): void;
  setTitle(key: PanelKey, title: string | null): void;
  /** URL of a view in this app, or null when it has no route here. */
  urlFor(viewId: string, params: ViewParams): string | null;
  undo(): void;
  redo(): void;
  reset(): void;
  appActions: AppActions;
}

export const LayoutContext = createContext<LayoutApi | null>(null);

export function useLayoutApi(): LayoutApi {
  const api = useContext(LayoutContext);
  if (!api) throw new Error("useLayoutApi must be used inside a LayoutApp");
  return api;
}

export function useOptionalLayoutApi(): LayoutApi | null {
  return useContext(LayoutContext);
}

export function useLayoutState(): LayoutState {
  const { store } = useLayoutApi();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}
