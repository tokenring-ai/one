import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useRef, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useEntityDelete } from "../../hooks/useEntityDelete.ts";
import { useLayout, usePaneLink } from "../../layout/hooks.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, useAgentList, useAgentTypes } from "../../rpc.ts";
import { CHAT_VIEW } from "../chat/ids.ts";
import { useRouteParamsFor } from "../panelHooks.ts";
import { type AgentType, type RunningAgent, typeName } from "./shared.tsx";

/**
 * Launching and deleting running agents, shared by the Agents app views and
 * Home's Active agents widget. Each view gets its own spinner state (only the
 * control that was clicked spins) but the side effects are identical. Chats
 * open in the current app (`/agent/<id>` in Agents, `/home/agent/<id>` on Home).
 */
export function useAgentActions() {
  const openPane = usePaneLink();
  const layout = useLayout();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const { openConfirm, isOpen: confirmOpen, Dialog: ConfirmDialog } = useConfirmDialog();
  const [launchingType, setLaunchingType] = useState<string | null>(null);
  // Synchronous guard so double-clicks cannot start the same launch twice before re-render disables the control.
  const launchingTypesRef = useRef(new Set<string>());

  const agentList = (agents.data ?? []) as RunningAgent[];
  const agentTypeList = (agentTypes.data ?? []) as AgentType[];
  /** The agent whose chat the URL focuses, in any app. */
  const routeAgentId = useRouteParamsFor(CHAT_VIEW)?.agentId ?? null;

  const openAgent = useCallback((agentId: string) => openPane(CHAT_VIEW, { agentId }), [openPane]);

  const refreshAgents = useCallback(() => {
    // List refresh is best-effort; stream reconnect can fail without undoing the action.
    toastOnReject(Promise.resolve(agents.mutate()), {
      message: err => `Failed to refresh agent list: ${formatError(err)}`,
      duration: 4000,
    });
  }, [agents]);

  const refreshAgentTypes = useCallback(() => {
    toastOnReject(Promise.resolve(agentTypes.mutate()), {
      message: err => `Failed to refresh agent types: ${formatError(err)}`,
      duration: 4000,
    });
  }, [agentTypes]);

  const launch = useCallback(
    async (type: string) => {
      if (launchingTypesRef.current.has(type)) return;
      launchingTypesRef.current.add(type);
      setLaunchingType(type);
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: type });
        const label = agentTypeList.find(t => t.type === type);
        // Confirm the launch even if navigation is slow, and for users who are not watching the pane.
        toastManager.success(`${label ? typeName(label) : type} launched`, { duration: 2500 });
        refreshAgents();
        openAgent(id);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        launchingTypesRef.current.delete(type);
        // Only clear our own spinner — a concurrent launch of another type may own the flag.
        setLaunchingType(prev => (prev === type ? null : prev));
      }
    },
    [agentTypeList, openAgent, refreshAgents],
  );

  // Closing the focused chat panel moves the URL on by itself, so there is no route to leave here.
  const entityDelete = useEntityDelete<string>({
    currentRouteId: null,
    navigateToOverview: () => {},
    refreshList: refreshAgents,
  });

  const deleteAgent = useCallback(
    async (agentId: string) => {
      if (entityDelete.deletingId === agentId) return;
      const displayName = agentList.find(a => a.id === agentId)?.displayName ?? agentId;
      const confirmed = await openConfirm({
        id: "agents:delete-agent",
        title: "End agent",
        message: `End "${displayName}"? It stops running and its chat closes. Checkpoints saved along the way can relaunch it.`,
        confirmText: "End agent",
        variant: "danger",
      });
      if (!confirmed) return;
      // Its chat panel has nothing left to talk to — but only once the agent is
      // actually gone; useEntityDelete reports a failed delete and returns normally.
      const closeChatPanel = () => layout.close(CHAT_VIEW, { agentId });
      await entityDelete.deleteEntity(agentId, displayName, async () => {
        const result = await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from the Agents dashboard" });
        if (result.status === "agentNotFound") {
          // Already gone: clean up the panel and list here, then throw so the hook shows an error toast.
          closeChatPanel();
          refreshAgents();
          throw new Error(`Agent "${displayName}" is no longer running`);
        }
        closeChatPanel();
      });
    },
    [agentList, entityDelete, layout, openConfirm, refreshAgents],
  );

  return {
    agents,
    agentTypes,
    agentList,
    agentTypeList,
    routeAgentId,
    openAgent,
    launch,
    launchingType,
    deleteAgent,
    deletingAgentId: entityDelete.deletingId,
    refreshAgents,
    refreshAgentTypes,
    confirmOpen,
    ConfirmDialog,
  };
}
