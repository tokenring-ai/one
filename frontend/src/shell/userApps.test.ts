import { afterEach, describe, expect, it } from "bun:test";
import type { LayoutRemote } from "../layout/persistence.ts";
import { getLayoutRegistry } from "./registry.ts";
import { createUserApp, deleteUserApp, getUserApps, loadUserApps, renameUserApp, resetUserAppsForTests, slugify } from "./userApps.ts";

function fakeRemote() {
  const records = new Map<string, { layout: string; updatedAt: number; app?: { label: string; icon: string; basedOn: string } }>();
  let stamp = 0;
  const remote: LayoutRemote = {
    get: async id => records.get(id) ?? null,
    save: async (id, layout, expected, app) => {
      const previous = records.get(id);
      // The dashboard service's rule: a defined expected stamp older than the record conflicts.
      if (previous && expected !== undefined && previous.updatedAt > expected) return { status: "conflict", record: previous };
      stamp += 1;
      const keep = app ?? previous?.app;
      records.set(id, { layout, updatedAt: stamp, ...(keep ? { app: keep } : {}) });
      return { status: "ok", updatedAt: stamp };
    },
    remove: async id => {
      records.delete(id);
    },
    list: async () => [...records].map(([id, r]) => ({ id, updatedAt: r.updatedAt, ...(r.app ? { app: r.app } : {}) })),
  };
  return { remote, records };
}

describe("user apps", () => {
  afterEach(() => {
    resetUserAppsForTests([]);
    localStorage.clear();
  });

  it("slugifies names into path segments", () => {
    expect(slugify("My Agents!")).toBe("my-agents");
    expect(slugify("  ")).toBe("app");
  });

  it("saves an arrangement as a new app the registry can route to", async () => {
    const { remote, records } = fakeRemote();
    const registry = getLayoutRegistry();
    const base = registry.app("agents")!;
    const store = registry.routes.resolve("/agents");
    expect(store?.app).toBe("agents");
    const layout = {
      version: 2 as const,
      app: "agents",
      root: { kind: "container" as const, id: "c1", presenter: "tabs" as const, accepts: ["page"], items: [], lastActive: null, primary: true },
      panels: {},
      maximized: "c1",
      focus: null,
      lastByKind: {},
    };

    const path = await createUserApp("My agents", base, layout, remote);
    expect(path).toBe("/my/my-agents");
    const record = records.get("layout-my-my-agents")!;
    expect(record.app).toEqual({ label: "My agents", icon: "layout", basedOn: "agents" });
    expect(JSON.parse(record.layout)).toMatchObject({ app: "my-my-agents", maximized: null });

    const next = getLayoutRegistry();
    expect(next.routes.resolve("/my/my-agents")).toMatchObject({ app: "my-my-agents", viewId: "agents-start" });
    expect(next.app("my-my-agents")?.label).toBe("My agents");
    // A second save with the same name gets a distinct slug.
    expect(await createUserApp("My agents", base, layout, remote)).toBe("/my/my-agents-2");
  });

  it("never overwrites a saved app the client doesn't know about (the list failed to load)", async () => {
    const { remote, records } = fakeRemote();
    const theirs = { label: "Desk", icon: "layout", basedOn: "home" };
    await remote.save("layout-my-desk", '{"theirs":true}', undefined, theirs);
    resetUserAppsForTests([], false);
    await loadUserApps({ ...remote, list: () => Promise.reject(new Error("offline")) });
    expect(getUserApps()).toEqual({ loaded: true, apps: [] });

    const layout = {
      version: 2 as const,
      app: "home",
      root: { kind: "container" as const, id: "c", presenter: "tabs" as const, accepts: ["*"], items: [], lastActive: null, primary: true },
      panels: {},
      maximized: null,
      focus: null,
      lastByKind: {},
    };
    expect(await createUserApp("Desk", getLayoutRegistry().app("home")!, layout, remote)).toBe("/my/desk-2");
    expect(records.get("layout-my-desk")).toMatchObject({ layout: '{"theirs":true}', app: theirs });
    expect(JSON.parse(records.get("layout-my-desk-2")!.layout)).toMatchObject({ app: "my-desk-2" });
  });

  it("loads, renames and deletes saved apps", async () => {
    const { remote, records } = fakeRemote();
    await remote.save("layout-home", "{}", undefined);
    await remote.save("layout-my-desk", "{}", undefined, { label: "Desk", icon: "layout", basedOn: "home" });
    resetUserAppsForTests([], false);
    await loadUserApps(remote);
    expect(getUserApps().apps.map(a => a.id)).toEqual(["my-desk"]);

    const layout = {
      version: 2 as const,
      app: "my-desk",
      root: { kind: "container" as const, id: "c", presenter: "tabs" as const, accepts: ["*"], items: [], lastActive: null, primary: true },
      panels: {},
      maximized: null,
      focus: null,
      lastByKind: {},
    };
    await renameUserApp("my-desk", "Workbench", layout, remote);
    expect(records.get("layout-my-desk")?.app?.label).toBe("Workbench");
    expect(getLayoutRegistry().app("my-desk")?.label).toBe("Workbench");

    await deleteUserApp("my-desk", remote);
    expect(records.has("layout-my-desk")).toBe(false);
    expect(getLayoutRegistry().routes.resolve("/my/desk")).toBeNull();
  });
});
