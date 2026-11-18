/**
 * URL ⇄ (app, view, params). Built from app manifests and view routes, and
 * matched with react-router's own ranking, so static segments beat dynamic
 * ones (`/agents/new` before `/agents/:agentType`) and optional and splat
 * segments work. React-free.
 */
import { generatePath, matchRoutes, type RouteObject } from "react-router-dom";
import { panelKey, type ViewLookup } from "./model.ts";
import type { AppManifest, PanelKey, ViewManifest, ViewParams } from "./types.ts";

export interface ResolvedRoute {
  app: string;
  /** null at an app root that no view claims. */
  viewId: string | null;
  params: ViewParams;
  key: PanelKey | null;
  pathname: string;
}

interface Entry {
  app: string;
  viewId: string | null;
  pattern: string;
  canonical: boolean;
}

export interface RouteTable {
  resolve(pathname: string): ResolvedRoute | null;
  /** Canonical URL for a view in an app, or null when the view has no route there. */
  urlFor(app: string, viewId: string, params: ViewParams): string | null;
  appPath(app: string): string | null;
  /** Every absolute pattern, for serving SPA routes and tests. */
  patterns(): string[];
}

function join(base: string, route: string): string {
  if (!route) return base || "/";
  const b = base.endsWith("/") ? base.slice(0, -1) : base;
  return `${b}/${route.replace(/^\//, "")}`;
}

export function createRouteTable(apps: readonly AppManifest[], views: (viewId: string) => ViewManifest | undefined, lookup: ViewLookup): RouteTable {
  const entries: Entry[] = [];
  const appPaths = new Map<string, string>();
  for (const app of apps) {
    appPaths.set(app.id, app.path);
    for (const alias of app.aliases ?? []) entries.push({ app: app.id, viewId: alias.view, pattern: alias.path, canonical: true });
    let rootClaimed = false;
    for (const viewId of app.views) {
      const view = views(viewId);
      if (!view || view.route === undefined) continue;
      // A route made only of optional segments (`:provider?`) matches the app root too.
      if (view.route.split("/").every(segment => segment === "" || segment.endsWith("?"))) rootClaimed = true;
      const aliased = app.aliases?.some(a => a.view === viewId) ?? false;
      entries.push({ app: app.id, viewId, pattern: join(app.path, view.route), canonical: !aliased });
    }
    if (!rootClaimed) entries.push({ app: app.id, viewId: null, pattern: app.path, canonical: true });
  }

  const routes: RouteObject[] = entries.map((entry, index) => ({ path: entry.pattern, id: String(index) }));

  return {
    resolve(pathname) {
      const matches = matchRoutes(routes, pathname);
      const match = matches?.[matches.length - 1];
      if (!match) return null;
      const entry = entries[Number(match.route.id)];
      if (!entry) return null;
      const params: Record<string, string> = {};
      for (const [k, v] of Object.entries(match.params)) if (typeof v === "string" && v !== "") params[k] = v;
      if (!entry.viewId) return { app: entry.app, viewId: null, params: {}, key: null, pathname };
      const info = lookup(entry.viewId);
      if (!info) return null;
      return { app: entry.app, viewId: entry.viewId, params, key: panelKey(entry.viewId, params, info.instanceKey), pathname };
    },
    urlFor(app, viewId, params) {
      const candidates = entries.filter(e => e.app === app && e.viewId === viewId);
      const entry = candidates.find(e => e.canonical) ?? candidates[0];
      if (!entry) return null;
      try {
        return generatePath(entry.pattern, params as Record<string, string>);
      } catch {
        return null; // a required param is missing
      }
    },
    appPath(app) {
      return appPaths.get(app) ?? null;
    },
    patterns() {
      return entries.map(e => e.pattern);
    },
  };
}
