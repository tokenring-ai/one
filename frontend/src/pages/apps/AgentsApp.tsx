import formatError from "@tokenring-ai/utility/error/formatError";
import { ChevronDown, ChevronRight, Cpu, GitBranch, Glasses, Loader2, Pause, Play, Trash2, User, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AgentTodoList from "../../components/AgentTodoList.tsx";
import CheckpointBrowser from "../../components/CheckpointBrowser.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { agentRPCClient, useAgentList, useAgentTypes, useWorkflows, workflowRPCClient } from "../../rpc.ts";

/** Fallback group for agent types whose config omits a category. */
const UNCATEGORIZED = "Uncategorized";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AgentType {
  type: string;
  displayName: string;
  description: string;
  category?: string;
  enabledTools: string[];
}

interface RunningAgent {
  id: string;
  createdAt: number;
  agentType: string;
  displayName: string;
  description: string;
  idle: boolean;
  currentActivity: string;
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function AgentSidebar({
  agents,
  agentsLoading,
  agentsError,
  onRetryAgents,
  agentTypes,
  agentTypesLoading,
  agentTypesError,
  onRetryAgentTypes,
  selectedAgentId,
  selectedType,
  launchingType,
  deletingAgentId,
  onSelectType,
  onLaunchType,
  onOpenAgent,
  onDeleteAgent,
}: {
  agents: RunningAgent[];
  agentsLoading: boolean;
  agentsError: Error | undefined;
  onRetryAgents: () => void;
  agentTypes: AgentType[];
  agentTypesLoading: boolean;
  agentTypesError: Error | undefined;
  onRetryAgentTypes: () => void;
  /** The agent whose chat is open in the detail pane, if any. */
  selectedAgentId: string | null;
  selectedType: string | null;
  launchingType: string | null;
  deletingAgentId: string | null;
  onSelectType: (type: string) => void;
  onLaunchType: (type: string) => void;
  onOpenAgent: (id: string) => void;
  onDeleteAgent: (id: string) => void;
}) {
  const grouped = useMemo(() => {
    const groups: Record<string, AgentType[]> = {};
    for (const agentType of agentTypes) {
      (groups[agentType.category || UNCATEGORIZED] ??= []).push(agentType);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [agentTypes]);

  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const toggleCategory = (category: string) =>
    setCollapsed(prev => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });

  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-primary">
        <span className="flex-1 text-2xs font-bold text-muted uppercase tracking-widest px-1">Agents</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {/* Running agents, with their live todo lists */}
        <div className="border-b border-primary/50">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest">Running</span>
            <span className="text-2xs text-muted" aria-live="polite">
              {agents.length} running
            </span>
          </div>
          {agentsLoading && agents.length === 0 ? (
            <LoadingState size="sm" className="py-6" />
          ) : agentsError ? (
            <ErrorState title="Failed to load agents" error={agentsError} onRetry={onRetryAgents} variant="inline" />
          ) : agents.length === 0 ? (
            <div className="px-3 py-4 text-center text-muted text-2xs italic">No active agents</div>
          ) : (
            agents.map(agent => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`group mx-1.5 mb-0.5 px-2 py-1.5 rounded-md border transition-all ${
                    isSelected ? "bg-active border-primary" : "border-transparent hover:bg-hover"
                  }`}
                  aria-current={isSelected ? "page" : undefined}
                >
                  <div className="flex items-center gap-2">
                    <div className="shrink-0" aria-hidden="true">
                      {agent.idle ? (
                        <Pause className="w-3 h-3 text-muted" />
                      ) : (
                        <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => onOpenAgent(agent.id)}
                      className="min-w-0 flex-1 flex flex-col text-left cursor-pointer focus-ring rounded"
                      aria-label={`Open agent ${agent.displayName}`}
                      title={agent.currentActivity}
                    >
                      <span className={`text-xs font-medium truncate ${isSelected ? "text-primary" : "text-secondary"}`}>{agent.displayName}</span>
                      <span className="text-2xs text-muted truncate">{agent.currentActivity}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteAgent(agent.id)}
                      disabled={deletingAgentId === agent.id}
                      className="p-1 text-muted hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                      aria-label={`Delete agent ${agent.displayName}`}
                    >
                      {deletingAgentId === agent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                    </button>
                  </div>
                  <AgentTodoList agentId={agent.id} agentName={agent.displayName} className="mt-1.5 ml-7 border-t border-primary/40 pt-1.5" />
                </div>
              );
            })
          )}
        </div>

        {/* Agent types, grouped by category */}
        <div>
          <span className="block px-3 pt-2.5 pb-1 text-2xs font-bold text-accent/90 uppercase tracking-widest">Agent Types</span>
          {agentTypesLoading && agentTypes.length === 0 ? (
            <LoadingState size="sm" className="py-6" />
          ) : agentTypesError ? (
            <ErrorState title="Failed to load agent types" error={agentTypesError} onRetry={onRetryAgentTypes} variant="inline" />
          ) : agentTypes.length === 0 ? (
            <div className="px-3 py-6 text-center">
              <User className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
              <p className="text-2xs text-muted">No agent types configured</p>
            </div>
          ) : (
            grouped.map(([category, types]) => (
              <div key={category}>
                <button
                  type="button"
                  onClick={() => toggleCategory(category)}
                  className="w-full flex items-center gap-1 px-2 py-1.5 text-left hover:bg-hover transition-colors cursor-pointer"
                >
                  {collapsed.has(category) ? (
                    <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" />
                  )}
                  <span className="flex-1 min-w-0 truncate text-2xs font-semibold text-muted uppercase tracking-wider">{category}</span>
                  <span className="text-2xs text-muted shrink-0 pr-1">{types.length}</span>
                </button>
                {!collapsed.has(category) &&
                  types.map(agentType => {
                    const isSelected = selectedType === agentType.type;
                    const isLaunching = launchingType === agentType.type;
                    return (
                      <div
                        key={agentType.type}
                        className={`group flex items-center gap-0.5 pl-5 pr-1.5 py-1 transition-colors ${
                          isSelected ? "bg-accent-muted text-accent" : "hover:bg-hover text-primary"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => onLaunchType(agentType.type)}
                          disabled={isLaunching}
                          className="min-w-0 flex-1 flex items-center gap-1.5 py-0.5 text-left cursor-pointer focus-ring rounded disabled:cursor-not-allowed disabled:opacity-60"
                          title={agentType.description || `Launch ${agentType.displayName || agentType.type}`}
                          aria-label={`Launch ${agentType.displayName || agentType.type}`}
                        >
                          {isLaunching ? <Loader2 className="w-3 h-3 shrink-0 animate-spin opacity-70" /> : <User className="w-3 h-3 shrink-0 opacity-70" />}
                          <span className="flex-1 min-w-0 truncate text-xs">{agentType.displayName || agentType.type}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => onSelectType(agentType.type)}
                          title={`View ${agentType.displayName || agentType.type}`}
                          aria-label={`View ${agentType.displayName || agentType.type}`}
                          className={`p-1 rounded transition-colors cursor-pointer focus-ring shrink-0 ${
                            isSelected
                              ? "text-accent hover:bg-accent/15"
                              : "text-muted opacity-0 group-hover:opacity-100 hover:text-amber-600 dark:hover:text-amber-400 hover:bg-amber-500/10 focus-visible:opacity-100"
                          }`}
                        >
                          <Glasses className="w-3 h-3" />
                        </button>
                      </div>
                    );
                  })}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

// ─── AgentTypeDetail (read-only) ───────────────────────────────────────────────

function AgentTypeDetail({
  agentType,
  runningAgents,
  launching,
  onLaunch,
  onOpenAgent,
}: {
  agentType: AgentType;
  runningAgents: RunningAgent[];
  launching: boolean;
  onLaunch: () => void;
  onOpenAgent: (id: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-primary">
      <AppPageHeader
        title={agentType.displayName || agentType.type}
        subtitle={
          <span className="flex items-center gap-2 text-2xs text-muted">
            <code className="font-mono">{agentType.type}</code>
            {agentType.category && <span>· {agentType.category}</span>}
            {runningAgents.length > 0 && <span className="text-amber-600 dark:text-amber-500 font-medium">· {runningAgents.length} running</span>}
          </span>
        }
        icon={<Cpu />}
        iconGradient="from-amber-500 to-orange-600"
        size="compact"
      >
        <button
          type="button"
          onClick={onLaunch}
          disabled={launching}
          title="Start a new agent of this type"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-2xs font-semibold rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          {launching ? "Launching…" : "Launch"}
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="space-y-1">
            <span className="text-2xs font-semibold text-muted uppercase tracking-wide">Description</span>
            <p className="text-xs text-secondary leading-relaxed">{agentType.description || "No description provided."}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-2xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="w-3 h-3" /> Enabled tools
              </span>
              <span className="text-2xs text-muted">{agentType.enabledTools.length} configured</span>
            </div>
            {agentType.enabledTools.length === 0 ? (
              <p className="text-2xs text-muted italic">No tools are enabled for this agent type.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {agentType.enabledTools.map(tool => (
                  <span key={tool} className="px-2 py-1 bg-secondary border border-primary rounded-md text-2xs font-mono text-secondary">
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>

          {runningAgents.length > 0 && (
            <div className="space-y-2">
              <span className="text-2xs font-semibold text-muted uppercase tracking-wide">Running agents of this type</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {runningAgents.map(agent => (
                  <button
                    type="button"
                    key={agent.id}
                    onClick={() => onOpenAgent(agent.id)}
                    className="flex items-center gap-2.5 bg-secondary border border-primary px-3 py-2 rounded-lg text-left hover:bg-hover hover:border-amber-500/50 transition-all cursor-pointer focus-ring"
                    aria-label={`Open agent ${agent.displayName}`}
                  >
                    <div className="shrink-0" aria-hidden="true">
                      {agent.idle ? (
                        <Pause className="w-3.5 h-3.5 text-muted" />
                      ) : (
                        <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                      )}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-medium text-primary truncate">{agent.displayName}</div>
                      <div className="text-2xs text-muted truncate">{agent.currentActivity}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-2xs text-muted border-t border-primary/60 pt-3">
            Agent types are read-only here — change them in the Configuration app or in your TokenRing config files.
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Overview (nothing selected) ───────────────────────────────────────────────

function AgentsOverview({
  agents,
  hasAgentTypes,
  workflows,
  spawningWorkflow,
  onSpawnWorkflow,
}: {
  agents: ReturnType<typeof useAgentList>;
  hasAgentTypes: boolean;
  workflows: { name: string; displayName: string; description: string }[];
  spawningWorkflow: string | null;
  onSpawnWorkflow: (name: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Agents"
        subtitle="Create, manage, and monitor AI agents"
        icon={<Cpu />}
        iconGradient="from-amber-500 to-orange-600"
        size="compact"
      />

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-3xl mx-auto space-y-6">
          <div className="flex flex-col items-center text-center gap-3 py-4">
            <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-lg">
              <Cpu className="w-7 h-7 text-white" />
            </div>
            <div className="max-w-md space-y-2">
              <h2 className="text-base font-semibold text-primary">{hasAgentTypes ? "Select an agent type" : "No agent types configured"}</h2>
              <p className="text-sm text-muted leading-relaxed">
                {hasAgentTypes
                  ? "Pick an agent type from the list to see what it does and which tools it can use, then launch it. Running agents and their todo lists are shown above the list."
                  : "Agent types come from your TokenRing configuration. Add one in the Configuration app to get started."}
              </p>
            </div>
          </div>

          <CheckpointBrowser agents={agents} />

          {workflows.length > 0 && (
            <div className="space-y-2">
              <div className="px-1">
                <span className="text-2xs font-bold text-cyan-600 dark:text-cyan-500/90 uppercase tracking-widest flex items-center gap-1.5">
                  <GitBranch className="w-3.5 h-3.5" /> Spawn Workflow
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                {workflows.map(workflow => (
                  <button
                    type="button"
                    key={workflow.name}
                    onClick={() => onSpawnWorkflow(workflow.name)}
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
        </div>
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function AgentsApp() {
  const navigate = useNavigate();
  // `agentType` comes from /agents/:agentType, `agentId` from /agent/:agentId — the chat route renders
  // this app too, so the sidebar stays put while an agent is open.
  const { agentType: routeAgentType, agentId: routeAgentId } = useParams<{ agentType?: string; agentId?: string }>();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const workflows = useWorkflows();

  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [launchingType, setLaunchingType] = useState<string | null>(null);
  const [spawningWorkflow, setSpawningWorkflow] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const agentList = (agents.data ?? []) as RunningAgent[];
  const agentTypeList = (agentTypes.data ?? []) as AgentType[];

  const selectedAgentType = useMemo(
    () => (routeAgentType ? (agentTypeList.find(t => t.type === routeAgentType) ?? null) : null),
    [agentTypeList, routeAgentType],
  );

  // A route pointing at an agent type that is no longer configured resets to the overview.
  useEffect(() => {
    if (routeAgentType && !agentTypes.isLoading && agentTypeList.length > 0 && !selectedAgentType) {
      toastManager.error(`Agent type "${routeAgentType}" not found`, { duration: 4000 });
      void navigate("/agents", { replace: true });
    }
  }, [routeAgentType, selectedAgentType, agentTypeList.length, agentTypes.isLoading, navigate]);

  const handleSelectType = useCallback((type: string) => void navigate(`/agents/${encodeURIComponent(type)}`), [navigate]);

  const handleLaunch = useCallback(
    async (type: string) => {
      setLaunchingType(type);
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: type, headless: false });
        await agents.mutate();
        void navigate(`/agent/${id}`);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setLaunchingType(null);
      }
    },
    [agents, navigate],
  );

  const handleSpawnWorkflow = useCallback(
    async (name: string) => {
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
    },
    [agents, navigate],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDelete) return;
    const agentId = confirmDelete;
    setConfirmDelete(null);
    setDeletingAgentId(agentId);
    try {
      await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from Agents app" });
      await agents.mutate();
      // The open chat would point at a deleted agent, so fall back to the overview.
      if (routeAgentId === agentId) void navigate("/agents");
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setDeletingAgentId(null);
    }
  }, [agents, confirmDelete, navigate, routeAgentId]);

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <ResizableSplit direction="horizontal" initialRatio={0.22} minFirst={200} minSecond={360} className="flex-1 min-h-0">
        <AgentSidebar
          agents={agentList}
          agentsLoading={agents.isLoading}
          agentsError={agents.error}
          onRetryAgents={() => void agents.mutate()}
          agentTypes={agentTypeList}
          agentTypesLoading={agentTypes.isLoading}
          agentTypesError={agentTypes.error}
          onRetryAgentTypes={() => void agentTypes.mutate()}
          selectedAgentId={routeAgentId ?? null}
          selectedType={selectedAgentType?.type ?? null}
          launchingType={launchingType}
          deletingAgentId={deletingAgentId}
          onSelectType={handleSelectType}
          onLaunchType={type => void handleLaunch(type)}
          onOpenAgent={id => void navigate(`/agent/${id}`)}
          onDeleteAgent={setConfirmDelete}
        />
        {routeAgentId ? (
          // Keyed so switching agents resets the chat's local state instead of reusing it.
          <ChatPanel key={routeAgentId} agentId={routeAgentId} />
        ) : selectedAgentType ? (
          <AgentTypeDetail
            agentType={selectedAgentType}
            runningAgents={agentList.filter(agent => agent.agentType === selectedAgentType.type)}
            launching={launchingType === selectedAgentType.type}
            onLaunch={() => void handleLaunch(selectedAgentType.type)}
            onOpenAgent={id => void navigate(`/agent/${id}`)}
          />
        ) : (
          <AgentsOverview
            agents={agents}
            hasAgentTypes={agentTypeList.length > 0}
            workflows={workflows.data ?? []}
            spawningWorkflow={spawningWorkflow}
            onSpawnWorkflow={name => void handleSpawnWorkflow(name)}
          />
        )}
      </ResizableSplit>

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
