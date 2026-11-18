import { describe, expect, it } from "bun:test";
import { agentSessionTitle } from "../hooks/agentSessionMetaStore.ts";
import { agentCountSummary, agentStatusLine, filterAgentsByType, nestSubAgents, type RunningAgent, sortRunningAgents } from "./agentSessions.ts";

function agent(overrides: Partial<RunningAgent> & { id: string }): RunningAgent {
  return {
    createdAt: 0,
    agentType: "memory",
    displayName: overrides.id,
    description: "",
    idle: true,
    currentActivity: "",
    ...overrides,
  };
}

describe("sortRunningAgents", () => {
  it("puts active agents before idle ones", () => {
    const sorted = sortRunningAgents([agent({ id: "idle", idle: true, createdAt: 100 }), agent({ id: "busy", idle: false, createdAt: 1 })]);

    expect(sorted.map(a => a.id)).toEqual(["busy", "idle"]);
  });

  it("puts agents waiting on a question first, even idle ones", () => {
    const sorted = sortRunningAgents([
      agent({ id: "busy", idle: false, createdAt: 3 }),
      agent({ id: "asking", idle: true, createdAt: 1, pendingQuestions: 1 }),
      agent({ id: "idle", idle: true, createdAt: 2 }),
    ]);

    expect(sorted.map(a => a.id)).toEqual(["asking", "busy", "idle"]);
  });

  it("orders agents of the same activity newest first", () => {
    const sorted = sortRunningAgents([agent({ id: "old", createdAt: 1 }), agent({ id: "new", createdAt: 3 }), agent({ id: "middle", createdAt: 2 })]);

    expect(sorted.map(a => a.id)).toEqual(["new", "middle", "old"]);
  });

  it("does not mutate the input", () => {
    const agents = [agent({ id: "idle", idle: true, createdAt: 100 }), agent({ id: "busy", idle: false, createdAt: 1 })];

    sortRunningAgents(agents);

    expect(agents.map(a => a.id)).toEqual(["idle", "busy"]);
  });
});

describe("filterAgentsByType", () => {
  it("keeps only agents whose type the app works with", () => {
    const agents = [agent({ id: "a", agentType: "memory" }), agent({ id: "b", agentType: "code" }), agent({ id: "c", agentType: "memory-curator" })];

    expect(filterAgentsByType(agents, ["memory", "memory-curator"]).map(a => a.id)).toEqual(["a", "c"]);
  });

  it("returns nothing when no type matches", () => {
    expect(filterAgentsByType([agent({ id: "a", agentType: "memory" })], ["research"])).toEqual([]);
  });
});

describe("agent status vocabulary", () => {
  it("counts needs you, working and idle, leaving out zeros", () => {
    expect(agentCountSummary([])).toBe("No agents");
    expect(agentCountSummary([agent({ id: "a" }), agent({ id: "b" })])).toBe("2 idle");
    expect(agentCountSummary([agent({ id: "a", idle: false }), agent({ id: "b", idle: false, pendingQuestions: 2 }), agent({ id: "c" })])).toBe(
      "1 needs you · 1 working · 1 idle",
    );
  });

  it("describes what an agent is doing, its type when the title differs, and when it started", () => {
    const now = Date.now();
    const working = agent({ id: "w", displayName: "Coding Agent", idle: false, currentActivity: "Editing files", createdAt: now - 5 * 60_000 });
    expect(agentStatusLine(working, "Coding Agent")).toBe("Editing files · started 5m ago");
    expect(agentStatusLine(working, "fix the login bug")).toBe("Editing files · Coding Agent · started 5m ago");
    // The backend's "Agent idle" activity never shows: the state word does.
    expect(agentStatusLine(agent({ id: "i", currentActivity: "Agent idle", createdAt: now }), "i")).toBe("Idle · started just now");
  });

  it("names an agent by the server's title until you name it yourself", () => {
    const a = agent({ id: "x", displayName: "Coding Agent", title: "fix the login bug" });
    expect(agentSessionTitle(a, {})).toBe("fix the login bug");
    expect(agentSessionTitle(a, { x: { title: "Login work" } })).toBe("Login work");
    expect(agentSessionTitle({ ...a, title: undefined }, {})).toBe("Coding Agent");
  });
});

describe("nestSubAgents", () => {
  it("puts each sub-agent right after its parent, keeping the given order among siblings", () => {
    const nested = nestSubAgents([
      agent({ id: "child-b", parentAgentId: "parent" }),
      agent({ id: "other" }),
      agent({ id: "grandchild", parentAgentId: "child-a" }),
      agent({ id: "parent" }),
      agent({ id: "child-a", parentAgentId: "parent" }),
      agent({ id: "orphan", parentAgentId: "gone" }),
    ]);
    expect(nested.map(({ agent, depth }) => `${agent.id}:${depth}`)).toEqual(["other:0", "parent:0", "child-b:1", "child-a:1", "grandchild:2", "orphan:0"]);
  });
});
