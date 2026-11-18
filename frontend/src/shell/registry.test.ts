import { describe, expect, it } from "bun:test";
import { CORE_APP_VIEWS, CORE_APPS } from "../apps/index.ts";
import { PLUGIN_APP_EXTENSIONS, PLUGIN_LAYOUT_APPS } from "../plugins/layoutManifests.ts";
import { PLUGIN_LAYOUT_VIEWS } from "../plugins/layoutViews.ts";
import { getLayoutRegistry } from "./registry.ts";

const registry = getLayoutRegistry();
/** Shipped apps as the registry holds them, with other plugins' extensions applied. */
const SHIPPED = [...CORE_APPS, ...PLUGIN_LAYOUT_APPS].map(app => registry.app(app.id)!);

describe("layout registry wiring", () => {
  it("has unique app and view ids", () => {
    const appIds = SHIPPED.map(app => app.id);
    expect(new Set(appIds).size).toBe(appIds.length);
    const viewIds = [...CORE_APP_VIEWS, ...PLUGIN_LAYOUT_VIEWS].map(view => view.id);
    expect(new Set(viewIds).size).toBe(viewIds.length);
  });

  it.each(SHIPPED.map(app => [app.id, app]))("%s: its path resolves to it and every listed view and kind is registered", (_id, app) => {
    expect(registry.routes.resolve(app.path)?.app).toBe(app.id);
    for (const viewId of app.views) {
      const view = registry.view(viewId);
      expect(view, `${app.id} lists unknown view "${viewId}"`).toBeDefined();
      expect(registry.kind(view!.kind), `view "${viewId}" has unregistered kind "${view!.kind}"`).toBeDefined();
    }
  });

  it("applies plugin extensions to the apps they name", () => {
    for (const extension of PLUGIN_APP_EXTENSIONS) {
      const app = registry.app(extension.app);
      expect(app, `extension targets unknown app "${extension.app}"`).toBeDefined();
      for (const view of extension.views) expect(app!.views).toContain(view);
    }
  });

  it("puts the plugin widgets in Home's widget accordion by default", () => {
    const home = registry.app("home")!;
    const items = JSON.stringify(home.layout);
    for (const view of ["metrics-cost-summary", "task-runs", "workflow-runs"]) expect(items).toContain(`"${view}"`);
  });
});
