import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  BarChart3,
  ChevronDown,
  ChevronRight,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Pause,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { metricsRPCClient, useCostSummary } from "../../rpc.ts";
import {
  type AgentFilter,
  bucketTotals,
  categoryKind,
  categoryShares,
  filterAgents,
  formatAgentIdShort,
  formatPercent,
  formatUsd,
  shortCategoryLabel,
} from "./formatters.ts";

const KIND_BAR: Record<ReturnType<typeof categoryKind>, string> = {
  chat: "bg-accent",
  image: "bg-pink-500",
  video: "bg-violet-500",
  other: "bg-amber-500",
};

const KIND_TEXT: Record<ReturnType<typeof categoryKind>, string> = {
  chat: "text-accent",
  image: "text-pink-500",
  video: "text-violet-500",
  other: "text-amber-500",
};

function SummaryStat({ label, value, sub, icon, accentClass }: { label: string; value: string; sub?: string; icon: ReactNode; accentClass?: string }) {
  return (
    <div className="px-4 py-3.5 bg-secondary rounded-xl border border-primary shadow-sm" data-testid="metrics-summary-stat">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={cn("opacity-80", accentClass)}>{icon}</span>
      </div>
      <div className={cn("text-xl font-semibold tabular-nums tracking-tight", accentClass ?? "text-primary")}>{value}</div>
      {sub ? <p className="text-2xs text-muted mt-1 truncate">{sub}</p> : null}
    </div>
  );
}

function LiveStatusBadge({ isValidating, error, hasData }: { isValidating: boolean; error: Error | undefined; hasData: boolean }) {
  if (error && !hasData) return null;
  if (error) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30"
        data-testid="metrics-live-status"
      >
        <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
        Reconnecting
      </span>
    );
  }
  if (isValidating && !hasData) {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary"
        data-testid="metrics-live-status"
      >
        <Loader2 className="w-3 h-3 animate-spin" />
        Connecting
      </span>
    );
  }
  return (
    <span
      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-2xs font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30"
      data-testid="metrics-live-status"
    >
      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
      Live
    </span>
  );
}

function CategoryBars({ totalsByCategory, grandTotal }: { totalsByCategory: Record<string, number>; grandTotal: number }) {
  const shares = categoryShares(totalsByCategory, grandTotal);

  if (shares.length === 0) {
    return (
      <div className="px-4 py-10 text-center bg-secondary border border-primary border-dashed rounded-xl" data-testid="metrics-category-empty">
        <BarChart3 className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-secondary mb-1">No spend yet</p>
        <p className="text-2xs text-muted max-w-xs mx-auto">Costs appear here as agents chat, generate images, or use other billable tools.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5" data-testid="metrics-category-bars">
      {shares.map(item => {
        const kind = categoryKind(item.category);
        const pct = Math.max(item.share * 100, item.amount > 0 ? 1.5 : 0);
        return (
          <div key={item.category} className="group">
            <div className="flex items-center justify-between gap-3 mb-1">
              <span className="text-xs text-primary font-medium truncate" title={item.category}>
                {shortCategoryLabel(item.category)}
              </span>
              <span className="text-2xs text-muted tabular-nums shrink-0">
                {formatUsd(item.amount)}
                <span className="text-muted/70 ml-1.5">{formatPercent(item.share)}</span>
              </span>
            </div>
            <div className="h-2 rounded-full bg-tertiary overflow-hidden">
              <div
                className={cn("h-full rounded-full transition-all duration-500", KIND_BAR[kind])}
                style={{ width: `${pct}%` }}
                role="progressbar"
                aria-valuenow={Math.round(item.share * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label={`${item.category}: ${formatUsd(item.amount)}`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function AgentCostRow({
  agent,
  maxTotal,
  onReset,
  resetting,
  expanded,
  onToggleExpand,
}: {
  agent: {
    agentId: string;
    displayName: string;
    agentType: string;
    idle: boolean;
    total: number;
    costs: Record<string, number>;
  };
  maxTotal: number;
  onReset: (agentId: string) => void;
  resetting: boolean;
  expanded: boolean;
  onToggleExpand: (agentId: string) => void;
}) {
  const navigate = useNavigate();
  const barWidth = maxTotal > 0 ? Math.max((agent.total / maxTotal) * 100, agent.total > 0 ? 2 : 0) : 0;
  const allCategories = categoryShares(agent.costs, agent.total);
  const topCategories = allCategories.slice(0, 3);
  const hasMore = allCategories.length > 3;

  return (
    <div className="px-4 py-3 border-b border-primary last:border-b-0 hover:bg-hover/40 transition-colors" data-testid="metrics-agent-row">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={() => onToggleExpand(agent.agentId)}
          className="mt-0.5 p-0.5 text-muted hover:text-primary rounded focus-ring cursor-pointer shrink-0"
          aria-expanded={expanded}
          aria-label={expanded ? "Collapse cost breakdown" : "Expand cost breakdown"}
          title={expanded ? "Collapse" : "Show full breakdown"}
        >
          {expanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
        <button type="button" onClick={() => navigate(`/agent/${agent.agentId}`)} className="flex-1 min-w-0 text-left focus-ring rounded-md cursor-pointer">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-sm font-medium text-primary truncate">{agent.displayName}</span>
            {agent.idle ? (
              <span className="inline-flex items-center gap-1 text-2xs text-muted shrink-0">
                <Pause className="w-2.5 h-2.5" /> Idle
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Active
              </span>
            )}
          </div>
          <p className="text-2xs text-muted truncate mb-2">
            {agent.agentType}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="font-mono opacity-80">{formatAgentIdShort(agent.agentId)}</span>
          </p>
          <div className="h-1.5 rounded-full bg-tertiary overflow-hidden mb-2">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-500" style={{ width: `${barWidth}%` }} />
          </div>
          {!expanded && topCategories.length > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {topCategories.map(c => (
                <span
                  key={c.category}
                  className={cn(
                    "text-2xs px-1.5 py-0.5 rounded-md bg-tertiary/80 border border-primary/60 truncate max-w-[12rem]",
                    KIND_TEXT[categoryKind(c.category)],
                  )}
                  title={c.category}
                >
                  {shortCategoryLabel(c.category)} {formatUsd(c.amount)}
                </span>
              ))}
              {hasMore ? <span className="text-2xs text-muted self-center">+{allCategories.length - 3} more</span> : null}
            </div>
          ) : !expanded ? (
            <span className="text-2xs text-muted">No recorded costs</span>
          ) : null}
        </button>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-primary">{formatUsd(agent.total)}</span>
          <button
            type="button"
            disabled={resetting || agent.total === 0}
            onClick={() => onReset(agent.agentId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset cost counters for this agent"
            data-testid="metrics-reset-agent"
          >
            {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reset
          </button>
        </div>
      </div>
      {expanded && allCategories.length > 0 ? (
        <div className="mt-3 ml-6 pl-3 border-l border-primary space-y-1.5" data-testid="metrics-agent-breakdown">
          {allCategories.map(c => (
            <div key={c.category} className="flex items-center justify-between gap-3 text-2xs">
              <span className={cn("truncate font-medium", KIND_TEXT[categoryKind(c.category)])} title={c.category}>
                {shortCategoryLabel(c.category)}
              </span>
              <span className="tabular-nums text-muted shrink-0">
                {formatUsd(c.amount)}
                <span className="ml-1.5 opacity-70">{formatPercent(c.share)}</span>
              </span>
            </div>
          ))}
        </div>
      ) : null}
      {expanded && allCategories.length === 0 ? (
        <p className="mt-2 ml-6 pl-3 text-2xs text-muted border-l border-primary">No recorded costs for this agent.</p>
      ) : null}
    </div>
  );
}

export default function MetricsDashboard() {
  const summary = useCostSummary();
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [confirmResetId, setConfirmResetId] = useState<string | null>(null);
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedIds, setExpandedIds] = useState<Set<string>>(() => new Set());

  const data = summary.data;
  const buckets = useMemo(() => bucketTotals(data?.totalsByCategory ?? {}), [data?.totalsByCategory]);
  const maxAgentTotal = useMemo(() => Math.max(0, ...(data?.agents.map(a => a.total) ?? [0])), [data?.agents]);

  const filteredAgents = useMemo(() => filterAgents(data?.agents ?? [], agentFilter, searchQuery), [data?.agents, agentFilter, searchQuery]);

  const agentTabs = useMemo<FilterTabOption<AgentFilter>[]>(() => {
    const agents = data?.agents ?? [];
    return [
      { id: "all", label: "All", count: agents.length },
      { id: "active", label: "Active", count: agents.filter(a => !a.idle).length },
      { id: "idle", label: "Idle", count: agents.filter(a => a.idle).length },
    ];
  }, [data?.agents]);

  const confirmAgent = useMemo(() => data?.agents.find(a => a.agentId === confirmResetId) ?? null, [data?.agents, confirmResetId]);

  const handleResetRequest = (agentId: string) => {
    setConfirmResetId(agentId);
  };

  const handleResetConfirm = async () => {
    if (!confirmResetId) return;
    const agentId = confirmResetId;
    setConfirmResetId(null);
    setResettingId(agentId);
    try {
      const result = await metricsRPCClient.resetAgentCosts({ agentId });
      if (result.status === "agentNotFound") {
        toastManager.error("Agent no longer exists", { duration: 4000 });
      } else {
        toastManager.success("Cost counters reset", { duration: 2500 });
        await summary.mutate();
      }
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setResettingId(null);
    }
  };

  const toggleExpand = (agentId: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(agentId)) next.delete(agentId);
      else next.add(agentId);
      return next;
    });
  };

  return (
    <div className="w-full h-full flex flex-col bg-primary" data-testid="metrics-dashboard">
      <AppPageHeader
        title="Metrics"
        subtitle="Live cost tracking across agents, models, and media"
        icon={<DollarSign className="w-4 h-4" />}
        iconGradient="from-emerald-500 to-teal-600"
      >
        <LiveStatusBadge isValidating={summary.isValidating} error={summary.error} hasData={!!data} />
        <button
          type="button"
          onClick={() => void summary.mutate()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh now"
          data-testid="metrics-refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", summary.isValidating && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {summary.isLoading && !data ? (
            <LoadingState message="Loading metrics…" size="lg" className="py-20" />
          ) : summary.error && !data ? (
            <ErrorState title="Unable to load metrics" error={summary.error} onRetry={() => void summary.mutate()} variant="page" />
          ) : data ? (
            <>
              {summary.error ? (
                <div
                  className="px-3 py-2 text-2xs text-warning bg-warning/10 border border-warning/30 rounded-lg"
                  role="status"
                  data-testid="metrics-stale-banner"
                >
                  Live updates interrupted: {formatError(summary.error)}. Showing last known snapshot.
                </div>
              ) : null}

              {/* Summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat
                  label="Session total"
                  value={formatUsd(data.grandTotal)}
                  sub={`${data.agentCount} agent${data.agentCount === 1 ? "" : "s"} tracked`}
                  icon={<DollarSign className="w-4 h-4" />}
                  accentClass="text-emerald-500"
                />
                <SummaryStat
                  label="Chat & models"
                  value={formatUsd(buckets.chat)}
                  sub="Chat + structured generation"
                  icon={<MessageSquare className="w-4 h-4" />}
                  accentClass="text-accent"
                />
                <SummaryStat
                  label="Media"
                  value={formatUsd(buckets.media)}
                  sub="Image + video generation"
                  icon={<ImageIcon className="w-4 h-4" />}
                  accentClass="text-pink-500"
                />
                <SummaryStat
                  label="Active now"
                  value={String(data.activeAgentCount)}
                  sub={data.agentCount === 0 ? "Start an agent to track spend" : `${data.agentCount - data.activeAgentCount} idle`}
                  icon={<Sparkles className="w-4 h-4" />}
                  accentClass="text-amber-500"
                />
              </div>

              {/* Stacked overview */}
              {data.grandTotal > 0 ? (
                <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm" data-testid="metrics-spend-mix">
                  <p className="text-2xs font-bold text-muted uppercase tracking-widest mb-3">Spend mix</p>
                  <div className="h-3 rounded-full bg-tertiary overflow-hidden flex">
                    {buckets.chat > 0 ? (
                      <div
                        className="h-full bg-accent transition-all duration-500"
                        style={{ width: `${(buckets.chat / data.grandTotal) * 100}%` }}
                        title={`Chat ${formatUsd(buckets.chat)}`}
                      />
                    ) : null}
                    {buckets.media > 0 ? (
                      <div
                        className="h-full bg-pink-500 transition-all duration-500"
                        style={{ width: `${(buckets.media / data.grandTotal) * 100}%` }}
                        title={`Media ${formatUsd(buckets.media)}`}
                      />
                    ) : null}
                    {buckets.other > 0 ? (
                      <div
                        className="h-full bg-amber-500 transition-all duration-500"
                        style={{ width: `${(buckets.other / data.grandTotal) * 100}%` }}
                        title={`Other ${formatUsd(buckets.other)}`}
                      />
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-4 mt-3">
                    <LegendDot color="bg-accent" label={`Chat & models ${formatUsd(buckets.chat)}`} />
                    <LegendDot color="bg-pink-500" label={`Media ${formatUsd(buckets.media)}`} />
                    <LegendDot color="bg-amber-500" label={`Other ${formatUsd(buckets.other)}`} />
                  </div>
                </div>
              ) : null}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By category */}
                <section>
                  <div className="flex items-center justify-between px-1 mb-3">
                    <p className="text-2xs font-bold text-muted uppercase tracking-widest">By category</p>
                    <span className="text-2xs text-muted">{Object.keys(data.totalsByCategory).length} categories</span>
                  </div>
                  <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
                    <CategoryBars totalsByCategory={data.totalsByCategory} grandTotal={data.grandTotal} />
                  </div>
                </section>

                {/* By agent */}
                <section>
                  <div className="flex items-center justify-between px-1 mb-3">
                    <p className="text-2xs font-bold text-muted uppercase tracking-widest">By agent</p>
                    <span className="text-2xs text-muted">Updates every ~2s</span>
                  </div>
                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    {data.agents.length === 0 ? (
                      <div className="px-4 py-10 text-center" data-testid="metrics-agents-empty">
                        <Activity className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium text-secondary mb-1">No agents running</p>
                        <p className="text-2xs text-muted max-w-xs mx-auto">Create an agent to start tracking costs for this session.</p>
                      </div>
                    ) : (
                      <>
                        <FilterTabs tabs={agentTabs} value={agentFilter} onChange={setAgentFilter} showZeroCounts className="px-2" />
                        <div className="px-3 py-2 border-b border-primary">
                          <div className="relative">
                            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                            <input
                              type="search"
                              value={searchQuery}
                              onChange={e => setSearchQuery(e.target.value)}
                              placeholder="Filter agents…"
                              className="w-full bg-input border border-primary rounded-lg py-1.5 pl-8 pr-3 text-xs text-primary placeholder-muted focus-accent"
                              data-testid="metrics-agent-search"
                              aria-label="Filter agents"
                            />
                          </div>
                        </div>
                        {filteredAgents.length === 0 ? (
                          <div className="px-4 py-8 text-center" data-testid="metrics-agents-filtered-empty">
                            <p className="text-sm text-secondary mb-1">No matching agents</p>
                            <p className="text-2xs text-muted">Try a different filter or search.</p>
                          </div>
                        ) : (
                          filteredAgents.map(agent => (
                            <AgentCostRow
                              key={agent.agentId}
                              agent={agent}
                              maxTotal={maxAgentTotal}
                              onReset={handleResetRequest}
                              resetting={resettingId === agent.agentId}
                              expanded={expandedIds.has(agent.agentId)}
                              onToggleExpand={toggleExpand}
                            />
                          ))
                        )}
                      </>
                    )}
                  </div>
                </section>
              </div>

              <p className="text-2xs text-muted text-center px-4">
                Costs are tracked per agent for the current session (and restored checkpoints). Amounts come from model provider usage reported by the AI
                client.
              </p>
            </>
          ) : (
            <LoadingState message="Waiting for metrics…" size="md" className="py-20" />
          )}
        </div>
      </div>

      {confirmAgent ? (
        <ConfirmDialog
          title="Reset cost counters?"
          message={`Clear all recorded costs for “${confirmAgent.displayName}” (${formatUsd(confirmAgent.total)})? This only resets session counters — it does not refund provider usage.`}
          confirmText="Reset costs"
          cancelText="Cancel"
          variant="warning"
          onConfirm={() => void handleResetConfirm()}
          onCancel={() => setConfirmResetId(null)}
        />
      ) : null}
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-2xs text-muted">
      <span className={cn("w-2 h-2 rounded-full", color)} />
      {label}
    </span>
  );
}
