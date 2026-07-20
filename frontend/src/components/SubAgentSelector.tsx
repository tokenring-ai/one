import formatError from "@tokenring-ai/utility/error/formatError";
import { Bot, Check, Loader2, Search, X } from "lucide-react";
import { useCallback, useMemo, useState } from "react";
import { tasksRPCClient, useAvailableSubAgents, useEnabledSubAgents } from "../rpc.ts";
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from "./ui/dropdown-menu.tsx";
import { toastManager } from "./ui/toast.tsx";

interface SubAgentSelectorProps {
  agentId: string;
  triggerVariant?: "default" | "icon";
}

export default function SubAgentSelector({ agentId, triggerVariant = "default" }: SubAgentSelectorProps) {
  const availableSubAgents = useAvailableSubAgents(agentId);
  const enabledSubAgents = useEnabledSubAgents(agentId);
  const [searchQuery, setSearchQuery] = useState("");
  const [loadingAgent, setLoadingAgent] = useState<string | null>(null);
  const [loadingAll, setLoadingAll] = useState(false);
  const isIconTrigger = triggerVariant === "icon";

  const enabledSubAgentsData = enabledSubAgents.data?.status === "success" ? enabledSubAgents.data : null;
  const enabledSet = useMemo(() => new Set(enabledSubAgentsData?.agents || []), [enabledSubAgentsData?.agents]);

  const agents = availableSubAgents.data?.agents;
  const agentCount = agents?.length ?? 0;
  const enabledCount = enabledSubAgentsData?.agents.length ?? 0;
  const allEnabled = agentCount > 0 && enabledCount === agentCount;

  const handleToggleAgent = useCallback(
    async (agentType: string) => {
      setLoadingAgent(agentType);
      try {
        const isEnabled = enabledSet.has(agentType);
        if (isEnabled) {
          await tasksRPCClient.disableSubAgents({ agentId, agents: [agentType] });
        } else {
          await tasksRPCClient.enableSubAgents({ agentId, agents: [agentType] });
        }
        void enabledSubAgents.mutate();
      } catch (error: unknown) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setLoadingAgent(null);
      }
    },
    [agentId, enabledSubAgents, enabledSet],
  );

  const filteredAgents = useMemo(() => {
    if (!searchQuery.trim()) return agents ?? [];
    const query = searchQuery.toLowerCase();
    return (agents ?? []).filter(agent => agent.displayName.toLowerCase().includes(query) || agent.type.toLowerCase().includes(query));
  }, [agents, searchQuery]);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={
            isIconTrigger
              ? "flex items-center justify-center p-1.5 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring text-muted hover:text-primary"
              : "hidden md:flex items-center gap-2 px-2 py-1 rounded-md hover:bg-hover transition-colors cursor-pointer group focus-ring"
          }
          aria-label={`Select sub-agents. ${enabledCount} enabled`}
          title={`${enabledCount} sub-agents enabled`}
        >
          <Bot className={isIconTrigger ? "w-5 h-5" : "w-3.5 h-3.5 text-muted group-hover:text-primary"} />
          {!isIconTrigger && <span className="text-xs font-mono text-muted group-hover:text-primary truncate max-w-48">{enabledCount} enabled</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="max-h-150 overflow-hidden flex flex-col bg-secondary border-primary shadow-card"
        style={{ width: "400px" }}
        aria-label="Select task agents"
      >
        <div className="flex items-center gap-2 px-3 pt-2 pb-2 shrink-0 border-b border-primary">
          <span className="text-sm flex-1 font-mono text-muted shrink-0">Task Agents</span>
          <div className="relative flex-1">
            <div className="absolute inset-y-0 left-2.5 flex items-center pointer-events-none">
              <Search className="w-4 h-4 text-muted" />
            </div>
            <input
              type="text"
              placeholder="Filter sub-agents..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full bg-input border border-primary rounded-md py-1.5 pl-9 pr-8 text-xs text-primary placeholder-muted focus-ring transition-all"
              onClick={e => e.stopPropagation()}
            />
            {searchQuery && (
              <div className="absolute inset-y-0 right-2 flex items-center">
                <span className="text-2xs font-mono text-muted">
                  {filteredAgents.length} {filteredAgents.length === 1 ? "result" : "results"}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Toggle all agents button */}
        {agentCount > 1 && (
          <div className="border-b border-primary">
            <button
              type="button"
              onClick={async () => {
                setLoadingAll(true);
                try {
                  const allAgentTypes = (agents ?? []).map(a => a.type);
                  if (allEnabled) {
                    await tasksRPCClient.disableSubAgents({ agentId, agents: allAgentTypes });
                  } else {
                    await tasksRPCClient.enableSubAgents({ agentId, agents: allAgentTypes });
                  }
                  void enabledSubAgents.mutate();
                } catch (error: unknown) {
                  toastManager.error(formatError(error), { duration: 5000 });
                } finally {
                  setLoadingAll(false);
                }
              }}
              className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-hover transition-colors text-xs"
              disabled={loadingAll}
            >
              <span className="text-muted">{loadingAll ? "Processing..." : allEnabled ? "Disable all sub-agents" : "Enable all sub-agents"}</span>
              {loadingAll ? (
                <Loader2 className="w-3 h-3 text-accent animate-spin" aria-label="Loading" />
              ) : (
                <span className="text-muted">
                  {enabledCount}/{agentCount}
                </span>
              )}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto custom-scrollbar py-1 space-y-0.5">
          {filteredAgents.map(agent => {
            const isEnabled = enabledSet.has(agent.type);
            return (
              <div
                key={agent.type}
                onClick={e => {
                  e.stopPropagation();
                  void handleToggleAgent(agent.type);
                }}
                className="flex items-center cursor-pointer py-1.5 rounded-md px-3 transition-colors group hover:bg-hover"
              >
                <div className={`w-1.5 h-1.5 rounded-full mr-2.5 shrink-0 ${isEnabled ? "bg-accent shadow-[0_0_6px_rgba(99,102,241,0.5)]" : "bg-muted/50"}`} />
                <div className="flex-1 min-w-0">
                  <div className={`text-xs font-mono leading-tight truncate ${isEnabled ? "text-accent font-medium" : "text-muted group-hover:text-primary"}`}>
                    {agent.displayName}
                  </div>
                  {agent.description && <div className="text-2xs text-dim font-mono leading-tight truncate mt-0.5">{agent.description}</div>}
                </div>
                {loadingAgent === agent.type ? (
                  <Loader2 className="w-3 h-3 text-accent ml-2 shrink-0 animate-spin" aria-label="Loading" />
                ) : isEnabled ? (
                  <Check className="w-3 h-3 text-accent ml-2 shrink-0" aria-label="Enabled" />
                ) : (
                  <X className="w-3 h-3 text-muted ml-2 shrink-0" aria-label="Disabled" />
                )}
              </div>
            );
          })}

          {filteredAgents.length === 0 && searchQuery && (
            <div className="px-3 py-4 text-center text-xs text-muted">No sub-agents found matching "{searchQuery}"</div>
          )}

          {agentCount === 0 && <div className="px-3 py-4 text-center text-xs text-muted">No sub-agents available</div>}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
