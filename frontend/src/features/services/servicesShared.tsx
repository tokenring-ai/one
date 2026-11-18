import { Loader2, User } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import ErrorState from "../../components/ui/ErrorState.tsx";
import StatusBadge from "../../components/ui/StatusBadge.tsx";
import type { useAgentList } from "../../rpc.ts";

/**
 * Vocabulary shared by the Services views.
 *
 * Tools and Hooks both act on one agent, and each is now its own dock panel —
 * its own React subtree — so the selection lives in {@link ./servicesStore.ts}
 * rather than in a common parent's state.
 */

export type ModelFilter = "all" | "available" | "unavailable";

export type ModelInfo = {
  status: "online" | "offline";
  available: boolean;
  modelSpec: { modelId: string; providerDisplayName: string };
};

export function categoryFromDisplayName(displayName: string): { category: string; shortName: string } {
  const match = displayName.match(/^(.*)\/(.*)$/);
  if (match) {
    return { category: match[1] || "Other", shortName: match[2] || displayName };
  }
  return { category: "Other", shortName: displayName };
}

export function AgentContextBar({
  agents,
  selectedAgentId,
  onSelect,
  enabledLabel,
}: {
  agents: ReturnType<typeof useAgentList>;
  selectedAgentId: string | null;
  onSelect: (id: string | null) => void;
  enabledLabel?: string | undefined;
}) {
  const navigate = useNavigate();
  const selectedAgent = agents.data?.find(a => a.id === selectedAgentId);
  const agentCount = agents.data?.length ?? 0;

  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between mb-4">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="inline-flex items-center gap-1.5 text-xs font-bold text-muted uppercase tracking-widest">
          <User className="w-3 h-3" />
          Agent context
        </span>
        {agents.isLoading && agentCount === 0 ? (
          <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
        ) : agents.error && agentCount === 0 ? (
          <span className="text-xs text-warning flex items-center gap-2 flex-wrap">
            Failed to load agents
            <button type="button" onClick={() => void agents.mutate()} className="underline-offset-2 hover:underline focus-ring rounded text-accent-soft">
              Retry
            </button>
          </span>
        ) : agentCount === 0 ? (
          <span className="text-xs text-muted flex items-center gap-1.5 flex-wrap">
            No agents — browse only.
            <button
              type="button"
              onClick={() => void navigate("/agents")}
              className="text-violet-600 dark:text-violet-400 underline-offset-2 hover:underline focus-ring rounded"
            >
              Open Agents
            </button>
            to create one for enable/disable.
          </span>
        ) : (
          <select
            value={selectedAgentId ?? ""}
            onChange={e => onSelect(e.target.value || null)}
            className="text-xs bg-input border border-control rounded-md px-2 py-1.5 text-primary focus-ring max-w-56"
            aria-label="Select agent for enable/disable"
          >
            {(agents.data ?? []).map(agent => (
              <option key={agent.id} value={agent.id}>
                {agent.displayName || agent.agentType || agent.id.slice(0, 8)}
              </option>
            ))}
          </select>
        )}
        {selectedAgent ? (
          <button
            type="button"
            onClick={() => void navigate(`/agent/${selectedAgent.id}`)}
            className="text-xs text-muted hover:text-primary underline-offset-2 hover:underline focus-ring rounded"
          >
            Open chat
          </button>
        ) : null}
      </div>
      {enabledLabel ? <StatusBadge label={enabledLabel} colorClass="bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30" /> : null}
    </div>
  );
}

const emptyLinkClass =
  "inline-flex items-center px-3 py-1.5 rounded-md text-xs font-medium border border-primary text-primary bg-tertiary hover:bg-hover transition-colors focus-ring";

/** Where to go when a Services list is empty: providers live in Configuration, agents in Agents. */
export function ServicesEmptyActions() {
  return (
    <div className="mt-3 flex flex-wrap justify-center gap-2">
      <Link to="/configuration" className={emptyLinkClass}>
        Open Configuration
      </Link>
      <Link to="/agents" className={emptyLinkClass}>
        Open Agents
      </Link>
    </div>
  );
}

/** Shown where the per-agent toggles would be when no agent is selected. */
export function SelectAgentHint({ what }: { what: string }) {
  return <p className="text-xs text-muted px-1">Select an agent above to turn {what} on or off.</p>;
}

/**
 * Banner for when the selected agent's enable state failed to load: the
 * toggles are disabled until it does, since their on/off would be a guess.
 */
export function EnabledStateError({ what, error, onRetry }: { what: string; error: Error; onRetry: () => void }) {
  return <ErrorState title={`Could not load which ${what} are enabled`} error={error} onRetry={onRetry} variant="inline" className="py-3" />;
}
