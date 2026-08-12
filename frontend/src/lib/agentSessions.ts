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
}

/** Active (non-idle) agents first, then newest. */
export function sortRunningAgents<T extends Pick<RunningAgent, "idle" | "createdAt">>(agents: readonly T[]): T[] {
  return [...agents].sort((a, b) => {
    if (a.idle !== b.idle) return a.idle ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

/** Agents whose type is one the app is configured to work with, regardless of where they were spawned. */
export function filterAgentsByType<T extends Pick<RunningAgent, "agentType">>(agents: readonly T[], agentTypes: readonly string[]): T[] {
  return agents.filter(agent => agentTypes.includes(agent.agentType));
}
