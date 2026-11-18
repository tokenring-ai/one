import { describe, expect, it } from "bun:test";
import { DEFAULT_PINNED_DASHBOARD_IDS, VISIBLE_DASHBOARD_MANIFESTS } from "./appCatalog.ts";

describe("first-run rail", () => {
  it("starts small: Agents, Documents, Email, Calendar and Files", () => {
    expect([...DEFAULT_PINNED_DASHBOARD_IDS].sort()).toEqual(["agents", "calendar", "documents", "email", "files"]);
  });

  it("leaves the technical apps to the switcher but keeps them reachable", () => {
    for (const id of ["terminal", "workflows", "research", "debug", "services"]) {
      expect(DEFAULT_PINNED_DASHBOARD_IDS).not.toContain(id);
    }
    const reachable = VISIBLE_DASHBOARD_MANIFESTS.map(app => app.id);
    for (const id of ["terminal", "workflows", "research", "vault"]) expect(reachable).toContain(id);
  });
});
