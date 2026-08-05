import { describe, expect, it } from "bun:test";
import { APP_GROUPS, APP_REGISTRY, DEFAULT_PINNED_APP_IDS, getActiveApp } from "./AppRegistry.ts";

describe("AppRegistry", () => {
  it("contains one unique definition for all 26 applications", () => {
    expect(APP_REGISTRY).toHaveLength(26);
    expect(new Set(APP_REGISTRY.map(app => app.id)).size).toBe(26);
    expect(new Set(APP_REGISTRY.map(app => app.path)).size).toBe(26);
    expect(new Set(APP_REGISTRY.map(app => app.group))).toEqual(new Set(APP_GROUPS));
  });

  it("keeps the default rail within the seven-app budget", () => {
    expect(DEFAULT_PINNED_APP_IDS.length).toBeGreaterThan(0);
    expect(DEFAULT_PINNED_APP_IDS.length).toBeLessThanOrEqual(7);
    expect(DEFAULT_PINNED_APP_IDS.every(id => APP_REGISTRY.some(app => app.id === id))).toBe(true);
  });

  it("resolves active apps for roots, resources, and agent chats", () => {
    expect(getActiveApp("/research/topic/item")?.id).toBe("research");
    expect(getActiveApp("/agent/abc/chat")?.id).toBe("agents");
    expect(getActiveApp("/")).toBeUndefined();
  });
});
