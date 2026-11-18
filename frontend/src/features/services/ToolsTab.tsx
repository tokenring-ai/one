import { ChevronDown, ChevronRight, Search, Wrench } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import EnableToggle from "../../components/ui/EnableToggle.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { useExpandedSet } from "../../hooks/useExpandedSet.ts";
import { cn } from "../../lib/utils.ts";
import type { useAgentList, useAvailableTools } from "../../rpc.ts";
import { AgentContextBar, categoryFromDisplayName, EnabledStateError, SelectAgentHint, ServicesEmptyActions } from "./servicesShared.tsx";

export default function ToolsTab({
  tools,
  agents,
  selectedAgentId,
  onSelectAgent,
  enabledSet,
  enabledLoading,
  enabledError,
  onRetryEnabled,
  searchQuery,
  onSearchChange,
  busyAction,
  onToggleTool,
  onToggleCategory,
  enabledOnly = false,
  onEnabledOnlyChange,
  agentSettings,
}: {
  tools: ReturnType<typeof useAvailableTools>;
  agents: ReturnType<typeof useAgentList>;
  selectedAgentId: string | null;
  onSelectAgent: (id: string | null) => void;
  enabledSet: Set<string>;
  enabledLoading: boolean;
  /** Set when the selected agent's enabled-tools stream failed. */
  enabledError?: Error | undefined;
  onRetryEnabled?: (() => void) | undefined;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  busyAction: string | null;
  onToggleTool: (name: string) => void;
  onToggleCategory: (names: string[]) => void;
  /** Show only the tools the selected agent has enabled. Ignored without an agent. */
  enabledOnly?: boolean | undefined;
  onEnabledOnlyChange?: ((enabledOnly: boolean) => void) | undefined;
  /** Per-agent controls rendered under the agent bar (tool approval). */
  agentSettings?: ReactNode | undefined;
}) {
  const { isExpanded, toggle: toggleExpand, expandAll } = useExpandedSet();
  // Only auto-expand on agent/search/catalog changes — not when the user toggles enable state.
  const autoExpandKeyRef = useRef<string>("");

  const toolRecord = tools.data?.tools;

  const onlyEnabled = enabledOnly && Boolean(selectedAgentId);

  const filteredEntries = useMemo(() => {
    let entries = Object.entries(toolRecord ?? {});
    if (onlyEnabled) entries = entries.filter(([name]) => enabledSet.has(name));
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      ([name, tool]) => name.toLowerCase().includes(q) || tool.displayName.toLowerCase().includes(q) || tool.description.toLowerCase().includes(q),
    );
  }, [toolRecord, searchQuery, onlyEnabled, enabledSet]);

  const filtering = Boolean(searchQuery.trim()) || onlyEnabled;

  const grouped = useMemo(() => {
    const map: Record<string, { toolName: string; shortName: string; description: string }[]> = {};
    for (const [toolName, tool] of filteredEntries) {
      const { category, shortName } = categoryFromDisplayName(tool.displayName);
      (map[category] ??= []).push({ toolName, shortName, description: tool.description });
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

    if (searchQuery.trim() || onlyEnabled) {
      expandAll(categories);
      autoExpandKeyRef.current = `search:${searchQuery}:${onlyEnabled}:${categories.join("\0")}`;
      return;
    }

    if (enabledLoading) {
      // Provisional expand while enable-state streams in; final pass runs once loading ends.
      const loadingKey = `loading|${selectedAgentId ?? "none"}|${categories.join("\0")}`;
      if (autoExpandKeyRef.current !== loadingKey) {
        autoExpandKeyRef.current = loadingKey;
        expandAll(categories.slice(0, 3));
      }
      return;
    }

    const key = `${selectedAgentId ?? "none"}|${categories.join("\0")}`;
    if (autoExpandKeyRef.current === key) return;
    autoExpandKeyRef.current = key;

    if (!selectedAgentId || enabledSet.size === 0) {
      expandAll(categories.slice(0, 3));
      return;
    }
    const withEnabled: string[] = [];
    for (const [cat, items] of Object.entries(grouped)) {
      if (items.some(i => enabledSet.has(i.toolName))) withEnabled.push(cat);
    }
    expandAll(withEnabled.length > 0 ? withEnabled : categories.slice(0, 3));
  }, [searchQuery, onlyEnabled, categories, selectedAgentId, enabledSet, grouped, enabledLoading, expandAll]);

  if (tools.isLoading && !toolRecord) {
    return <LoadingState message="Loading tools…" className="py-16" />;
  }

  if (tools.error) {
    return <ErrorState title="Failed to load tools" error={tools.error} onRetry={() => void tools.mutate()} variant="inline" className="py-6" />;
  }

  if (!toolRecord || total === 0) {
    return (
      <EmptyState
        variant="card"
        icon={Wrench}
        title="No tools available"
        hint="Tools are actions agents can call — read files, run commands, search the web. Plugins register them; enable the plugins that provide them in Configuration."
        action={<ServicesEmptyActions />}
      />
    );
  }

  // Until the agent's enable state has arrived (or when it failed) the toggles would show a guess.
  const enabledUnknown = Boolean(selectedAgentId) && (enabledLoading || enabledError !== undefined);

  return (
    <div className="space-y-4">
      <AgentContextBar
        agents={agents}
        selectedAgentId={selectedAgentId}
        onSelect={onSelectAgent}
        enabledLabel={selectedAgentId ? `${enabledCount} of ${total} enabled` : undefined}
      />

      {selectedAgentId && enabledError ? <EnabledStateError what="tools" error={enabledError} onRetry={() => onRetryEnabled?.()} /> : null}
      {selectedAgentId ? null : <SelectAgentHint what="tools" />}
      {selectedAgentId ? agentSettings : null}

      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-xs text-muted px-1">
            {total} tools across {totalPackages} {totalPackages === 1 ? "package" : "packages"}
            {filtering ? ` · ${filteredEntries.length} ${filteredEntries.length === 1 ? "match" : "matches"}` : ""}
          </p>
          {onEnabledOnlyChange ? (
            <button
              type="button"
              aria-pressed={onlyEnabled}
              onClick={() => onEnabledOnlyChange(!enabledOnly)}
              disabled={!selectedAgentId}
              title={selectedAgentId ? "Show only the tools this agent has enabled" : "Select an agent to filter by enabled tools"}
              className={cn(
                "px-2.5 py-1 rounded-full text-xs font-medium border transition-colors focus-ring disabled:opacity-50",
                onlyEnabled
                  ? "bg-violet-500/15 text-violet-600 dark:text-violet-400 border-violet-500/40"
                  : "bg-secondary text-muted border-primary hover:text-primary",
              )}
            >
              Enabled only
              {selectedAgentId ? <span className="ml-1 font-mono">{enabledCount}</span> : null}
            </button>
          ) : null}
        </div>
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Filter tools…" aria-label="Filter tools" className="w-full max-w-xs" />
      </div>

      {filteredEntries.length === 0 ? (
        <EmptyState
          variant="card"
          icon={Search}
          title={searchQuery.trim() ? `No tools match “${searchQuery}”` : "No tools are enabled for this agent"}
          {...(onlyEnabled ? { hint: "Turn off “Enabled only” to see every tool." } : {})}
        />
      ) : (
        <div className="space-y-2">
          {categories.map(category => {
            const items = grouped[category] ?? [];
            const isOpen = isExpanded(category);
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
                      disabled={busyAction !== null || enabledUnknown}
                      className="text-xs px-2 py-1 rounded-md border border-primary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
                      title={allCatEnabled ? "Disable all in package" : "Enable all in package"}
                    >
                      {allCatEnabled ? "Disable all" : "Enable all"}
                    </button>
                  ) : null}
                </div>
                {isOpen ? (
                  <div className="divide-y divide-primary">
                    {items.map(({ toolName, shortName, description }) => {
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
                            {description ? (
                              <p className="text-xs text-muted line-clamp-2 mt-0.5" title={description}>
                                {description}
                              </p>
                            ) : null}
                          </div>
                          {selectedAgentId ? (
                            <EnableToggle
                              enabled={isEnabled}
                              onToggle={() => onToggleTool(toolName)}
                              loading={isBusy || (enabledLoading && !enabledError)}
                              disabled={busyAction !== null || enabledUnknown}
                              itemName={shortName}
                            />
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
