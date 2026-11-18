import { useSyncExternalStore } from "react";

/**
 * The agent Tools and Hooks act on.
 *
 * Each is its own dock panel, so there is no common React parent to hold the
 * selection. Keeping it in a module store means picking an agent in Tools is
 * immediately reflected in Hooks, which is what the single-page version got for
 * free from shared component state.
 */

let selectedAgentId: string | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const listener of listeners) listener();
}

export function setServicesAgentId(agentId: string | null): void {
  if (selectedAgentId === agentId) return;
  selectedAgentId = agentId;
  emit();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): string | null {
  return selectedAgentId;
}

export function useServicesAgentId(): string | null {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** Test seam. */
export function resetServicesAgentId(): void {
  selectedAgentId = null;
  emit();
}
