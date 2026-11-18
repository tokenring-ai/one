import formatError from "@tokenring-ai/utility/error/formatError";
import { Cpu, Pause, Plus, Square, Trash2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import ListItemWithActions from "../../components/ui/ListItemWithActions.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { agentSessionTitle, useAgentSessionMetaMap } from "../../hooks/agentSessionMetaStore.ts";
import { agentCountSummary, agentStatusLine, nestSubAgents, sortRunningAgents } from "../../lib/agentSessions.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient } from "../../rpc.ts";
import { AGENTS_PATH } from "../agents/shared.tsx";
import { useAgentActions } from "../agents/useAgentActions.ts";

/** Stop the agent's current operation; a failed stop must surface, not vanish. */
function stopAgent(agentId: string, displayName: string) {
  Promise.resolve()
    .then(() => agentRPCClient.abortCurrentOperation({ agentId, message: "User stopped the agent from the Active agents view" }))
    .then(result => {
      if (result.status === "agentNotFound") toastManager.error(`Agent "${displayName}" is no longer running`, { duration: 4000 });
    })
    .catch((error: unknown) => toastManager.error(`Failed to stop the agent: ${formatError(error)}`, { duration: 5000 }));
}

const actionButtonClass = "p-1 rounded-md text-muted hover:bg-hover focus-ring disabled:opacity-50";

/** Running agents on Home; a row opens its chat here, at `/home/agent/<id>`. */
export default function ActiveAgentsView() {
  // Ending an agent reuses the Agents app's confirm-gated flow (same skip key, closes the chat panel).
  const { agents, openAgent, deleteAgent, deletingAgentId, ConfirmDialog } = useAgentActions();
  const navigate = useNavigate();
  const metaMap = useAgentSessionMetaMap();

  if (agents.isLoading) return <LoadingState size="sm" className="h-full" />;
  if (agents.error) return <ErrorState error={agents.error} onRetry={() => void agents.mutate()} title="Unable to load agents" variant="page" />;

  const list = sortRunningAgents(agents.data ?? []);
  if (list.length === 0) {
    return (
      <EmptyState
        icon={Cpu}
        title="No running agents"
        hint="Launch an agent to see it here."
        ctaLabel="New agent"
        onCta={() => void navigate(AGENTS_PATH)}
        variant="page"
      />
    );
  }

  const working = list.filter(agent => !agent.idle).length;
  const status = (
    <span className="flex items-center gap-2 text-xs text-muted">
      <span className={cn("w-2 h-2 rounded-full", working > 0 ? "bg-accent animate-pulse" : "bg-(--text-muted) opacity-50")} aria-hidden="true" />
      <span>{agentCountSummary(list)}</span>
    </span>
  );
  return (
    <ViewShell
      scroll={false}
      header={
        <ViewHeader variant="navigator" title={status}>
          <button
            type="button"
            onClick={() => void navigate(AGENTS_PATH)}
            className="inline-flex items-center gap-1 text-xs text-accent-soft hover:underline focus-ring rounded"
          >
            <Plus className="w-3 h-3" aria-hidden="true" /> New
          </button>
        </ViewHeader>
      }
    >
      <ul className="h-full overflow-y-auto divide-y divide-line-subtle" aria-label="Running agents">
        {nestSubAgents(list).map(({ agent, depth }) => (
          <li key={agent.id} style={depth > 0 ? { paddingLeft: `${depth}rem` } : undefined}>
            <ListItemWithActions
              id={agent.id}
              onPrimary={() => openAgent(agent.id)}
              className="rounded-none px-3 py-2"
              primaryProps={{ "aria-label": `Open chat with ${agentSessionTitle(agent, metaMap)}, ${agent.idle ? "idle" : "working"}` }}
              action={
                <>
                  {!agent.idle && (
                    <button
                      type="button"
                      onClick={() => stopAgent(agent.id, agent.displayName)}
                      className={cn(actionButtonClass, "hover:text-error")}
                      aria-label={`Stop ${agent.displayName}`}
                      title="Stop current operation"
                    >
                      <Square className="w-3.5 h-3.5" aria-hidden="true" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void deleteAgent(agent.id)}
                    disabled={deletingAgentId === agent.id}
                    className={cn(actionButtonClass, "hover:text-error")}
                    aria-label={`End agent ${agent.displayName}`}
                    title="End agent"
                  >
                    <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </>
              }
            >
              <span className="flex items-start gap-2.5">
                <span className="mt-1 shrink-0" aria-hidden="true">
                  {agent.idle ? <Pause className="w-3 h-3 text-muted" /> : <BusySpinner />}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-medium text-primary truncate">{agentSessionTitle(agent, metaMap)}</span>
                  <span className="block text-xs text-muted truncate">{agentStatusLine(agent, agentSessionTitle(agent, metaMap))}</span>
                </span>
              </span>
            </ListItemWithActions>
          </li>
        ))}
      </ul>
      <ConfirmDialog />
    </ViewShell>
  );
}
