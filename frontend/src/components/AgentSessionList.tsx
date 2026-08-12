import { ChevronDown, ChevronRight, Loader2, Pause, Plus, Trash2 } from "lucide-react";
import { useLocalStorageState } from "../hooks/useLocalStorageState.ts";
import type { RunningAgent } from "../lib/agentSessions.ts";
import ListItemWithActions from "./ui/ListItemWithActions.tsx";

export interface AgentSessionListProps {
  /** Running agents of the types this app works with. */
  agents: readonly RunningAgent[];
  /** The agent the chat dock is attached to. */
  selectedAgentId: string | null;
  /** True while the agent stream is still loading for the first time. */
  isLoading?: boolean;
  /** Per-app prefix for the persisted collapse state. */
  storageKey: string;
  onSelect: (agentId: string) => void;
  onTerminate: (agentId: string) => void;
  onCreate: () => void;
  /** Section label. Defaults to "Agents". */
  label?: string;
}

/**
 * Sidebar section listing every running agent this app can talk to, wherever it was
 * spawned. Selecting one attaches the app's chat dock to it.
 */
export default function AgentSessionList({
  agents,
  selectedAgentId,
  isLoading = false,
  storageKey,
  onSelect,
  onTerminate,
  onCreate,
  label = "Agents",
}: AgentSessionListProps) {
  const [expanded, setExpanded] = useLocalStorageState<boolean>(`agentSessionList:${storageKey}:expanded`, true);

  return (
    <div className="shrink-0 border-b border-primary">
      <div className="flex items-center gap-1 px-2 py-1.5">
        <button
          type="button"
          onClick={() => setExpanded(open => !open)}
          aria-expanded={expanded}
          className="flex-1 min-w-0 flex items-center gap-1 text-left cursor-pointer focus-ring rounded"
        >
          {expanded ? <ChevronDown className="w-3 h-3 shrink-0 text-muted" /> : <ChevronRight className="w-3 h-3 shrink-0 text-muted" />}
          <span className="text-xs font-bold text-muted uppercase tracking-widest truncate">{label}</span>
          {agents.length > 0 && <span className="text-xs text-muted shrink-0">{agents.length}</span>}
        </button>
        <button
          type="button"
          onClick={onCreate}
          title={`New ${label.toLowerCase().replace(/s$/, "")}`}
          aria-label="New agent"
          className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {expanded && (
        <div className="max-h-48 overflow-y-auto pb-1">
          {isLoading && agents.length === 0 ? (
            <div className="px-3 py-2 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading agents…
            </div>
          ) : agents.length === 0 ? (
            <p className="px-3 py-2 text-xs text-muted">No agents running — start one to chat here.</p>
          ) : (
            agents.map(agent => {
              const isSelected = agent.id === selectedAgentId;
              return (
                <ListItemWithActions
                  key={agent.id}
                  id={`agent:${agent.id}`}
                  selected={isSelected}
                  onPrimary={() => onSelect(agent.id)}
                  className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                  action={
                    <button
                      type="button"
                      onClick={() => onTerminate(agent.id)}
                      title={`Stop ${agent.displayName}`}
                      className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  }
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <span className="shrink-0">
                      {agent.idle ? (
                        <Pause className="w-3 h-3 text-muted" />
                      ) : (
                        <span className="block w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      )}
                    </span>
                    <span className="flex-1 min-w-0">
                      <span className="block truncate text-xs font-medium" title={agent.displayName}>
                        {agent.displayName}
                      </span>
                      <span className="block truncate text-xs text-muted" title={agent.currentActivity}>
                        {agent.currentActivity}
                      </span>
                    </span>
                  </span>
                </ListItemWithActions>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
