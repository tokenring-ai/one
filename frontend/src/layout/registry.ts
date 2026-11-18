import type { ViewDefinition } from "./define.ts";
import type { ModelContext, ViewLookup } from "./model.ts";
import { createRouteTable, type RouteTable } from "./routes.ts";
import type { AppManifest, KindManifest, PresenterId, ViewKind, ViewParams } from "./types.ts";

export interface LayoutRegistry {
  apps: readonly AppManifest[];
  app(id: string): AppManifest | undefined;
  view(id: string): ViewDefinition | undefined;
  kind(id: ViewKind): KindManifest | undefined;
  lookup: ViewLookup;
  routes: RouteTable;
  modelContext(appId: string): ModelContext;
  titleOf(viewId: string, params: ViewParams, override?: string): string;
}

function dedupeBy<T>(items: readonly T[], id: (item: T) => string, what: string): T[] {
  const seen = new Set<string>();
  return items.filter(item => {
    const key = id(item);
    if (seen.has(key)) {
      console.warn(`[layout] Skipping duplicate ${what} "${key}"`);
      return false;
    }
    seen.add(key);
    return true;
  });
}

export function createLayoutRegistry(input: {
  apps: readonly AppManifest[];
  views: readonly ViewDefinition[];
  kinds: readonly KindManifest[];
}): LayoutRegistry {
  const apps = dedupeBy(input.apps, a => a.id, "app");
  const views = new Map(dedupeBy(input.views, v => v.id, "view").map(v => [v.id, v]));
  const kinds = new Map(dedupeBy(input.kinds, k => k.id, "kind").map(k => [k.id, k]));
  const appById = new Map(apps.map(a => [a.id, a]));
  const lookup: ViewLookup = id => {
    const v = views.get(id);
    return v ? { kind: v.kind, instanceKey: v.instanceKey } : undefined;
  };
  const presenterFor = (kind: ViewKind): PresenterId => kinds.get(kind)?.presenter ?? "tabs";
  const isLanding = (viewId: string) => views.get(viewId)?.landing === true;
  return {
    apps,
    app: id => appById.get(id),
    view: id => views.get(id),
    kind: id => kinds.get(id),
    lookup,
    routes: createRouteTable(apps, id => views.get(id), lookup),
    modelContext(appId) {
      const app = appById.get(appId);
      return { app: appId, primaryKind: app?.primaryKind ?? "page", placement: app?.placement, presenterFor, isLanding, layoutVersion: app?.layoutVersion };
    },
    titleOf(viewId, params, override) {
      if (override) return override;
      const v = views.get(viewId);
      if (!v) return viewId;
      return typeof v.title === "function" ? v.title(params) : v.title;
    },
  };
}
