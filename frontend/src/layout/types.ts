/**
 * Core vocabulary of the layout system. React-free: app and view manifests are
 * imported by the server (to serve SPA routes) as well as by the client.
 *
 * - A **view** is plugin content with a `kind` ("agent", "terminal", "widget", ...).
 *   Only views are routable; the URL focuses exactly one view instance.
 * - A **container** shows items through a **presenter** (tabs, single, accordion,
 *   carousel) and only takes the view kinds it `accepts`.
 * - A **split** arranges containers in rows and columns.
 * - An **app** is a named, customizable layout of containers.
 */
import type { LucideIcon } from "lucide-react";

export type ViewKind = string;
export type PresenterId = "tabs" | "single" | "accordion" | "carousel";
export type Edge = "left" | "right" | "top" | "bottom";
export type SplitDir = "row" | "column";

/** Every param is a string so it round-trips through the URL unchanged. */
export type ViewParams = Readonly<Record<string, string>>;

/** `viewId:instanceKey`, immutable for the panel's lifetime. */
export type PanelKey = string;

export interface ViewManifest {
  /** Stable, kebab-case, globally unique. Persisted layouts reference it. */
  id: string;
  kind: ViewKind;
  /** Static title, or one derived from params (an agent id, a file name). */
  title: string | ((params: ViewParams) => string);
  description?: string;
  icon: LucideIcon;
  /**
   * Route relative to the app's path, react-router syntax: `agent/:agentId`,
   * `marketplace/:category?/:name?`, or `""` for the app root. Omit for views
   * that never own the URL (navigators, widgets).
   */
  route?: string;
  /** Instance identity derived from params. Default: the param values joined, or `_`. */
  instanceKey?: (params: ViewParams) => string;
  /** Thumbnail URL for presenters that show one (carousel). */
  thumbnail?: (params: ViewParams) => string | undefined;
  /** `false` hides the close affordance. Default `true`. */
  closable?: boolean;
  /** Tooltip for the close button, when closing does less than it seems ("the agent keeps running"). */
  closeHint?: string;
  /**
   * A "pick something" placeholder (usually the app root, route `""`). It
   * closes itself as soon as another item is shown in its container, and
   * comes back when the URL returns to its route.
   */
  landing?: boolean;
}

export interface KindManifest {
  id: ViewKind;
  label: string;
  /** Plural noun used in messages: "Only agent chats here". */
  plural: string;
  /** Presenter for containers created on demand for this kind. Default `tabs`. */
  presenter?: PresenterId;
}

export interface ViewRef {
  view: string;
  params?: ViewParams;
}

export interface ContainerTemplate {
  presenter: PresenterId;
  /** View kinds this container takes, or `["*"]` for any. */
  accepts: readonly ViewKind[];
  items?: readonly (string | ViewRef)[];
  /** The app's main container: kept when empty, anchor for new containers. */
  primary?: boolean;
  /** Accordion only: views whose sections start closed (all others start open). */
  collapsed?: readonly string[];
}

export interface SplitTemplate {
  split: SplitDir;
  /** Relative sizes, one per child. Default: equal. */
  sizes?: readonly number[];
  children: readonly LayoutTemplate[];
}

export type LayoutTemplate = ContainerTemplate | SplitTemplate;

export type AppGroup = "Build" | "Operate" | "Data & tools" | "System";

export interface AppAlias {
  /** Absolute path, e.g. `/agent/:agentId`. Canonical URL for the view in this app. */
  path: string;
  view: string;
}

/** A user-saved app: an arrangement saved under its own name, based on a shipped app. */
export interface UserAppMeta {
  label: string;
  /** Lucide icon name (informational; the rail shows the base app's icon). */
  icon: string;
  /** Id of the shipped app whose views this arrangement uses. */
  basedOn: string;
  group?: string | undefined;
}

export interface AppManifest {
  /** Kebab-case, unique. */
  id: string;
  /** Base path, e.g. `/agents`. Views' routes are nested under it. */
  path: string;
  label: string;
  description: string;
  icon: LucideIcon;
  group: AppGroup;
  /** Views this app can show (and route to). */
  views: readonly string[];
  /** Kind of the primary container, used when the layout collapses to nothing. */
  primaryKind: ViewKind;
  /** Where a container for a kind is created when the app has none (relative to the primary container). */
  placement?: Readonly<Partial<Record<ViewKind, Edge>>>;
  aliases?: readonly AppAlias[];
  layout: LayoutTemplate;
  /**
   * Bump when the default `layout` changes enough that saved arrangements of
   * the old one would hide it (views moved between containers, say). Saved
   * layouts from another version are discarded for the new default. Default 1.
   */
  layoutVersion?: number;
  hidden?: boolean;
  /** Set on user-saved apps: the shipped app they were saved from. */
  basedOn?: string;
  /** Rail and switcher presentation (default: derived from the label, accent colours). */
  shortLabel?: string;
  iconClass?: string;
  gradient?: string;
  /**
   * Pinned to the rail on first run. The starting set is deliberately small (Agents, Documents, Email,
   * Calendar, Files): everything else is one click away in the switcher. A saved pin list always wins.
   */
  defaultPinned?: boolean;
}

export type BadgeTone = "info" | "success" | "warning" | "danger" | "dirty";
export interface PanelBadge {
  tone: BadgeTone;
  label?: string;
  /** Shown as a number on the tab (how many running agents) instead of a dot. */
  count?: number;
}

/* ---------- serialized layout state ---------- */

export interface PanelState {
  key: PanelKey;
  viewId: string;
  kind: ViewKind;
  params: ViewParams;
  /** Preview items are replaced by the next preview open in the same container. */
  preview?: boolean;
  title?: string;
  badge?: PanelBadge;
  /**
   * The URL params the panel last showed while focused, when they differ from
   * `params` (a single-instance view following the URL). Selecting the tab
   * returns there.
   */
  lastParams?: ViewParams;
}

export interface ContainerNode {
  kind: "container";
  id: string;
  presenter: PresenterId;
  accepts: ViewKind[];
  primary?: boolean;
  items: PanelKey[];
  lastActive: PanelKey | null;
  /** Accordion only: open sections. */
  expanded?: PanelKey[];
}

export interface SplitNode {
  kind: "split";
  id: string;
  dir: SplitDir;
  /** Fractions summing to 1, one per child. */
  sizes: number[];
  children: LayoutNode[];
}

export type LayoutNode = ContainerNode | SplitNode;

export const LAYOUT_SCHEMA_VERSION = 2;

export interface LayoutState {
  version: typeof LAYOUT_SCHEMA_VERSION;
  app: string;
  root: LayoutNode;
  panels: Record<PanelKey, PanelState>;
  maximized: string | null;
  /** Container that last took user interaction. */
  focus: string | null;
  /** Kind → container that last received an item of that kind. */
  lastByKind: Record<ViewKind, string>;
  /** The app's `layoutVersion` this layout was made from (absent for version 1). */
  appVersion?: number;
}
