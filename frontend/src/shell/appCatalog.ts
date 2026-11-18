/**
 * React-free catalog of shipped apps for the rail, the app switcher, pinning
 * and page labelling, derived from the layout app manifests (core + plugins).
 * The server imports `frontend/plugin.ts`, which only needs the paths; keep
 * this module free of component imports.
 */
import type { LucideIcon } from "lucide-react";
import { CORE_APPS } from "../apps/manifests.ts";
import type { AppGroup, AppManifest } from "../layout/types.ts";
import { PLUGIN_LAYOUT_APPS } from "../plugins/layoutManifests.ts";

export type DashboardGroup = AppGroup;

/** One app as the rail and switcher see it. */
export interface DashboardManifest {
  id: string;
  path: string;
  label: string;
  shortLabel: string;
  description: string;
  group: AppGroup;
  icon: LucideIcon;
  iconClass: string;
  gradient: string;
  defaultPinned?: boolean;
  hidden?: boolean;
}

function toEntry(app: AppManifest): DashboardManifest {
  return {
    id: app.id,
    path: app.path,
    label: app.label,
    shortLabel: app.shortLabel ?? app.label.slice(0, 2).toUpperCase(),
    description: app.description,
    group: app.group,
    icon: app.icon,
    iconClass: app.iconClass ?? "text-accent",
    gradient: app.gradient ?? "from-indigo-500 to-violet-600",
    ...(app.defaultPinned ? { defaultPinned: true } : {}),
    ...(app.hidden ? { hidden: true } : {}),
  };
}

const SHIPPED: readonly AppManifest[] = [...CORE_APPS, ...PLUGIN_LAYOUT_APPS];

/** Every shipped app: core first, then plugins. */
export const DASHBOARD_MANIFESTS: readonly DashboardManifest[] = SHIPPED.map(toEntry);

/** Apps offered in the rail, switcher and launcher. */
export const VISIBLE_DASHBOARD_MANIFESTS: readonly DashboardManifest[] = DASHBOARD_MANIFESTS.filter(app => !app.hidden);

export const DASHBOARD_GROUPS: readonly DashboardGroup[] = ["Build", "Operate", "Data & tools", "System"];

export const DEFAULT_PINNED_DASHBOARD_IDS: readonly string[] = VISIBLE_DASHBOARD_MANIFESTS.filter(app => app.defaultPinned).map(app => app.id);

const BY_ID = new Map(DASHBOARD_MANIFESTS.map(app => [app.id, app]));

export function getDashboardManifestById(id: string | null | undefined): DashboardManifest | undefined {
  return id ? BY_ID.get(id) : undefined;
}

/** Path prefixes owned by each app: its path plus its alias prefixes (`/agent` for Agents). */
const PREFIXES: readonly [string, string][] = SHIPPED.flatMap(app => [
  [app.path, app.id] as [string, string],
  ...(app.aliases ?? []).map(alias => [`/${alias.path.split("/")[1] ?? ""}`, app.id] as [string, string]),
]).sort((a, b) => b[0].length - a[0].length);

/** The app a pathname belongs to; `/` is Home. */
export function getActiveDashboardManifest(pathname: string): DashboardManifest | undefined {
  if (pathname === "/") return BY_ID.get("home");
  const hit = PREFIXES.find(([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  return hit ? BY_ID.get(hit[1]) : undefined;
}
