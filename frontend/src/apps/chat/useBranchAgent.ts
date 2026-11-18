import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback } from "react";
import { prefillChatInput } from "../../components/ChatInputContext.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { agentSessionTitle, setAgentSessionTitle } from "../../hooks/agentSessionMetaStore.ts";
import { usePaneLink } from "../../layout/hooks.ts";
import { agentRPCClient, useAgentList } from "../../rpc.ts";
import { CHAT_VIEW } from "./ids.ts";

export interface BranchOptions {
  /** Branch from the conversation as it stood at this event timestamp; omitted, from now. */
  at?: number;
  /** Text to leave in the new agent's message box (the message you branched before). */
  draft?: string;
}

/**
 * Starts a copy of an agent (now, or from an earlier point in its conversation)
 * and opens the copy's chat. The original keeps running.
 */
export function useBranchAgent() {
  const openPane = usePaneLink();
  const agents = useAgentList();
  return useCallback(
    async (agentId: string, { at, draft }: BranchOptions = {}) => {
      try {
        const result = await agentRPCClient.branchAgent({ agentId, ...(at !== undefined && { at }) });
        if (result.status === "agentNotFound") {
          toastManager.error("That agent is no longer running", { duration: 4000 });
          return;
        }
        // Named after its source so the two are told apart in the list and on their tabs.
        const source = agents.data?.find(agent => agent.id === agentId);
        setAgentSessionTitle(result.agentId, `${source ? agentSessionTitle(source) : result.agentName} (branch)`);
        if (draft) prefillChatInput(result.agentId, draft);
        void agents.mutate();
        toastManager.success("Branched into a new agent", { duration: 2500 });
        openPane(CHAT_VIEW, { agentId: result.agentId });
      } catch (error) {
        toastManager.error(`Could not branch the agent: ${formatError(error)}`, { duration: 5000 });
      }
    },
    [agents, openPane],
  );
}
