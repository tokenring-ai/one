import { beforeEach, describe, expect, it } from "bun:test";
import {
  agentSessionTitle,
  clearAgentSessionMetaForTests,
  clearAgentSessionTitle,
  comparePinnedFirst,
  getAgentSessionMetaMap,
  setAgentSessionMeta,
  setAgentSessionTitle,
} from "./agentSessionMetaStore.ts";

describe("agentSessionMetaStore", () => {
  beforeEach(() => {
    clearAgentSessionMetaForTests();
  });

  it("sets, overrides and clears a manual title", () => {
    const agent = { id: "a1", displayName: "coding (abc123)" };
    expect(agentSessionTitle(agent)).toBe("coding (abc123)");

    setAgentSessionTitle(agent.id, "Fix the login bug");
    expect(agentSessionTitle(agent)).toBe("Fix the login bug");

    setAgentSessionTitle(agent.id, "  ");
    expect(agentSessionTitle(agent)).toBe("coding (abc123)");
  });

  it("falls back to the server's title, then the type name", () => {
    expect(agentSessionTitle({ id: "s1", displayName: "Coding Agent", title: "Fix the login bug" })).toBe("Fix the login bug");
    expect(agentSessionTitle({ id: "s1", displayName: "Coding Agent" })).toBe("Coding Agent");
  });

  it("drops a stored title that was a slash command (left over from the old client-side auto-title)", async () => {
    localStorage.setItem("tokenring.agentSessionMeta", JSON.stringify({ c1: { title: "/tools enable x", pinned: true }, c2: { title: "Mine" } }));
    const fresh = await import(`./agentSessionMetaStore.ts?reload=${Date.now()}`);
    expect(fresh.getAgentSessionMetaMap()).toEqual({ c1: { pinned: true }, c2: { title: "Mine" } });
  });

  it("pins and unpins sessions, ordering pinned first", () => {
    setAgentSessionMeta("p1", { pinned: true });
    // Sort-comparator semantics: negative means the first id sorts first.
    expect(comparePinnedFirst("p1", "p2")).toBe(-1);
    expect(comparePinnedFirst("p2", "p1")).toBe(1);
    expect(comparePinnedFirst("p2", "p3")).toBe(0);

    setAgentSessionMeta("p1", { pinned: false });
    expect(comparePinnedFirst("p1", "p2")).toBe(0);
  });

  it("clearing the title keeps a pin", () => {
    setAgentSessionMeta("p3", { pinned: true });
    setAgentSessionTitle("p3", "custom");
    clearAgentSessionTitle("p3");

    expect(getAgentSessionMetaMap().p3).toEqual({ pinned: true });
  });

  it("persists to localStorage and reloads on cross-tab storage events", () => {
    setAgentSessionTitle("persisted", "kept");
    expect(localStorage.getItem("tokenring.agentSessionMeta")).toContain("kept");

    // Another tab corrupting the storage propagates on the storage event.
    // (jsdom lacks the StorageEvent constructor, so patch a plain Event.)
    localStorage.setItem("tokenring.agentSessionMeta", "not-json{");
    window.dispatchEvent(Object.assign(new Event("storage"), { key: "tokenring.agentSessionMeta" }));
    expect(getAgentSessionMetaMap()).toEqual({});
  });
});
