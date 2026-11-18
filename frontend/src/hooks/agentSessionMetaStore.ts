import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-session metadata the webapp keeps for itself: a title you gave the session
 * (overriding the one the server derives from its first prompt) and a pinned flag.
 *
 * Stored in localStorage — the backend's agent list only knows the agent-type
 * display name, and sessions die with the agent, so a client-scoped map is the
 * right home. Entries for dead agents are pruned lazily on load.
 */

export interface AgentSessionMeta {
  /** Custom title; falls back to the agent list display name when absent. */
  title?: string;
  pinned?: boolean;
}

const STORAGE_KEY = "tokenring.agentSessionMeta";
const MAX_ENTRIES = 500;

type MetaMap = Record<string, AgentSessionMeta>;

let snapshot: MetaMap = load();
const listeners = new Set<() => void>();

function load(): MetaMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return {};
    const entries = Object.entries(parsed as Record<string, unknown>)
      .filter((entry): entry is [string, AgentSessionMeta] => typeof entry[1] === "object" && entry[1] !== null)
      .map(([id, meta]): [string, AgentSessionMeta] => [id, withoutCommandTitle(meta)]);
    return Object.fromEntries(entries);
  } catch {
    return {};
  }
}

/**
 * Titles were once set here from the first message sent, slash commands included. The server now
 * titles sessions itself, so a stored "/tools enable …" title is dropped rather than hiding it.
 */
function withoutCommandTitle(meta: AgentSessionMeta): AgentSessionMeta {
  if (!meta.title?.startsWith("/")) return meta;
  const { title: _commandTitle, ...rest } = meta;
  return rest;
}

function persist(): void {
  try {
    // Bound growth: sessions are ephemeral, so drop the oldest non-pinned entries.
    const entries = Object.entries(snapshot);
    if (entries.length > MAX_ENTRIES) {
      const kept = entries.sort((a, b) => Number(b[1].pinned ?? false) - Number(a[1].pinned ?? false)).slice(0, MAX_ENTRIES);
      snapshot = Object.fromEntries(kept);
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    // Storage unavailable (private mode/quota): keep the in-memory map.
  }
}

function emit(): void {
  persist();
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

// Keep multiple tabs consistent.
if (typeof window !== "undefined") {
  window.addEventListener("storage", event => {
    if (event.key === STORAGE_KEY) {
      snapshot = load();
      for (const listener of listeners) listener();
    }
  });
}

export function getAgentSessionMetaMap(): MetaMap {
  return snapshot;
}

export function getAgentSessionMeta(agentId: string): AgentSessionMeta | undefined {
  return snapshot[agentId];
}

export function setAgentSessionMeta(agentId: string, patch: Partial<AgentSessionMeta>): void {
  const current = snapshot[agentId] ?? {};
  const next = { ...current, ...patch };
  if (next.title === undefined && !next.pinned) {
    if (!(agentId in snapshot)) return;
    delete snapshot[agentId];
  } else {
    snapshot = { ...snapshot, [agentId]: next };
  }
  emit();
}

/** Remove a session's custom title (keeping the pin if one is set). */
export function clearAgentSessionTitle(agentId: string): void {
  const current = snapshot[agentId];
  if (current?.title === undefined) return;
  if (current.pinned) {
    snapshot = { ...snapshot, [agentId]: { pinned: current.pinned } };
  } else {
    const next = { ...snapshot };
    delete next[agentId];
    snapshot = next;
  }
  emit();
}

export function setAgentSessionTitle(agentId: string, title: string): void {
  const trimmed = title.trim();
  if (!trimmed) {
    clearAgentSessionTitle(agentId);
    return;
  }
  setAgentSessionMeta(agentId, { title: trimmed });
}

type TitledAgent = { id: string; displayName: string; title?: string | undefined };

/** The title shown for a session: your name for it, else the server's (its first prompt), else its type's name. */
export function agentSessionTitle(agent: TitledAgent, metaMap: MetaMap = snapshot): string {
  return metaMap[agent.id]?.title ?? (agent.title || agent.displayName);
}

/** Pinned sessions first (newest-first within each group is the caller's job). */
export function comparePinnedFirst(a: string, b: string, metaMap: MetaMap = snapshot): number {
  return Number(metaMap[b]?.pinned ?? false) - Number(metaMap[a]?.pinned ?? false);
}

/** Reactive whole-map access. */
export function useAgentSessionMetaMap(): MetaMap {
  return useSyncExternalStore(subscribe, getAgentSessionMetaMap, () => ({}) as MetaMap);
}

/** Convenience hook for reading one session's effective title. */
export function useAgentSessionTitle(agent: TitledAgent | null | undefined): string {
  const metaMap = useAgentSessionMetaMap();
  return agent ? agentSessionTitle(agent, metaMap) : "";
}

/** Test helper. */
export function clearAgentSessionMetaForTests(): void {
  snapshot = {};
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore.
  }
  for (const listener of listeners) listener();
}

/** Stable callback setters for components. */
export function useAgentSessionMetaActions() {
  const setTitle = useCallback((agentId: string, title: string) => setAgentSessionTitle(agentId, title), []);
  const togglePinned = useCallback((agentId: string) => {
    setAgentSessionMeta(agentId, { pinned: !snapshot[agentId]?.pinned });
  }, []);
  return { setTitle, togglePinned };
}
