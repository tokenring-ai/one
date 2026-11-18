import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import ToolApprovalControls from "../../features/services/ToolApprovalControls.tsx";
import ToolDefinitionsSection from "../../features/services/ToolDefinitionsSection.tsx";
import ToolsTab from "../../features/services/ToolsTab.tsx";
import { useServicesAgent } from "../../features/services/useServicesAgent.ts";
import { useAsyncActionGuard } from "../../hooks/useAsyncActionGuard.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { chatRPCClient, useAvailableTools, useEnabledTools } from "../../rpc.ts";

/** Which tools the selected agent may call. */
export default function ServicesToolsView() {
  const { agents, selectedAgentId, selectAgent } = useServicesAgent();
  const availableTools = useAvailableTools();
  const enabledTools = useEnabledTools(selectedAgentId ?? undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [enabledOnly, setEnabledOnly] = useState(false);
  const { activeKey: busyAction, execute: executeBusy } = useAsyncActionGuard();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const enabledToolNames = useMemo(() => {
    if (enabledTools.data?.status !== "success") return new Set<string>();
    return new Set(enabledTools.data.tools);
  }, [enabledTools.data]);

  const handleAgentGone = useCallback(async () => {
    toastManager.error("Agent no longer exists", { duration: 4000 });
    // Refresh the agent list; the selection hook drops a missing agent automatically.
    await agents.mutate();
  }, [agents]);

  const toggle = useCallback(
    async (key: string, toolNames: string[]) => {
      if (!selectedAgentId) {
        toastManager.warning("Select an agent to enable or disable tools", { duration: 3000 });
        return;
      }
      if (toolNames.length === 0) {
        toastManager.info("No tools to toggle in this category", { duration: 3000 });
        return;
      }
      const allEnabled = toolNames.every(name => enabledToolNames.has(name));
      // Turning off a whole group can quietly take capabilities away from a running agent.
      if (allEnabled && toolNames.length > 1) {
        const confirmed = await openConfirm({
          id: "services:bulk-disable-tools",
          title: `Disable ${toolNames.length} tools?`,
          message: "The selected agent will stop using all of these tools until they are enabled again.",
          confirmText: "Disable all",
          variant: "danger",
        });
        if (!confirmed) return;
      }
      await executeBusy(key, async () => {
        try {
          const result = allEnabled
            ? await chatRPCClient.disableTools({ agentId: selectedAgentId, tools: toolNames })
            : await chatRPCClient.enableTools({ agentId: selectedAgentId, tools: toolNames });
          if (result.status === "agentNotFound") {
            await handleAgentGone();
            return;
          }
          await enabledTools.mutate();
        } catch (error: unknown) {
          toastManager.error(formatError(error), { duration: 5000 });
        }
      });
    },
    [enabledToolNames, enabledTools, executeBusy, handleAgentGone, openConfirm, selectedAgentId],
  );

  return (
    <ViewShell pad="page">
      <ToolsTab
        tools={availableTools}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={selectAgent}
        enabledSet={enabledToolNames}
        enabledLoading={Boolean(selectedAgentId) && enabledTools.isLoading}
        enabledError={enabledTools.error}
        onRetryEnabled={() => void enabledTools.mutate()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        busyAction={busyAction}
        onToggleTool={name => void toggle(`tool:${name}`, [name])}
        onToggleCategory={names => void toggle(`cat:${names[0]}`, names)}
        enabledOnly={enabledOnly}
        onEnabledOnlyChange={setEnabledOnly}
        agentSettings={selectedAgentId ? <ToolApprovalControls agentId={selectedAgentId} onAgentGone={() => void handleAgentGone()} /> : null}
      />
      <ToolDefinitionsSection />
      <ConfirmDialog />
    </ViewShell>
  );
}
