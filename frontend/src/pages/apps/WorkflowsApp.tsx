import formatError from "@tokenring-ai/utility/error/formatError";
import { GitBranch, Loader2, Pause } from "lucide-react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../components/ui/toast.tsx";
import { useAgentList, useWorkflows, workflowRPCClient } from "../../rpc.ts";

export default function WorkflowsApp() {
  const navigate = useNavigate();
  const workflows = useWorkflows();
  const agents = useAgentList();
  const [spawning, setSpawning] = useState<string | null>(null);

  const spawnWorkflow = async (name: string) => {
    setSpawning(name);
    try {
      const { id } = await workflowRPCClient.spawnWorkflow({ name, headless: false });
      await agents.mutate();
      void navigate(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSpawning(null);
    }
  };

  const workflowAgentTypes = useMemo(() => new Set(workflows.data?.map(w => w.agentType) ?? []), [workflows.data]);

  const runningAgents = useMemo(() => (agents.data ?? []).filter(a => !a.idle && workflowAgentTypes.has(a.agentType)), [agents.data, workflowAgentTypes]);

  const groupedWorkflows = useMemo(() => {
    const groups: Record<string, NonNullable<typeof workflows.data>> = {};
    for (const workflow of workflows.data ?? []) {
      const category = workflow.category || "User-Created Workflows";
      (groups[category] ??= []).push(workflow);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [workflows.data]);

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Header */}
          <div>
            <h1 className="text-primary text-xl font-bold tracking-tight mb-1 flex items-center gap-2">
              <GitBranch className="w-5 h-5 text-cyan-500" /> Workflows
            </h1>
            <p className="text-xs text-muted">Launch and monitor automated multi-agent workflows</p>
          </div>

          {/* Running agents */}
          {runningAgents.length > 0 && (
            <div className="space-y-2">
              <span className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest px-1 block">Running</span>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {runningAgents.map(agent => (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => navigate(`/agent/${agent.id}`)}
                    className="flex items-center gap-3 bg-secondary border border-amber-500/30 px-3 py-2.5 rounded-lg text-left hover:bg-hover hover:border-amber-500/60 transition-all cursor-pointer focus-ring shadow-sm"
                    aria-label={`Open running agent ${agent.displayName}`}
                  >
                    <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                      <div className="text-2xs text-muted truncate mt-0.5">{agent.currentActivity}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Available workflows */}
          <div className="space-y-3">
            <span className="text-2xs font-bold text-cyan-600 dark:text-cyan-500/90 uppercase tracking-widest px-1 block">Available Workflows</span>

            {workflows.isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="w-6 h-6 text-muted animate-spin" />
              </div>
            ) : groupedWorkflows.length === 0 ? (
              <div className="px-4 py-8 text-center border border-dashed border-primary rounded-lg bg-secondary/30">
                <GitBranch className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-primary mb-1">No workflows available</p>
                <p className="text-2xs text-muted max-w-sm mx-auto">
                  Workflows are defined in your <code className="font-mono text-primary">.tokenring/workflows/</code> directory.
                </p>
              </div>
            ) : (
              groupedWorkflows.map(([category, items]) => (
                <div key={category} className="space-y-1">
                  <h3 className="text-2xs font-semibold text-muted uppercase tracking-wider px-1">{category}</h3>
                  <ul className="flex flex-col border border-primary rounded-xl overflow-hidden bg-secondary divide-y divide-primary shadow-sm">
                    {items.map(workflow => (
                      <li key={workflow.name}>
                        <button
                          type="button"
                          onClick={() => spawnWorkflow(workflow.name)}
                          disabled={spawning === workflow.name}
                          className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-hover transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring"
                          aria-label={`Launch workflow: ${workflow.displayName}`}
                        >
                          <div className="shrink-0 text-cyan-500">
                            {spawning === workflow.name ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Pause className="w-3.5 h-3.5 rotate-180 fill-current" />
                            )}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="text-sm font-medium text-primary truncate">{workflow.displayName}</span>
                              <span className="shrink-0 text-2xs font-mono text-muted bg-primary/50 border border-primary px-1.5 py-0.5 rounded">
                                {workflow.agentType}
                              </span>
                            </div>
                            {workflow.description && <div className="text-2xs text-muted line-clamp-1 mt-0.5">{workflow.description}</div>}
                          </div>
                          <span className="shrink-0 text-2xs font-medium text-cyan-600 dark:text-cyan-400">
                            {spawning === workflow.name ? "Launching…" : "Launch"}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
