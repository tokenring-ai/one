import { describe, expect, it } from "bun:test";
import { filterAgentsByType, type RunningAgent, sortRunningAgents } from "./agentSessions.ts";

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
