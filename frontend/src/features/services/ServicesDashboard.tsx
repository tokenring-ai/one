import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Check,
  ChevronDown,
  ChevronRight,
  Cpu,
  Flame,
  Loader2,
  Plug,
  Power,
  PowerOff,
  RefreshCw,
  ScrollText,
  Search,
  User,
  Wrench,
  X,
  Zap,
} from "lucide-react";
import type React from "react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import {
  chatRPCClient,
  lifecycleRPCClient,
  useAgentList,
  useAppLogs,
  useAvailableHooks,
  useAvailableTools,
  useChatModelsByProvider,
  useEnabledHooks,
  useEnabledTools,
} from "../../rpc.ts";

type Tab = "tools" | "models" | "hooks" | "logs";
type ModelFilter = "all" | "available" | "unavailable" | "hot";
type LogLevelFilter = "all" | "info" | "error";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "tools", label: "Tools", icon: <Wrench className="w-3.5 h-3.5" /> },
  { id: "models", label: "Models", icon: <Cpu className="w-3.5 h-3.5" /> },
  { id: "hooks", label: "Hooks", icon: <Zap className="w-3.5 h-3.5" /> },
  { id: "logs", label: "Logs", icon: <ScrollText className="w-3.5 h-3.5" /> },
];

function categoryFromDisplayName(displayName: string): { category: string; shortName: string } {
  const match = displayName.match(/^(.*)\/(.*)$/);
  if (match) {
    return { category: match[1] || "Other", shortName: match[2] || displayName };
  }
  return { category: "Other", shortName: displayName };
}

function SearchField({
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  "aria-label": string;
}) {
  return (
    <div className="relative w-full max-w-xs">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
      <input
        type="search"
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="w-full bg-input border border-primary rounded-md py-1.5 pl-8 pr-8 text-xs text-primary placeholder-muted focus-ring"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 rounded text-muted hover:text-primary focus-ring"
          aria-label="Clear search"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      ) : null}
    </div>
  );
}

function AgentContextBar({
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
            <button type="button" onClick={() => void agents.mutate()} className="underline-offset-2 hover:underline focus-ring rounded text-accent">
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
            className="text-xs bg-input border border-primary rounded-md px-2 py-1.5 text-primary focus-ring max-w-56"
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
      {enabledLabel ? (
        <span className="text-xs px-2 py-0.5 bg-violet-500/10 text-violet-600 dark:text-violet-400 border border-violet-500/30 rounded-full">
          {enabledLabel}
        </span>
      ) : null}
    </div>
  );
}

export default function ServicesDashboard() {
  const [activeTab, setActiveTab] = useState<Tab>("tools");
  const [selectedAgentId, setSelectedAgentId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [modelFilter, setModelFilter] = useState<ModelFilter>("all");
  const [logLevelFilter, setLogLevelFilter] = useState<LogLevelFilter>("all");
  const [autoScrollLogs, setAutoScrollLogs] = useState(true);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const agents = useAgentList();
  const availableTools = useAvailableTools();
  const modelsByProvider = useChatModelsByProvider();
  const availableHooks = useAvailableHooks();
  const appLogs = useAppLogs({ enabled: activeTab === "logs" });
  const enabledTools = useEnabledTools(selectedAgentId ?? undefined);
  const enabledHooks = useEnabledHooks(selectedAgentId ?? undefined);

  useEffect(() => {
    const list = agents.data ?? [];
    if (list.length === 0) {
      setSelectedAgentId(null);
      return;
    }
    if (!selectedAgentId || !list.some(a => a.id === selectedAgentId)) {
      setSelectedAgentId(list[0]!.id);
    }
  }, [agents.data, selectedAgentId]);

  // Reset search when switching tabs so filters don't surprise users.
  useEffect(() => {
    setSearchQuery("");
  }, [activeTab]);

  const enabledToolNames = useMemo(() => {
    if (enabledTools.data?.status !== "success") return new Set<string>();
    return new Set(enabledTools.data.tools);
  }, [enabledTools.data]);

  const enabledHookNames = useMemo(() => {
    if (enabledHooks.data?.status !== "success") return new Set<string>();
    return new Set(enabledHooks.data.hooks);
  }, [enabledHooks.data]);

  const refreshActive = useCallback(async () => {
    const jobs: Promise<unknown>[] = [agents.mutate()];
    switch (activeTab) {
      case "tools":
        jobs.push(availableTools.mutate(), enabledTools.mutate());
        break;
      case "models":
        jobs.push(modelsByProvider.mutate());
        break;
      case "hooks":
        jobs.push(availableHooks.mutate(), enabledHooks.mutate());
        break;
      case "logs":
        jobs.push(appLogs.mutate());
        break;
      default: {
        const exhaustive: string = activeTab satisfies never;
        throw new Error(`Unhandled activeTab: ${exhaustive}`);
      }
    }
    await Promise.all(jobs);
  }, [activeTab, agents, availableTools, enabledTools, modelsByProvider, availableHooks, enabledHooks, appLogs]);

  const handleAgentGone = useCallback(async () => {
    toastManager.error("Agent no longer exists", { duration: 4000 });
    // Refresh agent list; selection effect drops a missing agent automatically.
    await agents.mutate();
  }, [agents]);

  const handleToggleTool = async (toolName: string) => {
    if (!selectedAgentId) {
      toastManager.warning("Select an agent to enable or disable tools", { duration: 3000 });
      return;
    }
    setBusyAction(`tool:${toolName}`);
    try {
      const isEnabled = enabledToolNames.has(toolName);
      const result = isEnabled
        ? await chatRPCClient.disableTools({ agentId: selectedAgentId, tools: [toolName] })
        : await chatRPCClient.enableTools({ agentId: selectedAgentId, tools: [toolName] });
      if (result.status === "agentNotFound") {
        await handleAgentGone();
        return;
      }
      await enabledTools.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleCategoryTools = async (toolNames: string[]) => {
    if (!selectedAgentId || toolNames.length === 0) return;
    setBusyAction(`cat:${toolNames[0]}`);
    try {
      const allEnabled = toolNames.every(n => enabledToolNames.has(n));
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
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleHook = async (hookName: string) => {
    if (!selectedAgentId) {
      toastManager.warning("Select an agent to enable or disable hooks", { duration: 3000 });
      return;
    }
    setBusyAction(`hook:${hookName}`);
    try {
      const isEnabled = enabledHookNames.has(hookName);
      const result = isEnabled
        ? await lifecycleRPCClient.disableHooks({ agentId: selectedAgentId, hooks: [hookName] })
        : await lifecycleRPCClient.enableHooks({ agentId: selectedAgentId, hooks: [hookName] });
      if (result.status === "agentNotFound") {
        await handleAgentGone();
        return;
      }
      await enabledHooks.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const handleToggleAllHooks = async () => {
    if (!selectedAgentId) return;
    const allNames = Object.keys(availableHooks.data?.hooks ?? {});
    if (allNames.length === 0) return;
    setBusyAction("hooks:all");
    try {
      const allEnabled = allNames.every(n => enabledHookNames.has(n));
      const result = allEnabled
        ? await lifecycleRPCClient.disableHooks({ agentId: selectedAgentId, hooks: allNames })
        : await lifecycleRPCClient.enableHooks({ agentId: selectedAgentId, hooks: allNames });
      if (result.status === "agentNotFound") {
        await handleAgentGone();
        return;
      }
      await enabledHooks.mutate();
    } catch (error: unknown) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Services"
        subtitle="Browse and manage tools, models, lifecycle hooks, and app logs"
        icon={<Plug className="w-4 h-4" />}
        iconGradient="from-violet-500 to-purple-600"
      >
        <button
          type="button"
          onClick={() => void refreshActive()}
          disabled={busyAction !== null}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary hover:bg-hover border border-primary transition-colors focus-ring disabled:opacity-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </AppPageHeader>

      <div className="shrink-0 border-b border-primary bg-secondary flex">
        {TABS.map(tab => (
          <button
            type="button"
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors focus-ring cursor-pointer -mb-px",
              activeTab === tab.id ? "border-accent text-primary" : "border-transparent text-muted hover:text-primary",
            )}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-4xl mx-auto">
          {activeTab === "tools" && (
            <ToolsTab
              tools={availableTools}
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              enabledSet={enabledToolNames}
              enabledLoading={Boolean(selectedAgentId) && enabledTools.isLoading}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              busyAction={busyAction}
              onToggleTool={name => void handleToggleTool(name)}
              onToggleCategory={names => void handleToggleCategoryTools(names)}
            />
          )}
          {activeTab === "models" && (
            <ModelsTab
              models={modelsByProvider}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              filter={modelFilter}
              onFilterChange={setModelFilter}
            />
          )}
          {activeTab === "hooks" && (
            <HooksTab
              hooks={availableHooks}
              agents={agents}
              selectedAgentId={selectedAgentId}
              onSelectAgent={setSelectedAgentId}
              enabledSet={enabledHookNames}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              busyAction={busyAction}
              onToggleHook={name => void handleToggleHook(name)}
              onToggleAll={() => void handleToggleAllHooks()}
            />
          )}
          {activeTab === "logs" && (
            <LogsTab
              logs={appLogs}
              searchQuery={searchQuery}
              onSearchChange={setSearchQuery}
              levelFilter={logLevelFilter}
              onLevelFilterChange={setLogLevelFilter}
              autoScroll={autoScrollLogs}
              onAutoScrollChange={setAutoScrollLogs}
            />
          )}
        </div>
      </div>
    </div>
  );
}

function ToolsTab({
  tools,
  agents,
  selectedAgentId,
  onSelectAgent,
  enabledSet,
  enabledLoading,
  searchQuery,
  onSearchChange,
  busyAction,
  onToggleTool,
  onToggleCategory,
}: {
  tools: ReturnType<typeof useAvailableTools>;
  agents: ReturnType<typeof useAgentList>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  enabledSet: Set<string>;
  enabledLoading: boolean;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  busyAction: string | null;
  onToggleTool: (name: string) => void;
  onToggleCategory: (names: string[]) => void;
}) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  // Only auto-expand on agent/search/catalog changes — not when the user toggles enable state.
  const autoExpandKeyRef = useRef<string>("");

  const toolRecord = tools.data?.tools;

  const filteredEntries = useMemo(() => {
    const entries = Object.entries(toolRecord ?? {});
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([name, tool]) => name.toLowerCase().includes(q) || tool.displayName.toLowerCase().includes(q));
  }, [toolRecord, searchQuery]);

  const grouped = useMemo(() => {
    const map: Record<string, { toolName: string; shortName: string }[]> = {};
    for (const [toolName, tool] of filteredEntries) {
      const { category, shortName } = categoryFromDisplayName(tool.displayName);
      (map[category] ??= []).push({ toolName, shortName });
    }
    for (const list of Object.values(map)) {
      list.sort((a, b) => a.shortName.localeCompare(b.shortName));
    }
    return map;
  }, [filteredEntries]);

  const categories = useMemo(() => Object.keys(grouped).sort((a, b) => a.localeCompare(b)), [grouped]);
  const total = Object.keys(toolRecord ?? {}).length;
  const totalPackages = useMemo(() => {
    const cats = new Set<string>();
    for (const tool of Object.values(toolRecord ?? {})) {
      cats.add(categoryFromDisplayName(tool.displayName).category);
    }
    return cats.size;
  }, [toolRecord]);
  const enabledCount = selectedAgentId ? [...enabledSet].filter(n => toolRecord?.[n]).length : 0;

  // Expand all categories when searching; otherwise expand packages with enabled tools (or first few).
  // Wait for enabled-tools stream so first paint uses real enable state; skip re-runs on toggles.
  useEffect(() => {
    if (categories.length === 0) return;

    if (searchQuery.trim()) {
      setExpanded(new Set(categories));
      autoExpandKeyRef.current = `search:${searchQuery}:${categories.join("\0")}`;
      return;
    }

    if (enabledLoading) {
      // Provisional expand while enable-state streams in; final pass runs once loading ends.
      const loadingKey = `loading|${selectedAgentId ?? "none"}|${categories.join("\0")}`;
      if (autoExpandKeyRef.current !== loadingKey) {
        autoExpandKeyRef.current = loadingKey;
        setExpanded(new Set(categories.slice(0, 3)));
      }
      return;
    }

    const key = `${selectedAgentId ?? "none"}|${categories.join("\0")}`;
    if (autoExpandKeyRef.current === key) return;
    autoExpandKeyRef.current = key;

    if (!selectedAgentId || enabledSet.size === 0) {
      setExpanded(new Set(categories.slice(0, 3)));
      return;
    }
    const withEnabled = new Set<string>();
    for (const [cat, items] of Object.entries(grouped)) {
      if (items.some(i => enabledSet.has(i.toolName))) withEnabled.add(cat);
    }
    setExpanded(withEnabled.size > 0 ? withEnabled : new Set(categories.slice(0, 3)));
  }, [searchQuery, categories, selectedAgentId, enabledSet, grouped, enabledLoading]);

  if (tools.isLoading && !toolRecord) {
    return <LoadingState message="Loading tools…" className="py-16" />;
  }

  if (tools.error) {
    return <ErrorState title="Failed to load tools" error={tools.error} onRetry={() => void tools.mutate()} variant="inline" className="py-6" />;
  }

  if (!toolRecord || total === 0) {
    return (
      <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
        <Wrench className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-secondary mb-1">No tools available</p>
        <p className="text-xs text-muted max-w-sm mx-auto">Install plugins that register chat tools to see them here.</p>
      </div>
    );
  }

  const toggleExpand = (cat: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-4">
      <AgentContextBar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelect={onSelectAgent}
        enabledLabel={selectedAgentId ? `${enabledCount} of ${total} enabled` : undefined}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-xs text-muted px-1">
          {total} tools across {totalPackages} {totalPackages === 1 ? "package" : "packages"}
          {searchQuery.trim() ? ` · ${filteredEntries.length} ${filteredEntries.length === 1 ? "match" : "matches"}` : ""}
        </p>
        <SearchField value={searchQuery} onChange={onSearchChange} placeholder="Filter tools…" aria-label="Filter tools" />
      </div>

      {filteredEntries.length === 0 ? (
        <div className="px-6 py-10 bg-secondary border border-primary border-dashed rounded-xl text-center">
          <p className="text-sm text-muted">No tools match “{searchQuery}”</p>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map(category => {
            const items = grouped[category] ?? [];
            const isOpen = expanded.has(category);
            const catEnabled = items.filter(i => enabledSet.has(i.toolName)).length;
            const allCatEnabled = items.length > 0 && catEnabled === items.length;
            return (
              <div key={category} className="bg-secondary border border-primary rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-tertiary/50 border-b border-primary">
                  <button
                    type="button"
                    onClick={() => toggleExpand(category)}
                    className="flex items-center gap-2 flex-1 min-w-0 text-left focus-ring rounded-md cursor-pointer"
                    aria-expanded={isOpen}
                  >
                    {isOpen ? <ChevronDown className="w-3.5 h-3.5 text-muted shrink-0" /> : <ChevronRight className="w-3.5 h-3.5 text-muted shrink-0" />}
                    <span className="text-xs font-semibold text-primary font-mono truncate">{category}</span>
                    <span className="text-xs text-muted shrink-0">
                      {items.length} tools
                      {selectedAgentId ? ` · ${catEnabled} on` : ""}
                    </span>
                  </button>
                  {selectedAgentId ? (
                    <button
                      type="button"
                      onClick={() => onToggleCategory(items.map(i => i.toolName))}
                      disabled={busyAction !== null}
                      className="text-xs px-2 py-1 rounded-md border border-primary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                      title={allCatEnabled ? "Disable all in package" : "Enable all in package"}
                    >
                      {allCatEnabled ? "Disable all" : "Enable all"}
                    </button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="divide-y divide-primary">
                    {items.map(({ toolName, shortName }) => {
                      const isEnabled = enabledSet.has(toolName);
                      const isBusy = busyAction === `tool:${toolName}`;
                      return (
                        <div key={toolName} className="flex items-center gap-3 px-4 py-2 hover:bg-hover/40 transition-colors">
                          <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", isEnabled && selectedAgentId ? "bg-violet-500" : "bg-muted/50")} />
                          <div className="flex-1 min-w-0">
                            <div className="text-xs font-mono text-primary truncate" title={toolName}>
                              {shortName}
                            </div>
                            <div className="text-xs text-muted font-mono truncate" title={toolName}>
                              {toolName}
                            </div>
                          </div>
                          {selectedAgentId ? (
                            <button
                              type="button"
                              onClick={() => onToggleTool(toolName)}
                              disabled={isBusy || busyAction !== null}
                              className={cn(
                                "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors focus-ring disabled:opacity-50",
                                isEnabled
                                  ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                                  : "bg-tertiary text-muted border-primary hover:text-primary hover:bg-hover",
                              )}
                              aria-pressed={isEnabled}
                              aria-label={isEnabled ? `Disable ${shortName}` : `Enable ${shortName}`}
                            >
                              {isBusy ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : isEnabled ? (
                                <Power className="w-3 h-3" />
                              ) : (
                                <PowerOff className="w-3 h-3" />
                              )}
                              {isEnabled ? "On" : "Off"}
                            </button>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ModelsTab({
  models,
  searchQuery,
  onSearchChange,
  filter,
  onFilterChange,
}: {
  models: ReturnType<typeof useChatModelsByProvider>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  filter: ModelFilter;
  onFilterChange: (f: ModelFilter) => void;
}) {
  const providerMap = models.data?.modelsByProvider;

  const stats = useMemo(() => {
    let total = 0;
    let available = 0;
    let hot = 0;
    for (const record of Object.values(providerMap ?? {})) {
      for (const info of Object.values(record)) {
        total += 1;
        if (info.available) available += 1;
        if (info.hot) hot += 1;
      }
    }
    return { total, available, hot, unavailable: total - available };
  }, [providerMap]);

  const filteredProviders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const result: { provider: string; models: [string, { status: string; available: boolean; hot: boolean }][] }[] = [];
    for (const [provider, record] of Object.entries(providerMap ?? {})) {
      const modelsList = Object.entries(record)
        .filter(([modelId, info]) => {
          if (filter === "available" && !info.available) return false;
          if (filter === "unavailable" && info.available) return false;
          if (filter === "hot" && !info.hot) return false;
          if (!q) return true;
          return modelId.toLowerCase().includes(q) || provider.toLowerCase().includes(q) || info.status.toLowerCase().includes(q);
        })
        .sort(([a], [b]) => a.localeCompare(b));
      if (modelsList.length > 0) {
        result.push({ provider, models: modelsList });
      }
    }
    result.sort((a, b) => a.provider.localeCompare(b.provider));
    return result;
  }, [providerMap, searchQuery, filter]);

  if (models.isLoading && !providerMap) {
    return <LoadingState message="Loading models…" className="py-16" />;
  }

  if (models.error) {
    return <ErrorState title="Failed to load models" error={models.error} onRetry={() => void models.mutate()} variant="inline" className="py-6" />;
  }

  if (!providerMap || stats.total === 0) {
    return (
      <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
        <Cpu className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-secondary mb-1">No models available</p>
        <p className="text-xs text-muted max-w-sm mx-auto">Configure AI providers in Configuration to register chat models.</p>
      </div>
    );
  }

  const filterOptions: { id: ModelFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: stats.total },
    { id: "available", label: "Available", count: stats.available },
    { id: "unavailable", label: "Unavailable", count: stats.unavailable },
    { id: "hot", label: "Hot", count: stats.hot },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-wrap gap-1.5">
          {filterOptions.map(opt => (
            <button
              type="button"
              key={opt.id}
              onClick={() => onFilterChange(opt.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-ring",
                filter === opt.id
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40"
                  : "bg-secondary text-muted border-primary hover:text-primary",
              )}
            >
              {opt.label}
              <span className="ml-1 font-mono opacity-80">{opt.count}</span>
            </button>
          ))}
        </div>
        <SearchField value={searchQuery} onChange={onSearchChange} placeholder="Filter models…" aria-label="Filter models" />
      </div>

      {filteredProviders.length === 0 ? (
        <div className="px-6 py-10 bg-secondary border border-primary border-dashed rounded-xl text-center">
          <p className="text-sm text-muted">No models match the current filters</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredProviders.map(({ provider, models: modelList }) => (
            <div key={provider} className="bg-secondary border border-primary rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-tertiary/50 border-b border-primary flex items-center justify-between">
                <span className="text-xs font-semibold text-primary capitalize">{provider}</span>
                <span className="text-xs text-muted">{modelList.length} models</span>
              </div>
              <div className="p-2 space-y-0.5">
                {modelList.map(([modelId, modelInfo]) => (
                  <div key={modelId} className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-hover transition-colors">
                    <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", modelInfo.available ? "bg-emerald-500/70" : "bg-muted/50")} />
                    <span className="text-xs font-mono text-primary truncate" title={modelId}>
                      {modelId.split("/").pop()}
                    </span>
                    {modelInfo.hot ? (
                      <span className="inline-flex items-center gap-0.5 text-xs text-amber-600 dark:text-amber-400 shrink-0" title="Hot model">
                        <Flame className="w-3 h-3" />
                        hot
                      </span>
                    ) : null}
                    <span className="text-xs text-muted ml-auto shrink-0">{modelInfo.status}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function HooksTab({
  hooks,
  agents,
  selectedAgentId,
  onSelectAgent,
  enabledSet,
  searchQuery,
  onSearchChange,
  busyAction,
  onToggleHook,
  onToggleAll,
}: {
  hooks: ReturnType<typeof useAvailableHooks>;
  agents: ReturnType<typeof useAgentList>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  enabledSet: Set<string>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  busyAction: string | null;
  onToggleHook: (name: string) => void;
  onToggleAll: () => void;
}) {
  const hookRecord = hooks.data?.hooks;
  const total = Object.keys(hookRecord ?? {}).length;
  const enabledCount = selectedAgentId ? [...enabledSet].filter(n => hookRecord?.[n]).length : 0;
  const allEnabled = total > 0 && enabledCount === total;

  const filtered = useMemo(() => {
    const entries = Object.entries(hookRecord ?? {});
    if (!searchQuery.trim()) return entries.sort(([a], [b]) => a.localeCompare(b));
    const q = searchQuery.toLowerCase();
    return entries
      .filter(
        ([name, info]) => name.toLowerCase().includes(q) || info.displayName.toLowerCase().includes(q) || (info.description ?? "").toLowerCase().includes(q),
      )
      .sort(([a], [b]) => a.localeCompare(b));
  }, [hookRecord, searchQuery]);

  if (hooks.isLoading && !hookRecord) {
    return <LoadingState message="Loading lifecycle hooks…" className="py-16" />;
  }

  if (hooks.error) {
    return <ErrorState title="Failed to load hooks" error={hooks.error} onRetry={() => void hooks.mutate()} variant="inline" className="py-6" />;
  }

  if (!hookRecord || total === 0) {
    return (
      <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
        <Zap className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-secondary mb-1">No lifecycle hooks available</p>
        <p className="text-xs text-muted max-w-sm mx-auto">Plugins register hooks that run around agent lifecycle events.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <AgentContextBar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelect={onSelectAgent}
        enabledLabel={selectedAgentId ? `${enabledCount} of ${total} enabled` : undefined}
      />

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <p className="text-xs text-muted px-1">
            {total} lifecycle hooks
            {searchQuery.trim() ? ` · ${filtered.length} match` : ""}
          </p>
          {selectedAgentId && total > 1 ? (
            <button
              type="button"
              onClick={onToggleAll}
              disabled={busyAction !== null}
              className="text-xs px-2 py-1 rounded-md border border-primary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
            >
              {busyAction === "hooks:all" ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              {allEnabled ? "Disable all" : "Enable all"}
            </button>
          ) : null}
        </div>
        <SearchField value={searchQuery} onChange={onSearchChange} placeholder="Filter hooks…" aria-label="Filter hooks" />
      </div>

      {filtered.length === 0 ? (
        <div className="px-6 py-10 bg-secondary border border-primary border-dashed rounded-xl text-center">
          <p className="text-sm text-muted">No hooks match “{searchQuery}”</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(([hookName, hookInfo]) => {
            const isEnabled = enabledSet.has(hookName);
            const isBusy = busyAction === `hook:${hookName}`;
            return (
              <div
                key={hookName}
                className="flex items-start gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl hover:border-violet-500/30 transition-colors"
              >
                <div className={cn("w-2 h-2 rounded-full shrink-0 mt-1.5", isEnabled && selectedAgentId ? "bg-violet-500" : "bg-muted/50")} />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-mono font-medium text-primary">{hookInfo.displayName || hookName}</div>
                  {hookInfo.description ? <div className="text-xs text-muted mt-0.5">{hookInfo.description}</div> : null}
                  <div className="text-xs text-dim font-mono mt-0.5 truncate" title={hookName}>
                    {hookName}
                  </div>
                </div>
                {selectedAgentId ? (
                  <button
                    type="button"
                    onClick={() => onToggleHook(hookName)}
                    disabled={isBusy || busyAction !== null}
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium border transition-colors focus-ring disabled:opacity-50 shrink-0 mt-0.5",
                      isEnabled
                        ? "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/30 hover:bg-violet-500/20"
                        : "bg-tertiary text-muted border-primary hover:text-primary hover:bg-hover",
                    )}
                    aria-pressed={isEnabled}
                    aria-label={isEnabled ? `Disable ${hookInfo.displayName || hookName}` : `Enable ${hookInfo.displayName || hookName}`}
                  >
                    {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : isEnabled ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />}
                    {isEnabled ? "On" : "Off"}
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function LogsTab({
  logs,
  searchQuery,
  onSearchChange,
  levelFilter,
  onLevelFilterChange,
  autoScroll,
  onAutoScrollChange,
}: {
  logs: ReturnType<typeof useAppLogs>;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  levelFilter: LogLevelFilter;
  onLevelFilterChange: (f: LogLevelFilter) => void;
  autoScroll: boolean;
  onAutoScrollChange: (v: boolean) => void;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const entries = logs.data?.logs ?? [];

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return entries.filter(entry => {
      if (levelFilter !== "all" && entry.level !== levelFilter) return false;
      if (!q) return true;
      return entry.message.toLowerCase().includes(q) || entry.level.includes(q);
    });
  }, [entries, searchQuery, levelFilter]);

  const errorCount = useMemo(() => entries.filter(e => e.level === "error").length, [entries]);

  // Scroll only the log list container — scrollIntoView can jump the whole page.
  useEffect(() => {
    if (!autoScroll) return;
    const el = listRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, autoScroll]);

  if (logs.isLoading && entries.length === 0) {
    return <LoadingState message="Connecting to app logs…" className="py-16" />;
  }

  if (logs.error && entries.length === 0) {
    return <ErrorState title="Failed to stream logs" error={logs.error} onRetry={() => void logs.mutate()} variant="inline" className="py-6" />;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
        <div className="flex flex-wrap items-center gap-1.5">
          {(
            [
              { id: "all" as const, label: "All", count: entries.length },
              { id: "info" as const, label: "Info", count: entries.length - errorCount },
              { id: "error" as const, label: "Error", count: errorCount },
            ] as const
          ).map(opt => (
            <button
              type="button"
              key={opt.id}
              onClick={() => onLevelFilterChange(opt.id)}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-ring",
                levelFilter === opt.id
                  ? opt.id === "error"
                    ? "bg-red-500/15 text-red-500 border-red-500/40"
                    : "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40"
                  : "bg-secondary text-muted border-primary hover:text-primary",
              )}
            >
              {opt.label}
              <span className="ml-1 font-mono opacity-80">{opt.count}</span>
            </button>
          ))}
          <button
            type="button"
            onClick={() => onAutoScrollChange(!autoScroll)}
            className={cn(
              "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-ring ml-1",
              autoScroll ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-secondary text-muted border-primary",
            )}
            aria-pressed={autoScroll}
          >
            {autoScroll ? "Live scroll on" : "Live scroll off"}
          </button>
        </div>
        <SearchField value={searchQuery} onChange={onSearchChange} placeholder="Filter log messages…" aria-label="Filter logs" />
      </div>

      <p className="text-xs text-muted px-1">
        {entries.length} log {entries.length === 1 ? "entry" : "entries"}
        {filtered.length !== entries.length ? ` · showing ${filtered.length}` : ""}
        {logs.isLoading || logs.isValidating ? " · streaming…" : ""}
      </p>

      <div className="bg-secondary border border-primary rounded-xl overflow-hidden">
        <div ref={listRef} className="font-mono text-xs divide-y divide-primary max-h-[min(70vh,720px)] overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="text-muted text-center py-8">{entries.length === 0 ? "No log entries yet" : "No logs match the current filters"}</p>
          ) : (
            filtered.map((entry, i) => (
              <div
                key={`${entry.timestamp}-${i}`}
                className={cn("flex gap-3 px-3 py-1.5", entry.level === "error" ? "bg-red-500/5 text-red-400" : "text-muted hover:text-primary")}
              >
                <span className="shrink-0 text-muted/60 tabular-nums">{new Date(entry.timestamp).toLocaleTimeString()}</span>
                <span className={cn("shrink-0 uppercase font-semibold w-10", entry.level === "error" ? "text-red-400" : "text-emerald-500/70")}>
                  {entry.level}
                </span>
                <span className="break-all">{entry.message}</span>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
