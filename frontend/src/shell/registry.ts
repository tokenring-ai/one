import { useSyncExternalStore } from "react";
import { CORE_APP_KINDS, CORE_APP_VIEWS, CORE_APPS } from "../apps/index.ts";
import { extendApp } from "../layout/extend.ts";
import { createLayoutRegistry, type LayoutRegistry } from "../layout/registry.ts";
import type { AppManifest } from "../layout/types.ts";
import { PLUGIN_APP_EXTENSIONS, PLUGIN_LAYOUT_APPS, PLUGIN_LAYOUT_KINDS } from "../plugins/layoutManifests.ts";
import { PLUGIN_LAYOUT_VIEWS } from "../plugins/layoutViews.ts";
import { getUserApps, subscribeUserApps, type UserApp, userAppManifest } from "./userApps.ts";

/** Every shipped app on the layout engine: core first, then plugin apps, each with the views other plugins add to it. */
const SHIPPED_APPS = [...CORE_APPS, ...PLUGIN_LAYOUT_APPS].map(app => extendApp(app, PLUGIN_APP_EXTENSIONS));

/** Ids of shipped (non user-saved) apps. */
export const LAYOUT_APP_IDS: ReadonlySet<string> = new Set(SHIPPED_APPS.map(app => app.id));

function build(userApps: readonly UserApp[]): LayoutRegistry {
  const byId = new Map(SHIPPED_APPS.map(app => [app.id, app]));
  const saved: AppManifest[] = userApps.flatMap(app => {
    const base = byId.get(app.meta.basedOn);
    return base ? [userAppManifest(app, base)] : [];
  });
  return createLayoutRegistry({
    apps: [...SHIPPED_APPS, ...saved],
    views: [...CORE_APP_VIEWS, ...PLUGIN_LAYOUT_VIEWS],
    kinds: [...CORE_APP_KINDS, ...PLUGIN_LAYOUT_KINDS],
  });
}

let builtFrom: readonly UserApp[] | null = null;
let registry: LayoutRegistry = build([]);

/** Every app (shipped and user-saved), view and kind on the layout engine. */
export function getLayoutRegistry(): LayoutRegistry {
  const { apps } = getUserApps();
  if (apps !== builtFrom) {
    builtFrom = apps;
    registry = build(apps);
  }
  return registry;
}

export function useLayoutRegistry(): LayoutRegistry {
  return useSyncExternalStore(subscribeUserApps, getLayoutRegistry, getLayoutRegistry);
}
