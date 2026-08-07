import formatError from "@tokenring-ai/utility/error/formatError";
import { Cpu, Glasses, Loader2, Pause, Play, Trash2, User, Wrench } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import AgentTodoList from "../../components/AgentTodoList.tsx";
import CheckpointBrowser from "../../components/CheckpointBrowser.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import SidebarCategoryAccordion from "../../components/layout/SidebarCategoryAccordion.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { agentRPCClient, useAgentList, useAgentTypes } from "../../rpc.ts";

/** Fallback group for agent types whose config omits a category. */
const UNCATEGORIZED = "Uncategorized";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface AgentType {
  type: string;
  displayName: string;
  description: string;
  category?: string;
  enabledTools?: string[];
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

/** Active (non-idle) agents first, then newest. */
function sortRunningAgents(agents: RunningAgent[]): RunningAgent[] {
  return [...agents].sort((a, b) => {
    if (a.idle !== b.idle) return a.idle ? 1 : -1;
    return b.createdAt - a.createdAt;
  });
}

function matchesTypeFilter(agentType: AgentType, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return (
    agentType.displayName.toLowerCase().includes(q) ||
    agentType.type.toLowerCase().includes(q) ||
    agentType.description.toLowerCase().includes(q) ||
    agentType.category?.toLowerCase().includes(q) ||
    false
  );
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
  onGoOverview,
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
  onGoOverview: () => void;
}) {
  const sortedAgents = useMemo(() => sortRunningAgents(agents), [agents]);

  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <NavigationSidebarHeader
        title={
          <button
            type="button"
            onClick={onGoOverview}
            className="w-full text-left text-xs font-bold text-muted uppercase tracking-widest px-1 hover:text-primary transition-colors cursor-pointer focus-ring rounded"
            title="Back to Agents overview"
          >
            Agents
          </button>
        }
      />

      <div className="flex-1 overflow-y-auto">
        {/* Running agents, with their live todo lists */}
        <div className="border-b border-primary/50">
          <div className="flex items-center justify-between px-3 pt-2.5 pb-1">
            <span className="text-xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest">Running</span>
            <span className="text-xs text-muted" aria-live="polite">
              {agents.length} running
            </span>
          </div>
          {agentsLoading && agents.length === 0 ? (
            <LoadingState size="sm" className="py-6" />
          ) : agentsError && agents.length === 0 ? (
            <ErrorState title="Failed to load agents" error={agentsError} onRetry={onRetryAgents} variant="inline" />
          ) : agents.length === 0 ? (
            <div className="px-3 py-4 text-center text-muted text-xs italic">No active agents</div>
          ) : (
            sortedAgents.map(agent => {
              const isSelected = selectedAgentId === agent.id;
              return (
                <div
                  key={agent.id}
                  className={`group relative mx-1.5 my-2 rounded-md border transition-all ${
                    isSelected ? "bg-active border-primary" : "border-transparent hover:bg-[var(--bg-hover)] hover:border-primary/40"
                  }`}
                  aria-current={isSelected ? "page" : undefined}
                >
                  {/* Whole card (including todos) opens the agent; delete sits above it. */}
                  <button
                    type="button"
                    onClick={() => onOpenAgent(agent.id)}
                    className="w-full px-2 py-1.5 text-left cursor-pointer focus-ring rounded-md"
                    aria-label={`Open agent ${agent.displayName}`}
                    title={agent.currentActivity || agent.agentType}
                  >
                    <div className="flex items-center gap-2 pr-6">
                      <div className="shrink-0" aria-hidden="true">
                        {agent.idle ? (
                          <Pause className="w-3 h-3 text-muted" />
                        ) : (
                          <div className="w-3 h-3 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 flex flex-col">
                        <span className={`text-xs font-medium truncate ${isSelected ? "text-primary" : "text-secondary"}`}>{agent.displayName}</span>
                        <span className="text-xs text-muted truncate">{agent.currentActivity || agent.agentType}</span>
                      </div>
                    </div>
                    <AgentTodoList agentId={agent.id} agentName={agent.displayName} className="mt-1.5 ml-7 border-t border-primary/40 pt-1.5" />
                  </button>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteAgent(agent.id);
                    }}
                    disabled={deletingAgentId === agent.id}
                    className="absolute top-3 right-1.5 p-1 text-muted hover:text-red-500 rounded transition-colors opacity-0 group-hover:opacity-100 focus-visible:opacity-100 focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
                    aria-label={`Delete agent ${agent.displayName}`}
                  >
                    {deletingAgentId === agent.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <SidebarCategoryAccordion
          items={agentTypes}
          getCategory={agentType => agentType.category || UNCATEGORIZED}
          getItemKey={agentType => agentType.type}
          sectionTitle="Agent Types"
          showSectionCount
          isLoading={agentTypesLoading}
          error={agentTypesError}
          search={{
            placeholder: "Filter types…",
            ariaLabel: "Filter agent types",
            clearAriaLabel: "Clear type filter",
            match: matchesTypeFilter,
          }}
          loadingState={<LoadingState size="sm" className="py-6" />}
          errorState={<ErrorState title="Failed to load agent types" error={agentTypesError} onRetry={onRetryAgentTypes} variant="inline" />}
          emptyState={
            <div className="px-3 py-6 text-center">
              <User className="w-6 h-6 text-muted mx-auto mb-2 opacity-60" />
              <p className="text-xs text-muted">No agent types configured</p>
              <Link to="/configuration" className="inline-block mt-2 text-xs text-accent hover:text-accent-soft focus-ring rounded">
                Open Configuration
              </Link>
            </div>
          }
          noMatchState={query => <div className="px-3 py-4 text-center text-muted text-xs italic">No types match “{query}”</div>}
          renderItem={agentType => {
            const isSelected = selectedType === agentType.type;
            const isLaunching = launchingType === agentType.type;
            return (
              <div
                className={`group flex items-center gap-0.5 pl-5 pr-1.5 py-1 transition-colors ${
                  isSelected ? "bg-accent/30" : "hover:bg-accent/15 text-primary"
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
          }}
        />
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
  onBack,
}: {
  agentType: AgentType;
  runningAgents: RunningAgent[];
  launching: boolean;
  onLaunch: () => void;
  onOpenAgent: (id: string) => void;
  onBack: () => void;
}) {
  const enabledTools = agentType.enabledTools ?? [];

  return (
    <div className="h-full flex flex-col bg-primary">
      <AppPageHeader
        title={agentType.displayName || agentType.type}
        subtitle={
          <span className="flex items-center gap-2 text-xs text-muted">
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
          onClick={onBack}
          className="px-2.5 py-1.5 text-xs font-medium text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors cursor-pointer focus-ring"
        >
          Overview
        </button>
        <button
          type="button"
          onClick={onLaunch}
          disabled={launching}
          title="Start a new agent of this type"
          className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {launching ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
          {launching ? "Launching…" : "Launch"}
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-5">
          <div className="space-y-1">
            <span className="text-xs font-semibold text-muted uppercase tracking-wide">Description</span>
            <p className="text-xs text-secondary leading-relaxed">{agentType.description || "No description provided."}</p>
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide flex items-center gap-1.5">
                <Wrench className="w-3 h-3" /> Enabled tools
              </span>
              <span className="text-xs text-muted">{enabledTools.length} configured</span>
            </div>
            {enabledTools.length === 0 ? (
              <p className="text-xs text-muted italic">No tools are enabled for this agent type.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5">
                {enabledTools.map(tool => (
                  <span key={tool} className="px-2 py-1 bg-secondary border border-primary rounded-md text-xs font-mono text-secondary">
                    {tool}
                  </span>
                ))}
              </div>
            )}
          </div>

          {runningAgents.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Running agents of this type</span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {sortRunningAgents(runningAgents).map(agent => (
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
                      <div className="text-xs text-muted truncate">{agent.currentActivity || "Idle"}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <p className="text-xs text-muted border-t border-primary/60 pt-3">
            Agent types are read-only here — change them in the{" "}
            <Link to="/configuration" className="text-accent hover:text-accent-soft focus-ring rounded">
              Configuration
            </Link>{" "}
            app or in your TokenRing config files.
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
  agentTypesError,
  onRetryAgentTypes,
}: {
  agents: ReturnType<typeof useAgentList>;
  hasAgentTypes: boolean;
  agentTypesError: Error | undefined;
  onRetryAgentTypes: () => void;
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
          {agentTypesError && !hasAgentTypes ? (
            <ErrorState title="Failed to load agent types" error={agentTypesError} onRetry={onRetryAgentTypes} variant="page" className="py-8" />
          ) : (
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
                {!hasAgentTypes && (
                  <Link
                    to="/configuration"
                    className="inline-flex items-center gap-1.5 mt-1 px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring"
                  >
                    Open Configuration
                  </Link>
                )}
              </div>
            </div>
          )}

          <CheckpointBrowser agents={agents} />
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
  const [deletingAgentId, setDeletingAgentId] = useState<string | null>(null);
  const [launchingType, setLaunchingType] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  // Synchronous guards so double-clicks cannot start the same action twice before re-render disables the control.
  const launchingTypesRef = useRef(new Set<string>());
  const deletingAgentsRef = useRef(new Set<string>());

  const agentList = (agents.data ?? []) as RunningAgent[];
  const agentTypeList = (agentTypes.data ?? []) as AgentType[];

  const selectedAgentType = useMemo(
    () => (routeAgentType ? (agentTypeList.find(t => t.type === routeAgentType) ?? null) : null),
    [agentTypeList, routeAgentType],
  );

  const confirmDeleteAgent = useMemo(() => (confirmDeleteId ? (agentList.find(a => a.id === confirmDeleteId) ?? null) : null), [agentList, confirmDeleteId]);

  // A route pointing at an agent type that is no longer configured resets to the overview.
  useEffect(() => {
    if (routeAgentType && !agentTypes.isLoading && !agentTypes.error && agentTypeList.length > 0 && !selectedAgentType) {
      toastManager.error(`Agent type "${routeAgentType}" not found`, { duration: 4000 });
      void navigate("/agents", { replace: true });
    }
  }, [routeAgentType, selectedAgentType, agentTypeList.length, agentTypes.isLoading, agentTypes.error, navigate]);

  const handleGoOverview = useCallback(() => void navigate("/agents"), [navigate]);

  const handleSelectType = useCallback((type: string) => void navigate(`/agents/${encodeURIComponent(type)}`), [navigate]);

  const refreshAgents = useCallback(() => {
    // Sidebar refresh is best-effort; stream reconnect can fail without undoing the action.
    void Promise.resolve(agents.mutate()).catch(() => {});
  }, [agents]);

  const handleLaunch = useCallback(
    async (type: string) => {
      if (launchingTypesRef.current.has(type)) return;
      launchingTypesRef.current.add(type);
      setLaunchingType(type);
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: type, headless: false });
        // Refresh the sidebar list in the background; don't block navigation if reconnect is slow.
        refreshAgents();
        void navigate(`/agent/${id}`);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        launchingTypesRef.current.delete(type);
        // Only clear our own spinner — a concurrent launch of another type may own the flag.
        setLaunchingType(prev => (prev === type ? null : prev));
      }
    },
    [navigate, refreshAgents],
  );

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId || deletingAgentsRef.current.has(confirmDeleteId)) return;
    const agentId = confirmDeleteId;
    const displayName = confirmDeleteAgent?.displayName ?? agentId;
    deletingAgentsRef.current.add(agentId);
    setConfirmDeleteId(null);
    setDeletingAgentId(agentId);
    try {
      const result = await agentRPCClient.deleteAgent({ agentId, reason: "User initiated agent deletion from Agents app" });
      if (result.status === "agentNotFound") {
        toastManager.error(`Agent "${displayName}" is no longer running`, { duration: 4000 });
        refreshAgents();
        if (routeAgentId === agentId) void navigate("/agents");
        return;
      }
      toastManager.success(`Deleted "${displayName}"`, { duration: 3000 });
      // Leave the deleted chat before refreshing so the sidebar doesn't briefly re-highlight it.
      if (routeAgentId === agentId) void navigate("/agents");
      refreshAgents();
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      deletingAgentsRef.current.delete(agentId);
      setDeletingAgentId(prev => (prev === agentId ? null : prev));
    }
  }, [confirmDeleteAgent, confirmDeleteId, navigate, refreshAgents, routeAgentId]);

  const detailPane = (() => {
    if (routeAgentId) {
      // Keyed so switching agents resets the chat's local state instead of reusing it.
      return <ChatPanel key={routeAgentId} agentId={routeAgentId} />;
    }

    // Type route while types are still loading — avoid flashing the overview.
    if (routeAgentType && agentTypes.isLoading && !selectedAgentType) {
      return (
        <div className="h-full flex flex-col bg-primary">
          <LoadingState message="Loading agent type…" className="flex-1" />
        </div>
      );
    }

    if (routeAgentType && agentTypes.error && !selectedAgentType) {
      return (
        <div className="h-full flex flex-col bg-primary">
          <ErrorState title="Failed to load agent types" error={agentTypes.error} onRetry={() => void agentTypes.mutate()} variant="page" />
        </div>
      );
    }

    if (selectedAgentType) {
      return (
        <AgentTypeDetail
          agentType={selectedAgentType}
          runningAgents={agentList.filter(agent => agent.agentType === selectedAgentType.type)}
          launching={launchingType === selectedAgentType.type}
          onLaunch={() => void handleLaunch(selectedAgentType.type)}
          onOpenAgent={id => void navigate(`/agent/${id}`)}
          onBack={handleGoOverview}
        />
      );
    }

    return (
      <AgentsOverview
        agents={agents}
        hasAgentTypes={agentTypeList.length > 0}
        agentTypesError={agentTypes.error}
        onRetryAgentTypes={() => void agentTypes.mutate()}
      />
    );
  })();

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <WorkspaceShell
        appId="agents"
        title="Agents"
        navigationLabel="Agents and agent types"
        hasSelection={routeAgentId !== undefined || selectedAgentType !== null}
        className="flex-1"
        navigation={
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
            onDeleteAgent={setConfirmDeleteId}
            onGoOverview={handleGoOverview}
          />
        }
      >
        {detailPane}
      </WorkspaceShell>

      {confirmDeleteId && (
        <ConfirmDialog
          title="Delete Agent"
          message={
            confirmDeleteAgent
              ? `Are you sure you want to delete "${confirmDeleteAgent.displayName}"? This action cannot be undone.`
              : "Are you sure you want to delete this agent? This action cannot be undone."
          }
          confirmText="Delete"
          onConfirm={handleConfirmDelete}
          onCancel={() => setConfirmDeleteId(null)}
          variant="danger"
        />
      )}
    </div>
  );
}
