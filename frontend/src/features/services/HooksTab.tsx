import { Check, Loader2, Search, X, Zap } from "lucide-react";
import { useMemo } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import EnableToggle from "../../components/ui/EnableToggle.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { cn } from "../../lib/utils.ts";
import type { useAgentList, useAvailableHooks } from "../../rpc.ts";
import { AgentContextBar, EnabledStateError, SelectAgentHint, ServicesEmptyActions } from "./servicesShared.tsx";

export default function HooksTab({
  hooks,
  agents,
  selectedAgentId,
  onSelectAgent,
  enabledSet,
  enabledLoading = false,
  enabledError,
  onRetryEnabled,
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
  /** True while the selected agent's enabled-hooks stream has not delivered yet. */
  enabledLoading?: boolean | undefined;
  /** Set when the selected agent's enabled-hooks stream failed. */
  enabledError?: Error | undefined;
  onRetryEnabled?: (() => void) | undefined;
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
      <EmptyState
        variant="card"
        icon={Zap}
        title="No lifecycle hooks available"
        hint="Hooks run automatically around agent events — before a chat, after a tool call — to add things like checkpoints or memory. Plugins register them; enable those plugins in Configuration."
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

      {selectedAgentId && enabledError ? <EnabledStateError what="hooks" error={enabledError} onRetry={() => onRetryEnabled?.()} /> : null}
      {selectedAgentId ? null : <SelectAgentHint what="hooks" />}

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
              disabled={busyAction !== null || enabledUnknown}
              className="text-xs px-2 py-1 rounded-md border border-primary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring disabled:opacity-50"
            >
              {busyAction === "hooks:all" ? <Loader2 className="w-3 h-3 animate-spin inline mr-1" /> : null}
              {allEnabled ? "Disable all" : "Enable all"}
            </button>
          ) : null}
        </div>
        <SearchInput value={searchQuery} onChange={onSearchChange} placeholder="Filter hooks…" aria-label="Filter hooks" className="w-full max-w-xs" />
      </div>

      {filtered.length === 0 ? (
        <EmptyState variant="card" icon={Search} title={`No hooks match “${searchQuery}”`} />
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
                  <EnableToggle
                    enabled={isEnabled}
                    onToggle={() => onToggleHook(hookName)}
                    loading={isBusy || (enabledLoading && !enabledError)}
                    disabled={busyAction !== null || enabledUnknown}
                    itemName={hookInfo.displayName || hookName}
                    enabledIcon={Check}
                    disabledIcon={X}
                    className="shrink-0 mt-0.5"
                  />
                ) : null}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
