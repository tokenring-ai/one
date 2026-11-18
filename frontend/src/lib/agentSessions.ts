import { formatTimeAgo } from "@tokenring-ai/utility/date/formatTimeAgo";

/**
 * Shared shape and ordering for the live agent list (`useAgentList` / `streamAgents`),
 * so every surface that lists running agents sorts and filters them the same way.
 */
export interface RunningAgent {
  id: string;
  createdAt: number;
  agentType: string;
  displayName: string;
  description: string;
  idle: boolean;
  currentActivity: string;
  /** Questions the agent is blocked on until a person answers them (absent from older servers). */
  pendingQuestions?: number;
  /** Its first prompt to the model, shortened: the default name that tells same-type agents apart. */
  title?: string;
  /** Set on sub-agents: the agent that started this one. */
  parentAgentId?: string;
}

/*
 * One status vocabulary everywhere an agent's state is shown:
 *   "Needs you" – blocked on a question only a person can answer
 *   "Working"   – busy with a task
 *   "Idle"      – waiting for a message
 */
export type AgentStatus = "needs-you" | "working" | "idle";

export function agentStatus(agent: Pick<RunningAgent, "idle" | "pendingQuestions">): AgentStatus {
  if ((agent.pendingQuestions ?? 0) > 0) return "needs-you";
  return agent.idle ? "idle" : "working";
}

export const AGENT_STATUS_LABEL: Record<AgentStatus, string> = { "needs-you": "Needs you", working: "Working", idle: "Idle" };

/**
 * An agent's second line: what it is doing (or "Idle" / "Needs you"), its type when
 * the title is something else (a first message, your name for it), and when it started.
 */
export function agentStatusLine(agent: RunningAgent, title: string): string {
  const status = agentStatus(agent);
  const doing = status === "working" ? agent.currentActivity || AGENT_STATUS_LABEL.working : AGENT_STATUS_LABEL[status];
  return [doing, title !== agent.displayName ? agent.displayName : null, `started ${formatTimeAgo(agent.createdAt)}`].filter(Boolean).join(" · ");
}

/** "1 needs you · 2 working · 3 idle", or "No agents"; zero counts are left out. */
export function agentCountSummary(agents: readonly Pick<RunningAgent, "idle" | "pendingQuestions">[]): string {
  if (agents.length === 0) return "No agents";
  const counts = { "needs-you": 0, working: 0, idle: 0 };
  for (const agent of agents) counts[agentStatus(agent)]++;
  return [
    counts["needs-you"] && `${counts["needs-you"]} ${counts["needs-you"] === 1 ? "needs" : "need"} you`,
    counts.working && `${counts.working} working`,
    counts.idle && `${counts.idle} idle`,
  ]
    .filter(Boolean)
    .join(" · ");
}

const STATUS_ORDER: Record<AgentStatus, number> = { "needs-you": 0, working: 1, idle: 2 };

/** Agents that need you first, then working, then idle; newest first within each. Every agent list uses this order. */
export function sortRunningAgents<T extends Pick<RunningAgent, "idle" | "createdAt" | "pendingQuestions">>(agents: readonly T[]): T[] {
  return [...agents].sort((a, b) => STATUS_ORDER[agentStatus(a)] - STATUS_ORDER[agentStatus(b)] || b.createdAt - a.createdAt);
}

/** Agents whose type is one the app is configured to work with, regardless of where they were spawned. */
export function filterAgentsByType<T extends Pick<RunningAgent, "agentType">>(agents: readonly T[], agentTypes: readonly string[]): T[] {
  return agents.filter(agent => agentTypes.includes(agent.agentType));
}

/**
 * `agents` in the same order, except that each sub-agent follows its parent (and its parent's other
 * sub-agents), nested by `depth`. A sub-agent whose parent is not in the list is shown at the top level.
 */
export function nestSubAgents<T extends Pick<RunningAgent, "id" | "parentAgentId">>(agents: readonly T[]): { agent: T; depth: number }[] {
  const ids = new Set(agents.map(agent => agent.id));
  const children = new Map<string, T[]>();
  const roots: T[] = [];
  for (const agent of agents) {
    if (agent.parentAgentId && agent.parentAgentId !== agent.id && ids.has(agent.parentAgentId)) {
      const siblings = children.get(agent.parentAgentId) ?? [];
      siblings.push(agent);
      children.set(agent.parentAgentId, siblings);
    } else {
      roots.push(agent);
    }
  }
  const nested: { agent: T; depth: number }[] = [];
  const seen = new Set<string>();
  const visit = (agent: T, depth: number) => {
    if (seen.has(agent.id)) return;
    seen.add(agent.id);
    nested.push({ agent, depth });
    for (const child of children.get(agent.id) ?? []) visit(child, depth + 1);
  };
  for (const root of roots) visit(root, 0);
  // A parent cycle (never produced by the server) would leave agents unvisited; list them rather than drop them.
  for (const agent of agents) if (!seen.has(agent.id)) visit(agent, 0);
  return nested;
}
