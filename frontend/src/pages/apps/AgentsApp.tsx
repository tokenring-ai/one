import formatError from "@tokenring-ai/utility/error/formatError";
import { Cpu, Loader2, Pause, Trash2, User } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import CheckpointBrowser from "../../components/CheckpointBrowser.tsx";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { agentRPCClient, useAgentList, useAgentTypes, useWorkflows, workflowRPCClient } from "../../rpc.ts";

export default function AgentsApp() {
  const navigate = useNavigate();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const workflows = useWorkflows();

  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [creatingAgentType, setCreatingAgentType] = useState<string | null>(null);
  const [spawningWorkflow, setSpawningWorkflow] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const createAgent = async (type: string) => {
    setCreatingAgentType(type);
    try {
      const { id } = await agentRPCClient.createAgent({ agentType: type, headless: false });
      await agents.mutate();
      void navigate(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCreatingAgentType(null);
    }
  };

  const spawnWorkflow = async (name: string) => {
    setSpawningWorkflow(name);
    try {
      const { id } = await workflowRPCClient.spawnWorkflow({ name, headless: false });
      await agents.mutate();
      void navigate(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSpawningWorkflow(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!confirmDelete) return;
    const agentId = confirmDelete;
    setConfirmDelete(null);
    setDeletingAgentId(agentId);
    try {
      await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from Agents app" });
      await agents.mutate();
    } finally {
      setDeletingAgentId(null);
    }
  };

  const groupedAgentTypes = (agentTypes.data || []).reduce(
    (acc, t) => {
      const cat = t.category || "Uncategorized";
      (acc[cat] ??= []).push(t);
      return acc;
    },
    {} as Record<string, typeof agentTypes.data & {}>,
  );

  const isLoading = agents.isLoading || agentTypes.isLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Agents"
        subtitle="Create, manage, and monitor AI agents"
        icon={<Cpu className="w-4 h-4" />}
        iconGradient="from-amber-500 to-orange-600"
      />

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto space-y-8">
          {/* Active Agents */}
          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <span className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5" /> Active Agents
              </span>
              <span className="text-2xs text-muted">{agents.data?.length ?? 0} running</span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {(agents.data?.length ?? 0) === 0 ? (
                <div className="col-span-full px-4 py-6 text-center border border-dashed border-primary rounded-lg bg-secondary/30">
                  <Cpu className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium text-primary mb-2">No agents currently active</p>
                  <p className="text-2xs text-muted max-w-md mx-auto mb-4">Create a new agent or spawn a workflow below to get started with TokenRing</p>
                  <button
                    type="button"
                    onClick={() => document.querySelector<HTMLButtonElement>("[data-launch-agent-btn]")?.click()}
                    className="inline-flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors focus-ring shadow-button-primary cursor-pointer"
                    aria-label="Create a new agent to get started"
                  >
                    <User className="w-4 h-4" />
                    Create Your First Agent
                  </button>
                </div>
              ) : (
                agents.data!.map(a => (
                  <div
                    key={a.id}
                    className="group flex items-center gap-3 bg-secondary border border-primary px-3 py-2.5 rounded-lg hover:border-amber-500/50 hover:bg-hover transition-all shadow-sm"
                  >
                    <div className="shrink-0">
                      {a.idle ? (
                        <Pause className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate(`/agent/${a.id}`)}
                      className="flex-1 flex flex-col text-left cursor-pointer min-w-0"
                      aria-label={`Select agent ${a.displayName}`}
                    >
                      <span className="text-sm font-medium text-primary truncate">{a.displayName}</span>
                      <span className="text-2xs text-muted truncate mt-0.5">{a.currentActivity}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmDelete(a.id)}
                      disabled={deletingAgentId === a.id}
                      className="p-1.5 text-muted hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100 focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed rounded-md"
                      aria-label={`Delete agent ${a.displayName}`}
                    >
                      {deletingAgentId === a.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Checkpoints */}
          <CheckpointBrowser agents={agents} />

          {/* Workflows */}
          {(workflows.data?.length ?? 0) > 0 && (
            <div className="space-y-2">
              <div className="px-1">
                <span className="text-2xs font-bold text-cyan-600 dark:text-cyan-500/90 uppercase tracking-widest">Spawn Workflow</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {workflows.data!.map(workflow => (
                  <button
                    type="button"
                    key={workflow.name}
                    onClick={() => spawnWorkflow(workflow.name)}
                    disabled={spawningWorkflow === workflow.name}
                    className="flex items-center gap-3 bg-secondary border border-primary px-3 py-2.5 rounded-lg text-left hover:bg-hover hover:border-cyan-500/50 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-sm"
                    aria-label={`Spawn workflow: ${workflow.displayName}`}
                  >
                    <div className="shrink-0 text-cyan-500">
                      {spawningWorkflow === workflow.name ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <div className="w-3.5 h-3.5 rounded-full bg-cyan-500/20 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-primary truncate">{workflow.displayName}</div>
                      <div className="text-2xs text-muted line-clamp-1 mt-0.5">{workflow.description}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Launch Agent */}
          <div className="space-y-3">
            <div className="px-1">
              <span className="text-2xs font-bold text-accent/90 uppercase tracking-widest flex items-center gap-1.5">
                <User className="w-3.5 h-3.5" /> Launch Agent
              </span>
            </div>
            {Object.entries(groupedAgentTypes).map(([category, templates]) => (
              <div key={category} className="space-y-1">
                <h3 className="text-2xs font-semibold text-muted uppercase tracking-wider px-1">{category}</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {templates.map((t, idx) => (
                    <button
                      type="button"
                      key={t.type}
                      onClick={() => createAgent(t.type)}
                      disabled={creatingAgentType === t.type}
                      className="flex items-center gap-3 bg-secondary border border-primary px-3 py-2.5 rounded-lg text-left hover:bg-hover hover:border-accent-strong transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-sm"
                      aria-label={`Create new agent: ${t.displayName}`}
                      data-launch-agent-btn={idx === 0 ? "true" : undefined}
                    >
                      <div className="shrink-0 text-accent/70">
                        {creatingAgentType === t.type ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <User className="w-3.5 h-3.5" />}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-primary truncate">{t.displayName}</div>
                        {t.description && <div className="text-2xs text-muted line-clamp-1 mt-0.5">{t.description}</div>}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {confirmDelete && (
        <ConfirmDialog
          title="Delete Agent"
          message="Are you sure you want to delete this agent? This action cannot be undone."
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDelete(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
