import formatError from "@tokenring-ai/utility/error/formatError";
import { type ReactElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toastManager } from "../components/ui/toast.tsx";
import { filterAgentsByType, type RunningAgent, sortRunningAgents } from "../lib/agentSessions.ts";
import { agentRPCClient, useAgentList } from "../rpc.ts";
import { useConfirmDialog } from "./useConfirmDialog.tsx";
import { useLocalStorageState } from "./useLocalStorageState.ts";
import { useRefSync } from "./useRefSync.ts";

/**
 * Agents created through this hook that the live list has not reported yet,
 * keyed by selection storage key. Shared across hook instances because several
 * apps mount more than one (a navigator plus a session panel) on the same
 * persisted selection: the instance that did not create the agent must still
 * wait for it rather than treat the new selection as a dead agent and clear it.
 * An entry expires as soon as any instance sees the agent in the list.
 */
const pendingCreations = new Map<string, Set<string>>();

function isPendingCreation(key: string, id: string): boolean {
  return pendingCreations.get(key)?.has(id) ?? false;
}

function addPendingCreation(key: string, id: string): void {
  let ids = pendingCreations.get(key);
  if (!ids) {
    ids = new Set();
    pendingCreations.set(key, ids);
  }
  ids.add(id);
}

function removePendingCreation(key: string, id: string): void {
  const ids = pendingCreations.get(key);
  if (!ids) return;
  ids.delete(id);
  if (ids.size === 0) pendingCreations.delete(key);
}

export interface UseAppAgentSessionOptions {
  /** Human-readable app name, used in agent deletion reasons. */
  appName: string;
  /** Per-app prefix for the persisted selection (also the legacy ChatDock storage key). */
  storageKey: string;
  /** Agent types this app works with. The first entry is the default for new agents. */
  agentTypes: readonly string[];
}

export interface UseAppAgentSessionResult {
  /** The attached agent, validated against the live agent list. */
  agentId: string | null;
  /** List entry for the attached agent (displayName, idle, currentActivity). */
  agent: RunningAgent | null;
  /** Every running agent matching `agentTypes`, wherever it was spawned, active first. */
  agents: RunningAgent[];
  /** Type used when creating an agent without naming one. */
  defaultAgentType: string | undefined;
  isLoading: boolean;
  isCreating: boolean;
  selectAgent: (id: string) => void;
  /** Create an agent of `agentType` (default: `agentTypes[0]`) and attach to it. */
  createAgent: (agentType?: string) => Promise<string | null>;
  /** Confirm, then delete the agent (default: the attached one). */
  terminateAgent: (id?: string) => Promise<void>;
  /** Confirmation dialog render point — mount once in the app. */
  TerminateDialog: () => ReactElement | null;
}

/**
 * Attaches an app to one of the running agents whose type the app is configured for.
 *
 * Unlike an owned agent, the selection is persisted rather than owned: navigating away
 * or reloading leaves every agent running, and the app reattaches to the same one when
 * it comes back. Agents spawned anywhere else show up here too.
 */
export function useAppAgentSession({ appName, storageKey, agentTypes }: UseAppAgentSessionOptions): UseAppAgentSessionResult {
  const agentList = useAgentList();
  const { openConfirm, Dialog } = useConfirmDialog();
  const selectionKey = `agentSession:${storageKey}`;
  const [selectedId, setSelectedId] = useLocalStorageState<string | null>(selectionKey, null);
  const [isCreating, setIsCreating] = useState(false);

  // Callers commonly build this array inline from config, so key the memo on contents.
  const typesKey = agentTypes.join("\0");
  // oxlint-disable-next-line react-hooks/exhaustive-deps -- typesKey is the stable identity of agentTypes
  const types = useMemo(() => [...agentTypes], [typesKey]);
  const defaultAgentType = types[0];

  // Agents we deleted, hidden until the stream drops them, so nothing reattaches to a dead agent.
  const [terminatedIds, setTerminatedIds] = useState<readonly string[]>([]);

  const hasList = agentList.data !== undefined;
  const matching = useMemo(() => filterAgentsByType((agentList.data ?? []) as RunningAgent[], types), [agentList.data, types]);
  const agents = useMemo(() => sortRunningAgents(matching.filter(a => !terminatedIds.includes(a.id))), [matching, terminatedIds]);

  useEffect(() => {
    if (terminatedIds.length === 0) return;
    const stillListed = terminatedIds.filter(id => matching.some(a => a.id === id));
    if (stillListed.length !== terminatedIds.length) setTerminatedIds(stillListed);
  }, [matching, terminatedIds]);

  // Ids created for this selection key that the live list has not reported yet
  // (`pendingCreations`) distinguish "agent ended" (drop the selection) from
  // "created but not streamed yet" (wait).
  // The last agent this hook was attached to. When that agent temporarily drops out
  // of the live list (stream gap, restart) we wait for it to come back and reattach,
  // rather than silently switching to a different agent.
  const lastKnownIdRef = useRef<string | null>(null);

  // Declared before the reconcile effect so pending creations are expired when it runs.
  useEffect(() => {
    for (const agent of agents) removePendingCreation(selectionKey, agent.id);
  }, [agents, selectionKey]);

  useEffect(() => {
    if (!hasList) return;
    if (selectedId !== null && agents.some(agent => agent.id === selectedId)) {
      lastKnownIdRef.current = selectedId;
      return;
    }
    if (selectedId === null) {
      // Reattach to the previous agent if it has come back.
      const lastKnown = lastKnownIdRef.current;
      if (lastKnown !== null && agents.some(agent => agent.id === lastKnown)) {
        setSelectedId(lastKnown);
        return;
      }
      // The previous agent is still missing — wait for it rather than grabbing a
      // different one. Only auto-select when there is no known agent at all.
      if (lastKnown !== null) return;
      const first = agents[0];
      if (first) setSelectedId(first.id);
      return;
    }
    // Keep a just-created agent selected until the stream catches up with it.
    // Any instance sharing this selection may have created it.
    if (isPendingCreation(selectionKey, selectedId)) return;
    // The selected agent is gone. Remember it so we can reattach if it returns,
    // and clear the selection instead of reattaching to a different agent.
    lastKnownIdRef.current = selectedId;
    setSelectedId(null);
  }, [hasList, agents, selectedId, selectionKey, setSelectedId]);

  const agent = useMemo(() => agents.find(a => a.id === selectedId) ?? null, [agents, selectedId]);
  // Only expose an id the list still knows about, except while a fresh creation streams in.
  const agentId = agent ? agent.id : selectedId !== null && isPendingCreation(selectionKey, selectedId) ? selectedId : null;

  const selectAgent = useCallback(
    (id: string) => {
      setSelectedId(id);
    },
    [setSelectedId],
  );

  /**
   * Creations in flight, by agent type. Callers do `agentId ?? (await createAgent())` before any
   * busy guard, so a double-click would otherwise start two agents: the second call shares the first.
   */
  const creatingRef = useRef(new Map<string, Promise<string | null>>());
  const createAgent = useCallback(
    async (agentType?: string): Promise<string | null> => {
      const type = agentType ?? defaultAgentType;
      if (!type) {
        toastManager.error("No agent type is configured for this app", { duration: 5000 });
        return null;
      }
      const pending = creatingRef.current.get(type);
      if (pending) return pending;
      const creation = (async () => {
        setIsCreating(true);
        try {
          const { id } = await agentRPCClient.createAgent({ agentType: type });
          addPendingCreation(selectionKey, id);
          setSelectedId(id);
          return id;
        } catch (error) {
          toastManager.error(formatError(error), { duration: 5000 });
          return null;
        } finally {
          creatingRef.current.delete(type);
          setIsCreating(false);
        }
      })();
      creatingRef.current.set(type, creation);
      return creation;
    },
    [defaultAgentType, selectionKey, setSelectedId],
  );

  const agentsRef = useRefSync(agents);

  const terminateAgent = useCallback(
    async (id?: string): Promise<void> => {
      const targetId = id ?? agentId;
      if (!targetId) return;
      const target = agentsRef.current.find(a => a.id === targetId);
      const displayName = target?.displayName ?? targetId;
      const ok = await openConfirm({
        id: "app:stop-agent",
        title: "Stop agent?",
        message: `This shuts down "${displayName}". Any work it has in progress is lost.`,
        confirmText: "Stop agent",
        variant: "danger",
      });
      if (!ok) return;
      try {
        const result = await agentRPCClient.deleteAgent({ agentId: targetId, reason: `Stopped from the ${appName}` });
        if (result.status === "success") toastManager.success("Agent stopped", { duration: 2000 });
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        return;
      }
      removePendingCreation(selectionKey, targetId);
      setTerminatedIds(prev => (prev.includes(targetId) ? prev : [...prev, targetId]));
      setSelectedId(current => (current === targetId ? null : current));
    },
    [agentId, agentsRef, appName, openConfirm, selectionKey, setSelectedId],
  );

  return {
    agentId,
    agent,
    agents,
    defaultAgentType,
    isLoading: agentList.isLoading && !hasList,
    isCreating,
    selectAgent,
    createAgent,
    terminateAgent,
    TerminateDialog: Dialog,
  };
}
