import { useSyncExternalStore } from "react";
import type { AgentDraft } from "../../features/agents/agentDraft.ts";

/**
 * In-progress agent-type edits, shared between the type editor panels and the
 * create panel (cloning seeds the create draft from another panel). In memory
 * only: drafts live for the session, like the old single-page app's state.
 */

/** Draft key for the not-yet-created agent; can never collide with a real agent type. */
export const NEW_DRAFT_KEY = "__new__";

interface AgentDraftState {
  drafts: Readonly<Record<string, AgentDraft>>;
  /** Type name typed into the create form. */
  newName: string;
}

let state: AgentDraftState = { drafts: {}, newName: "" };
const listeners = new Set<() => void>();

function update(next: AgentDraftState) {
  state = next;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAgentDraftStore(): AgentDraftState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

/** The draft for `key` right now, outside render (e.g. after an awaited save). */
export function getAgentDraft(key: string): AgentDraft | undefined {
  return state.drafts[key];
}

export function setAgentDraft(key: string, draft: AgentDraft): void {
  update({ ...state, drafts: { ...state.drafts, [key]: draft } });
}

export function clearAgentDraft(key: string): void {
  if (!(key in state.drafts)) return;
  const { [key]: _removed, ...rest } = state.drafts;
  update({ ...state, drafts: rest });
}

export function setNewAgentName(newName: string): void {
  if (newName === state.newName) return;
  update({ ...state, newName });
}

/** Test helper. */
export function resetAgentDraftStore(): void {
  update({ drafts: {}, newName: "" });
}
