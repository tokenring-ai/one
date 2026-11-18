/**
 * Pure layout model. No React, no DOM, no URL: the router decides what is
 * focused and calls `open` + `activate`; everything here is arrangement.
 *
 * Invariants kept by `normalize` (and asserted in model.test.ts):
 * - every panel key sits in exactly one container, and every panel in a container exists;
 * - no split has fewer than two children, and no split nests a split of the same direction;
 * - split sizes sum to 1;
 * - only the primary container may be empty;
 * - a container only holds kinds it accepts, and a `single` holds at most one item.
 */
import type {
  ContainerNode,
  ContainerTemplate,
  Edge,
  LayoutNode,
  LayoutState,
  LayoutTemplate,
  PanelBadge,
  PanelKey,
  PanelState,
  PresenterId,
  SplitNode,
  ViewKind,
  ViewParams,
} from "./types.ts";
import { LAYOUT_SCHEMA_VERSION } from "./types.ts";

export const ANY_KIND = "*";

/** Presenters that hold at most one item. */
const SINGLE_ITEM: ReadonlySet<PresenterId> = new Set(["single"]);
const PRESENTER_IDS: ReadonlySet<string> = new Set<PresenterId>(["tabs", "single", "accordion", "carousel"]);

export interface ModelContext {
  app: string;
  primaryKind: ViewKind;
  placement?: Readonly<Partial<Record<ViewKind, Edge>>> | undefined;
  /** Presenter for a container created on demand for a kind. */
  presenterFor: (kind: ViewKind) => PresenterId;
  /** The app's `layoutVersion`; saved layouts from another version are discarded. Default 1. */
  layoutVersion?: number | undefined;
  /** Landing views retire when something else is shown in their container. */
  isLanding?: ((viewId: string) => boolean) | undefined;
}

export interface ViewInfo {
  kind: ViewKind;
  instanceKey?: ((params: ViewParams) => string) | undefined;
}
export type ViewLookup = (viewId: string) => ViewInfo | undefined;

export type Placement = { container: string; index?: number | undefined } | { beside: string; edge: Edge; frac?: number | undefined };

export type LayoutAction =
  | { type: "open"; panel: PanelState; target?: Placement | undefined; preview?: boolean | undefined }
  | { type: "close"; key: PanelKey }
  | { type: "move"; key: PanelKey; target: Placement }
  | { type: "resize"; split: string; sizes: number[] }
  | { type: "activate"; key: PanelKey }
  | { type: "focus"; container: string }
  | { type: "toggle"; key: PanelKey }
  | { type: "present"; container: string; presenter: PresenterId }
  | { type: "accepts"; container: string; accepts: ViewKind[] }
  | { type: "pin"; key: PanelKey }
  | { type: "patch"; key: PanelKey; title?: string | null | undefined; badge?: PanelBadge | null | undefined; lastParams?: ViewParams | null | undefined }
  | { type: "maximize"; container: string | null };

const STRUCTURAL: ReadonlySet<LayoutAction["type"]> = new Set(["open", "close", "move", "resize", "present", "accepts", "maximize"]);

/** Actions worth an undo step. Focus, activation and badges are not. */
export function isStructural(action: LayoutAction): boolean {
  return STRUCTURAL.has(action.type);
}

/* ---------- ids and keys ---------- */

let idSeq = 0;
function newId(prefix: string): string {
  idSeq += 1;
  return `${prefix}${idSeq.toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

export function panelKey(viewId: string, params: ViewParams, instanceKey?: (params: ViewParams) => string): PanelKey {
  if (instanceKey) return `${viewId}:${instanceKey(params)}`;
  const values = Object.keys(params)
    .sort()
    .map(k => params[k]);
  return `${viewId}:${values.length ? values.join("/") : "_"}`;
}

/* ---------- tree queries ---------- */

export function containers(node: LayoutNode, out: ContainerNode[] = []): ContainerNode[] {
  if (node.kind === "container") out.push(node);
  else for (const child of node.children) containers(child, out);
  return out;
}

export function containerById(state: LayoutState, id: string | null | undefined): ContainerNode | undefined {
  return id ? containers(state.root).find(c => c.id === id) : undefined;
}

export function containerOf(state: LayoutState, key: PanelKey): ContainerNode | undefined {
  return containers(state.root).find(c => c.items.includes(key));
}

function findParent(node: LayoutNode, target: LayoutNode, parent: SplitNode | null = null): SplitNode | null | undefined {
  if (node === target) return parent;
  if (node.kind === "split") {
    for (const child of node.children) {
      const found = findParent(child, target, node);
      if (found !== undefined) return found;
    }
  }
  return undefined;
}

function findSplit(node: LayoutNode, id: string): SplitNode | undefined {
  if (node.kind !== "split") return undefined;
  if (node.id === id) return node;
  for (const child of node.children) {
    const found = findSplit(child, id);
    if (found) return found;
  }
  return undefined;
}

/**
 * The item a container shows: its most recently activated item. Every
 * navigation activates the URL's panel, so the URL wins whenever it changes;
 * activating a non-routable item afterwards (a form, a tool) brings that one
 * forward without touching the URL. `activeKey` is only a fallback for
 * containers whose last-active item is gone.
 */
export function visibleItem(container: ContainerNode, activeKey: PanelKey | null | undefined): PanelKey | null {
  if (container.lastActive && container.items.includes(container.lastActive)) return container.lastActive;
  if (activeKey && container.items.includes(activeKey)) return activeKey;
  return container.items[0] ?? null;
}

export function acceptsKind(container: ContainerNode, kind: ViewKind): boolean {
  return container.accepts.includes(ANY_KIND) || container.accepts.includes(kind);
}

export function hasRoom(container: ContainerNode, key: PanelKey): boolean {
  return !SINGLE_ITEM.has(container.presenter) || container.items.length === 0 || container.items[0] === key;
}

export function canTake(state: LayoutState, container: ContainerNode, key: PanelKey): boolean {
  const panel = state.panels[key];
  return !!panel && acceptsKind(container, panel.kind) && hasRoom(container, key);
}

export function presenterHoldsMany(presenter: PresenterId): boolean {
  return !SINGLE_ITEM.has(presenter);
}

/** Where an opened item goes: a container that takes it, preferring ones dedicated to its kind, then last used, then focused. */
export function containerFor(state: LayoutState, key: PanelKey): ContainerNode | undefined {
  const panel = state.panels[key];
  if (!panel) return undefined;
  const candidates = containers(state.root).filter(c => canTake(state, c, key));
  const pick = (list: ContainerNode[]) => list.find(c => c.id === state.lastByKind[panel.kind]) ?? list.find(c => c.id === state.focus) ?? list[0];
  return pick(candidates.filter(c => !c.accepts.includes(ANY_KIND))) ?? pick(candidates);
}

/* ---------- construction ---------- */

function mkContainer(presenter: PresenterId, accepts: ViewKind[], items: PanelKey[] = [], primary = false): ContainerNode {
  const node: ContainerNode = { kind: "container", id: newId("c"), presenter, accepts: [...accepts], items: [...items], lastActive: items[0] ?? null };
  if (primary) node.primary = true;
  if (presenter === "accordion") node.expanded = [...items];
  return node;
}

function emptyState(app: string, root: LayoutNode): LayoutState {
  return { version: LAYOUT_SCHEMA_VERSION, app, root, panels: {}, maximized: null, focus: null, lastByKind: {} };
}

/** Builds a fresh layout from an app's template. Unknown views are skipped. */
export function instantiate(template: LayoutTemplate, ctx: ModelContext, lookup: ViewLookup): LayoutState {
  const panels: Record<PanelKey, PanelState> = {};
  const build = (t: LayoutTemplate): LayoutNode => {
    if ("split" in t) {
      const sizes = t.sizes?.length === t.children.length ? [...t.sizes] : t.children.map(() => 1);
      return { kind: "split", id: newId("p"), dir: t.split, sizes, children: t.children.map(build) };
    }
    const c = t as ContainerTemplate;
    const items: PanelKey[] = [];
    for (const ref of c.items ?? []) {
      const viewId = typeof ref === "string" ? ref : ref.view;
      const params = typeof ref === "string" ? {} : (ref.params ?? {});
      const info = lookup(viewId);
      if (!info) continue;
      const key = panelKey(viewId, params, info.instanceKey);
      if (panels[key]) continue;
      panels[key] = { key, viewId, kind: info.kind, params };
      items.push(key);
    }
    const node = mkContainer(c.presenter, [...c.accepts], items, c.primary === true);
    // Accordion sections the app starts closed (a log you look at only when something is wrong).
    if (node.expanded && c.collapsed?.length) {
      node.expanded = node.expanded.filter(key => !c.collapsed!.includes(panels[key]?.viewId ?? ""));
    }
    return node;
  };
  const state = emptyState(ctx.app, build(template));
  if ((ctx.layoutVersion ?? 1) !== 1) state.appVersion = ctx.layoutVersion!;
  state.panels = panels;
  return normalize(state, ctx);
}

/* ---------- mutation helpers (operate on a draft) ---------- */

function removeItem(container: ContainerNode, key: PanelKey) {
  const i = container.items.indexOf(key);
  if (i < 0) return;
  container.items.splice(i, 1);
  if (container.expanded) container.expanded = container.expanded.filter(k => k !== key);
  if (container.lastActive === key) container.lastActive = container.items[Math.min(i, container.items.length - 1)] ?? null;
}

/** Landing items in `container` other than `shown`: they have done their job once something else is shown there. */
function landingsBeside(state: LayoutState, container: ContainerNode, shown: PanelKey, ctx: ModelContext): PanelKey[] {
  const shownPanel = state.panels[shown];
  if (!ctx.isLanding || !shownPanel || ctx.isLanding(shownPanel.viewId)) return [];
  return container.items.filter(k => {
    const p = state.panels[k];
    return k !== shown && !!p && ctx.isLanding!(p.viewId);
  });
}

function retireLandings(state: LayoutState, container: ContainerNode, shown: PanelKey, ctx: ModelContext) {
  for (const key of landingsBeside(state, container, shown, ctx)) {
    removeItem(container, key);
    delete state.panels[key];
  }
}

function expandItem(container: ContainerNode, key: PanelKey) {
  if (container.presenter !== "accordion") return;
  container.expanded ??= [];
  if (!container.expanded.includes(key)) container.expanded.push(key);
}

function touch(state: LayoutState, container: ContainerNode, kind: ViewKind | undefined) {
  state.focus = container.id;
  if (kind) state.lastByKind[kind] = container.id;
}

function splitBeside(state: LayoutState, target: LayoutNode, edge: Edge, node: LayoutNode, frac: number) {
  const dir = edge === "left" || edge === "right" ? "row" : "column";
  const before = edge === "left" || edge === "top";
  const parent = findParent(state.root, target);
  if (parent && parent.dir === dir) {
    const i = parent.children.indexOf(target);
    const size = parent.sizes[i] ?? 0;
    parent.children.splice(before ? i : i + 1, 0, node);
    parent.sizes.splice(i, 1, ...(before ? [size * frac, size * (1 - frac)] : [size * (1 - frac), size * frac]));
    return;
  }
  const split: SplitNode = {
    kind: "split",
    id: newId("p"),
    dir,
    sizes: before ? [frac, 1 - frac] : [1 - frac, frac],
    children: before ? [node, target] : [target, node],
  };
  if (!parent) state.root = split;
  else parent.children[parent.children.indexOf(target)] = split;
}

/**
 * Puts an item into the layout. `bringForward` (moves: drag-and-drop, split)
 * also makes it the container's shown item and focuses the container; a plain
 * open does not, so opening something in the background (a chat beside a
 * run, `focus: false`) never covers what the user is looking at. Navigation
 * brings routed items forward through `activate`.
 */
function place(state: LayoutState, key: PanelKey, target: Placement | undefined, ctx: ModelContext, bringForward = false): boolean {
  const panel = state.panels[key];
  if (!panel) return false;
  const settle = (c: ContainerNode) => {
    if (bringForward) {
      c.lastActive = key;
      expandItem(c, key);
      touch(state, c, panel.kind);
      retireLandings(state, c, key, ctx);
    } else {
      c.lastActive ??= key;
      state.lastByKind[panel.kind] = c.id;
    }
  };
  if (target && "container" in target) {
    const c = containerById(state, target.container);
    if (!c || !canTake(state, c, key)) return false;
    const index = target.index == null ? c.items.length : Math.max(0, Math.min(target.index, c.items.length));
    c.items.splice(index, 0, key);
    settle(c);
    return true;
  }
  if (target && "beside" in target) {
    const anchor = containerById(state, target.beside);
    if (!anchor) return false;
    const fresh = mkContainer(ctx.presenterFor(panel.kind), [panel.kind], [key]);
    splitBeside(state, anchor, target.edge, fresh, target.frac ?? 0.5);
    settle(fresh);
    return true;
  }
  const existing = containerFor(state, key);
  if (existing) return place(state, key, { container: existing.id }, ctx, bringForward);
  // Nothing takes this kind yet: create a container where the app says that kind lives.
  const all = containers(state.root);
  const anchor = all.find(c => c.primary) ?? all[0];
  if (!anchor) return false;
  const edge = ctx.placement?.[panel.kind] ?? "right";
  const fresh = mkContainer(ctx.presenterFor(panel.kind), [panel.kind], [key]);
  splitBeside(state, anchor, edge, fresh, edge === "top" || edge === "bottom" ? 0.32 : 0.42);
  settle(fresh);
  return true;
}

/* ---------- normalization + validation ---------- */

export function normalize(state: LayoutState, ctx: ModelContext): LayoutState {
  const norm = (node: LayoutNode): LayoutNode | null => {
    if (node.kind === "container") return node.items.length || node.primary ? node : null;
    const children: LayoutNode[] = [];
    const sizes: number[] = [];
    node.children.forEach((child, i) => {
      const n = norm(child);
      if (!n) return;
      const weight = node.sizes[i] ?? 0;
      if (n.kind === "split" && n.dir === node.dir) {
        n.children.forEach((grandchild, j) => {
          children.push(grandchild);
          sizes.push(weight * (n.sizes[j] ?? 0));
        });
      } else {
        children.push(n);
        sizes.push(weight);
      }
    });
    if (!children.length) return null;
    if (children.length === 1) return children[0] ?? null;
    const total = sizes.reduce((a, b) => a + b, 0) || 1;
    node.children = children;
    node.sizes = sizes.map(s => (total > 0 ? s / total : 1 / sizes.length));
    return node;
  };
  state.root = norm(state.root) ?? mkContainer(ctx.presenterFor(ctx.primaryKind), [ctx.primaryKind], [], true);

  const live = new Set<PanelKey>();
  for (const c of containers(state.root)) {
    // A key may only live once; drop later duplicates.
    c.items = c.items.filter(k => {
      if (live.has(k) || !state.panels[k]) return false;
      live.add(k);
      return true;
    });
    if (!c.lastActive || !c.items.includes(c.lastActive)) c.lastActive = c.items[0] ?? null;
    if (c.expanded) c.expanded = c.expanded.filter(k => c.items.includes(k));
  }
  for (const key of Object.keys(state.panels)) if (!live.has(key)) delete state.panels[key];
  if (state.maximized && !containerById(state, state.maximized)) state.maximized = null;
  if (state.focus && !containerById(state, state.focus)) state.focus = null;
  for (const [kind, id] of Object.entries(state.lastByKind)) if (!containerById(state, id)) delete state.lastByKind[kind];
  return state;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Validates persisted JSON against the model and the current view registry.
 * Returns a normalized state, or null when the record is unusable (the caller
 * then falls back to the app template). Unknown views are dropped rather than
 * failing the whole layout.
 */
export function validate(raw: unknown, ctx: ModelContext, lookup: ViewLookup): LayoutState | null {
  if (!isRecord(raw) || raw.version !== LAYOUT_SCHEMA_VERSION || raw.app !== ctx.app || !isRecord(raw.panels)) return null;
  // Arranged around an older default layout of the app: start from the new default instead.
  if (ctx.layoutVersion !== undefined && (typeof raw.appVersion === "number" ? raw.appVersion : 1) !== ctx.layoutVersion) return null;
  const panels: Record<PanelKey, PanelState> = {};
  for (const [key, value] of Object.entries(raw.panels)) {
    if (!isRecord(value) || typeof value.viewId !== "string" || !isRecord(value.params)) continue;
    const info = lookup(value.viewId);
    if (!info) continue;
    const params: Record<string, string> = {};
    for (const [k, v] of Object.entries(value.params)) if (typeof v === "string") params[k] = v;
    if (panelKey(value.viewId, params, info.instanceKey) !== key) continue;
    const panel: PanelState = { key, viewId: value.viewId, kind: info.kind, params };
    if (value.preview === true) panel.preview = true;
    if (typeof value.title === "string") panel.title = value.title;
    if (isRecord(value.badge) && typeof value.badge.tone === "string") panel.badge = value.badge as unknown as PanelBadge;
    if (isRecord(value.lastParams)) {
      const last: Record<string, string> = {};
      for (const [k, v] of Object.entries(value.lastParams)) if (typeof v === "string") last[k] = v;
      panel.lastParams = last;
    }
    panels[key] = panel;
  }
  const readNode = (node: unknown): LayoutNode | null => {
    if (!isRecord(node) || typeof node.id !== "string") return null;
    if (node.kind === "split") {
      if ((node.dir !== "row" && node.dir !== "column") || !Array.isArray(node.children) || !Array.isArray(node.sizes)) return null;
      const children = node.children.map(readNode);
      if (children.some(c => !c) || node.sizes.length !== children.length || node.sizes.some(s => typeof s !== "number" || !(s >= 0))) return null;
      return { kind: "split", id: node.id, dir: node.dir, sizes: [...(node.sizes as number[])], children: children as LayoutNode[] };
    }
    if (node.kind === "container") {
      if (typeof node.presenter !== "string" || !PRESENTER_IDS.has(node.presenter) || !Array.isArray(node.accepts) || !Array.isArray(node.items)) return null;
      const accepts = node.accepts.filter((a): a is string => typeof a === "string");
      if (!accepts.length) return null;
      const c: ContainerNode = {
        kind: "container",
        id: node.id,
        presenter: node.presenter as PresenterId,
        accepts,
        items: node.items.filter((k): k is string => typeof k === "string"),
        lastActive: typeof node.lastActive === "string" ? node.lastActive : null,
      };
      if (node.primary === true) c.primary = true;
      if (Array.isArray(node.expanded)) c.expanded = node.expanded.filter((k): k is string => typeof k === "string");
      else if (c.presenter === "accordion") c.expanded = [...c.items];
      // Drop items this container no longer accepts (a view changed kind) and overflow from singles.
      c.items = c.items.filter(k => {
        const p = panels[k];
        return !!p && acceptsKind(c, p.kind);
      });
      if (SINGLE_ITEM.has(c.presenter)) c.items = c.items.slice(0, 1);
      return c;
    }
    return null;
  };
  const root = readNode(raw.root);
  if (!root) return null;
  const state = emptyState(ctx.app, root);
  if (typeof raw.appVersion === "number" && raw.appVersion !== 1) state.appVersion = raw.appVersion;
  state.panels = panels;
  if (typeof raw.maximized === "string") state.maximized = raw.maximized;
  if (typeof raw.focus === "string") state.focus = raw.focus;
  if (isRecord(raw.lastByKind)) for (const [k, v] of Object.entries(raw.lastByKind)) if (typeof v === "string") state.lastByKind[k] = v;
  return normalize(state, ctx);
}

/* ---------- reducer ---------- */

export function reduce(prev: LayoutState, action: LayoutAction, ctx: ModelContext): LayoutState {
  const state = structuredClone(prev);
  switch (action.type) {
    case "open": {
      const { panel } = action;
      const existing = state.panels[panel.key];
      if (existing) {
        // Re-opening a preview item without preview keeps it.
        if (action.preview || !existing.preview) return prev;
        delete existing.preview;
        break;
      }
      state.panels[panel.key] = { ...panel };
      const added = state.panels[panel.key]!;
      if (action.preview) added.preview = true;
      else delete added.preview;
      if (action.preview && !action.target) {
        // Replace the previous preview of the same view in place.
        const host = containerFor(state, panel.key);
        const old = host?.items.find(k => {
          const p = state.panels[k];
          return k !== panel.key && !!p?.preview && p.viewId === panel.viewId;
        });
        if (host && old) {
          host.items[host.items.indexOf(old)] = panel.key;
          delete state.panels[old];
          if (host.expanded) host.expanded = host.expanded.map(k => (k === old ? panel.key : k));
          host.lastActive = panel.key;
          touch(state, host, panel.kind);
          break;
        }
      }
      if (!place(state, panel.key, action.target, ctx)) {
        if (!action.target || !place(state, panel.key, undefined, ctx)) return prev;
      }
      break;
    }
    case "close": {
      const host = containerOf(state, action.key);
      if (!host) return prev;
      removeItem(host, action.key);
      delete state.panels[action.key];
      break;
    }
    case "move": {
      const src = containerOf(state, action.key);
      const panel = state.panels[action.key];
      if (!src || !panel) return prev;
      const t = action.target;
      if ("beside" in t && t.beside === src.id && src.items.length === 1) return prev;
      if ("container" in t && t.container === src.id) {
        const from = src.items.indexOf(action.key);
        let to = t.index ?? src.items.length;
        if (to > from) to -= 1;
        if (to === from) return prev;
        src.items.splice(from, 1);
        src.items.splice(to, 0, action.key);
        src.lastActive = action.key;
        touch(state, src, panel.kind);
        retireLandings(state, src, action.key, ctx);
        break;
      }
      if ("container" in t) {
        const dest = containerById(state, t.container);
        if (!dest || !canTake(state, dest, action.key)) return prev;
      }
      removeItem(src, action.key);
      if (!place(state, action.key, t, ctx, true)) return prev;
      delete panel.preview;
      break;
    }
    case "resize": {
      const split = findSplit(state.root, action.split);
      if (!split || action.sizes.length !== split.children.length || action.sizes.some(s => !(s >= 0))) return prev;
      const total = action.sizes.reduce((a, b) => a + b, 0);
      if (!(total > 0)) return prev;
      split.sizes = action.sizes.map(s => s / total);
      break;
    }
    case "activate": {
      const host = containerOf(state, action.key);
      const panel = state.panels[action.key];
      if (!host || !panel) return prev;
      const expanded = host.presenter !== "accordion" || (host.expanded?.includes(action.key) ?? false);
      const settled = host.lastActive === action.key && state.focus === host.id && state.lastByKind[panel.kind] === host.id && expanded;
      if (settled && landingsBeside(state, host, action.key, ctx).length === 0) return prev;
      host.lastActive = action.key;
      expandItem(host, action.key);
      touch(state, host, panel.kind);
      retireLandings(state, host, action.key, ctx);
      break;
    }
    case "focus": {
      const host = containerById(state, action.container);
      if (!host || state.focus === host.id) return prev;
      state.focus = host.id;
      for (const kind of host.accepts) if (kind !== ANY_KIND) state.lastByKind[kind] = host.id;
      break;
    }
    case "toggle": {
      const host = containerOf(state, action.key);
      if (host?.presenter !== "accordion") return prev;
      host.expanded ??= [];
      if (host.expanded.includes(action.key)) host.expanded = host.expanded.filter(k => k !== action.key);
      else {
        host.expanded.push(action.key);
        host.lastActive = action.key;
      }
      break;
    }
    case "present": {
      const host = containerById(state, action.container);
      if (!host || host.presenter === action.presenter || !PRESENTER_IDS.has(action.presenter)) return prev;
      if (SINGLE_ITEM.has(action.presenter) && host.items.length > 1) return prev;
      host.presenter = action.presenter;
      if (action.presenter === "accordion") host.expanded = [...host.items];
      else delete host.expanded;
      break;
    }
    case "accepts": {
      const host = containerById(state, action.container);
      if (!host || !action.accepts.length) return prev;
      const probe: ContainerNode = { ...host, accepts: action.accepts };
      if (!host.items.every(k => acceptsKind(probe, state.panels[k]?.kind ?? ""))) return prev;
      host.accepts = [...action.accepts];
      break;
    }
    case "pin": {
      const panel = state.panels[action.key];
      if (!panel?.preview) return prev;
      delete panel.preview;
      break;
    }
    case "patch": {
      const panel = state.panels[action.key];
      if (!panel) return prev;
      let changed = false;
      if (action.title !== undefined && (panel.title ?? null) !== action.title) {
        if (action.title === null) delete panel.title;
        else panel.title = action.title;
        changed = true;
      }
      if (action.badge !== undefined && JSON.stringify(panel.badge ?? null) !== JSON.stringify(action.badge)) {
        if (action.badge === null) delete panel.badge;
        else panel.badge = { ...action.badge };
        changed = true;
      }
      if (action.lastParams !== undefined && JSON.stringify(panel.lastParams ?? null) !== JSON.stringify(action.lastParams)) {
        if (action.lastParams === null) delete panel.lastParams;
        else panel.lastParams = { ...action.lastParams };
        changed = true;
      }
      if (!changed) return prev;
      return state; // no structural change, skip normalize
    }
    case "maximize": {
      const next = action.container && state.maximized !== action.container ? action.container : null;
      if (next === state.maximized) return prev;
      if (next && !containerById(state, next)) return prev;
      state.maximized = next;
      break;
    }
  }
  return normalize(state, ctx);
}
