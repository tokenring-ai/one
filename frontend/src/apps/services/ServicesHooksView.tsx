import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useMemo, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import HooksTab from "../../features/services/HooksTab.tsx";
import { useServicesAgent } from "../../features/services/useServicesAgent.ts";
import { useAsyncActionGuard } from "../../hooks/useAsyncActionGuard.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { lifecycleRPCClient, useAvailableHooks, useEnabledHooks } from "../../rpc.ts";

/** Which lifecycle hooks run for the selected agent. */
export default function ServicesHooksView() {
  const { agents, selectedAgentId, selectAgent } = useServicesAgent();
  const availableHooks = useAvailableHooks();
  const enabledHooks = useEnabledHooks(selectedAgentId ?? undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const { activeKey: busyAction, execute: executeBusy } = useAsyncActionGuard();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const enabledHookNames = useMemo(() => {
    if (enabledHooks.data?.status !== "success") return new Set<string>();
    return new Set(enabledHooks.data.hooks);
  }, [enabledHooks.data]);

  const handleAgentGone = useCallback(async () => {
    toastManager.error("Agent no longer exists", { duration: 4000 });
    await agents.mutate();
  }, [agents]);

  const toggle = useCallback(
    async (key: string, hookNames: string[]) => {
      if (!selectedAgentId) {
        toastManager.warning("Select an agent to enable or disable hooks", { duration: 3000 });
        return;
      }
      if (hookNames.length === 0) {
        toastManager.info("No hooks available to toggle", { duration: 3000 });
        return;
      }
      const allEnabled = hookNames.every(name => enabledHookNames.has(name));
      // Turning off a whole group can quietly take capabilities away from a running agent.
      if (allEnabled && hookNames.length > 1) {
        const confirmed = await openConfirm({
          id: "services:bulk-disable-hooks",
          title: `Disable ${hookNames.length} hooks?`,
          message: "The selected agent will stop using all of these hooks until they are enabled again.",
          confirmText: "Disable all",
          variant: "danger",
        });
        if (!confirmed) return;
      }
      await executeBusy(key, async () => {
        try {
          const result = allEnabled
            ? await lifecycleRPCClient.disableHooks({ agentId: selectedAgentId, hooks: hookNames })
            : await lifecycleRPCClient.enableHooks({ agentId: selectedAgentId, hooks: hookNames });
          if (result.status === "agentNotFound") {
            await handleAgentGone();
            return;
          }
          await enabledHooks.mutate();
        } catch (error: unknown) {
          toastManager.error(formatError(error), { duration: 5000 });
        }
      });
    },
    [enabledHookNames, enabledHooks, executeBusy, handleAgentGone, openConfirm, selectedAgentId],
  );

  return (
    <ViewShell pad="page">
      <HooksTab
        hooks={availableHooks}
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelectAgent={selectAgent}
        enabledSet={enabledHookNames}
        enabledLoading={Boolean(selectedAgentId) && enabledHooks.isLoading}
        enabledError={enabledHooks.error}
        onRetryEnabled={() => void enabledHooks.mutate()}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        busyAction={busyAction}
        onToggleHook={name => void toggle(`hook:${name}`, [name])}
        onToggleAll={() => void toggle("hooks:all", Object.keys(availableHooks.data?.hooks ?? {}))}
      />
      <ConfirmDialog />
    </ViewShell>
  );
}
