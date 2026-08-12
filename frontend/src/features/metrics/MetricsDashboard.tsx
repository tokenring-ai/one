import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  AlertTriangle,
  BarChart3,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  DollarSign,
  Image as ImageIcon,
  Loader2,
  MessageSquare,
  Pause,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Wrench,
  Zap,
} from "lucide-react";
import { memo, useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import StatusBadge from "../../components/ui/StatusBadge.tsx";
import SummaryStat from "../../components/ui/SummaryStat.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useExpandedSet } from "../../hooks/useExpandedSet.ts";
import { type FilterTabDefinition, useFilterTabs } from "../../hooks/useFilterTabs.ts";
import { type LiveStreamStatus, useLiveStreamStatusFromSWR } from "../../hooks/useLiveStreamStatus.ts";
import { cn } from "../../lib/utils.ts";
import { metricsRPCClient, useCostSummary } from "../../rpc.ts";
import {
  type AgentFilter,
  bucketTotals,
  categoryKind,
  categoryShares,
  filterAgents,
  formatAgentIdShort,
  formatCount,
  formatMs,
  formatPercent,
  formatTps,
  formatUsd,
  shortCategoryLabel,
  sumRecord,
  topRecordEntries,
} from "./formatters.ts";

type AgentMetricsRow = {
  agentId: string;
  displayName: string;
  agentType: string;
  idle: boolean;
  total: number;
  costs: Record<string, number>;
  tokens: {
    totalInputTokens: number;
    totalOutputTokens: number;
    totalCachedTokens: number;
    totalReasoningTokens: number;
  };
  latency: {
    requestCount: number;
    avgElapsedMs: number;
    avgTimeToFirstTokenMs: number;
    avgTokensPerSecond: number;
    p50ElapsedMs?: number | undefined;
    p95ElapsedMs?: number | undefined;
    p99ElapsedMs?: number | undefined;
  };
  errors: {
    errorsByProvider: Record<string, number>;
    errorsByType: Record<string, number>;
    retryCount: number;
  };
  activity: {
    totalSteps: number;
    totalToolCalls: number;
    toolCallsByName: Record<string, number>;
  };
};

const AGENT_TAB_DEFS: FilterTabDefinition<AgentMetricsRow, AgentFilter>[] = [
  { id: "all", label: "All" },
  { id: "active", label: "Active", predicate: a => !a.idle },
  { id: "idle", label: "Idle", predicate: a => a.idle },
];

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

function emptyAgentMetrics(): Pick<AgentMetricsRow, "tokens" | "latency" | "errors" | "activity"> {
  return {
    tokens: { totalInputTokens: 0, totalOutputTokens: 0, totalCachedTokens: 0, totalReasoningTokens: 0 },
    latency: { requestCount: 0, avgElapsedMs: 0, avgTimeToFirstTokenMs: 0, avgTokensPerSecond: 0 },
    errors: { errorsByProvider: {}, errorsByType: {}, retryCount: 0 },
    activity: { totalSteps: 0, totalToolCalls: 0, toolCallsByName: {} },
  };
}

function LiveStatusBadge({ status, showSpinner }: { status: LiveStreamStatus; showSpinner: boolean }) {
  // Never show "Live" without a snapshot — covers first connect and paused/waiting gaps.
  if (status === "error") {
    return (
      <StatusBadge
        label="Error"
        icon={<AlertTriangle className="w-3 h-3" />}
        colorClass="bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  if (status === "reconnecting") {
    return (
      <StatusBadge
        label="Reconnecting"
        dotColor="bg-amber-500"
        colorClass="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  if (status === "connecting") {
    return (
      <StatusBadge
        label="Connecting"
        icon={<Loader2 className={cn("w-3 h-3", showSpinner && "animate-spin")} />}
        colorClass="bg-tertiary text-muted border-primary"
        gap="md"
        data-testid="metrics-live-status"
      />
    );
  }
  return (
    <StatusBadge
      label="Live"
      dotColor="bg-emerald-500"
      pulse
      colorClass="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
      gap="md"
      data-testid="metrics-live-status"
    />
  );
}

function CategoryBars({ totalsByCategory, grandTotal }: { totalsByCategory: Record<string, number>; grandTotal: number }) {
  const shares = categoryShares(totalsByCategory, grandTotal);

  if (shares.length === 0) {
    return (
      <EmptyState
        variant="card"
        icon={BarChart3}
        title="No spend yet"
        hint="Costs appear here as agents chat, generate images, or use other billable tools."
        data-testid="metrics-category-empty"
      />
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
              <span className="text-xs text-muted tabular-nums shrink-0">
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

function MiniStatRow({ items }: { items: Array<{ label: string; value: string }> }) {
  return (
    <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted">
      {items.map(item => (
        <span key={item.label} className="tabular-nums">
          <span className="opacity-70">{item.label}</span> <span className="text-secondary font-medium">{item.value}</span>
        </span>
      ))}
    </div>
  );
}

function KeyValueList({ entries, emptyLabel }: { entries: Array<{ key: string; value: number }>; emptyLabel: string }) {
  if (entries.length === 0) {
    return <p className="text-xs text-muted">{emptyLabel}</p>;
  }
  return (
    <div className="space-y-1">
      {entries.map(e => (
        <div key={e.key} className="flex items-center justify-between gap-3 text-xs">
          <span className="truncate text-secondary font-medium" title={e.key}>
            {e.key}
          </span>
          <span className="tabular-nums text-muted shrink-0">{formatCount(e.value)}</span>
        </div>
      ))}
    </div>
  );
}

const AgentCostRow = memo(function AgentCostRow({
  agent,
  maxTotal,
  onReset,
  resetting,
  expanded,
  onToggleExpand,
}: {
  agent: AgentMetricsRow;
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
  const totalErrors = Math.max(sumRecord(agent.errors.errorsByProvider), sumRecord(agent.errors.errorsByType));
  const hasPerformance =
    agent.tokens.totalInputTokens > 0 ||
    agent.tokens.totalOutputTokens > 0 ||
    agent.latency.requestCount > 0 ||
    agent.activity.totalSteps > 0 ||
    agent.activity.totalToolCalls > 0 ||
    totalErrors > 0 ||
    agent.errors.retryCount > 0;

  const canReset = agent.total > 0 || hasPerformance;

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
              <span className="inline-flex items-center gap-1 text-xs text-muted shrink-0">
                <Pause className="w-2.5 h-2.5" /> Idle
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                <Activity className="w-2.5 h-2.5 animate-pulse" /> Active
              </span>
            )}
          </div>
          <p className="text-xs text-muted truncate mb-2">
            {agent.agentType}
            <span className="mx-1.5 opacity-40">·</span>
            <span className="font-mono opacity-80">{formatAgentIdShort(agent.agentId)}</span>
          </p>
          <div className="h-1.5 rounded-full bg-tertiary overflow-hidden mb-2">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-500" style={{ width: `${barWidth}%` }} />
          </div>
          {!expanded ? (
            <div className="space-y-1.5">
              {topCategories.length > 0 ? (
                <div className="flex flex-wrap gap-1.5">
                  {topCategories.map(c => (
                    <span
                      key={c.category}
                      className={cn(
                        "text-xs px-1.5 py-0.5 rounded-md bg-tertiary/80 border border-primary/60 truncate max-w-[12rem]",
                        KIND_TEXT[categoryKind(c.category)],
                      )}
                      title={c.category}
                    >
                      {shortCategoryLabel(c.category)} {formatUsd(c.amount)}
                    </span>
                  ))}
                  {hasMore ? <span className="text-xs text-muted self-center">+{allCategories.length - 3} more</span> : null}
                </div>
              ) : (
                <span className="text-xs text-muted">No recorded costs</span>
              )}
              {hasPerformance ? (
                <MiniStatRow
                  items={[
                    {
                      label: "tok",
                      value: `${formatCount(agent.tokens.totalInputTokens)}↓ ${formatCount(agent.tokens.totalOutputTokens)}↑`,
                    },
                    ...(agent.latency.requestCount > 0
                      ? [
                          { label: "req", value: formatCount(agent.latency.requestCount) },
                          { label: "avg", value: formatMs(agent.latency.avgElapsedMs) },
                        ]
                      : []),
                    ...(agent.activity.totalSteps > 0 ? [{ label: "steps", value: formatCount(agent.activity.totalSteps) }] : []),
                    ...(agent.activity.totalToolCalls > 0 ? [{ label: "tools", value: formatCount(agent.activity.totalToolCalls) }] : []),
                    ...(totalErrors > 0 ? [{ label: "err", value: formatCount(totalErrors) }] : []),
                  ]}
                />
              ) : null}
            </div>
          ) : null}
        </button>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-primary">{formatUsd(agent.total)}</span>
          <button
            type="button"
            disabled={resetting || !canReset}
            onClick={() => onReset(agent.agentId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset metrics for this agent"
            data-testid="metrics-reset-agent"
          >
            {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reset
          </button>
        </div>
      </div>
      {expanded ? (
        <div className="mt-3 ml-6 pl-3 border-l border-primary space-y-4" data-testid="metrics-agent-breakdown">
          <div>
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Costs</p>
            {allCategories.length > 0 ? (
              <div className="space-y-1.5">
                {allCategories.map(c => (
                  <div key={c.category} className="flex items-center justify-between gap-3 text-xs">
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
            ) : (
              <p className="text-xs text-muted">No recorded costs for this agent.</p>
            )}
          </div>

          <div data-testid="metrics-agent-tokens">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Tokens</p>
            <MiniStatRow
              items={[
                { label: "in", value: formatCount(agent.tokens.totalInputTokens) },
                { label: "out", value: formatCount(agent.tokens.totalOutputTokens) },
                { label: "cached", value: formatCount(agent.tokens.totalCachedTokens) },
                { label: "reasoning", value: formatCount(agent.tokens.totalReasoningTokens) },
              ]}
            />
          </div>

          <div data-testid="metrics-agent-latency">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Latency</p>
            <MiniStatRow
              items={[
                { label: "requests", value: formatCount(agent.latency.requestCount) },
                { label: "avg", value: formatMs(agent.latency.avgElapsedMs) },
                { label: "p50", value: formatMs(agent.latency.p50ElapsedMs) },
                { label: "p95", value: formatMs(agent.latency.p95ElapsedMs) },
                { label: "ttft", value: formatMs(agent.latency.avgTimeToFirstTokenMs) },
                { label: "tps", value: formatTps(agent.latency.avgTokensPerSecond) },
              ]}
            />
          </div>

          <div data-testid="metrics-agent-activity">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Activity</p>
            <MiniStatRow
              items={[
                { label: "steps", value: formatCount(agent.activity.totalSteps) },
                { label: "tool calls", value: formatCount(agent.activity.totalToolCalls) },
              ]}
            />
            {Object.keys(agent.activity.toolCallsByName).length > 0 ? (
              <div className="mt-2">
                <p className="text-xs text-muted mb-1">Top tools</p>
                <KeyValueList entries={topRecordEntries(agent.activity.toolCallsByName, 8)} emptyLabel="No tool calls" />
              </div>
            ) : null}
          </div>

          <div data-testid="metrics-agent-errors">
            <p className="text-xs font-bold text-muted uppercase tracking-widest mb-2">Errors & retries</p>
            <MiniStatRow
              items={[
                { label: "errors", value: formatCount(totalErrors) },
                { label: "retries", value: formatCount(agent.errors.retryCount) },
              ]}
            />
            {totalErrors > 0 ? (
              <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted mb-1">By type</p>
                  <KeyValueList entries={topRecordEntries(agent.errors.errorsByType, 5)} emptyLabel="—" />
                </div>
                <div>
                  <p className="text-xs text-muted mb-1">By provider</p>
                  <KeyValueList entries={topRecordEntries(agent.errors.errorsByProvider, 5)} emptyLabel="—" />
                </div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
});

export default function MetricsDashboard() {
  const summary = useCostSummary();
  const streamStatus = useLiveStreamStatusFromSWR(summary);
  const mutateSummary = summary.mutate;
  const [resettingId, setResettingId] = useState<string | null>(null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [agentFilter, setAgentFilter] = useState<AgentFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { isExpanded, toggle: toggleExpand } = useExpandedSet();

  const data = summary.data;
  const buckets = useMemo(() => bucketTotals(data?.totalsByCategory ?? {}), [data?.totalsByCategory]);
  const maxAgentTotal = useMemo(() => Math.max(0, ...(data?.agents.map(a => a.total) ?? [0])), [data?.agents]);

  const agentsWithMetrics = useMemo((): AgentMetricsRow[] => {
    return (data?.agents ?? []).map(agent => ({
      agentId: agent.agentId,
      displayName: agent.displayName,
      agentType: agent.agentType,
      idle: agent.idle,
      total: agent.total,
      costs: agent.costs,
      tokens: agent.tokens,
      latency: agent.latency,
      errors: agent.errors,
      activity: agent.activity,
    }));
  }, [data?.agents]);

  const filteredAgents = useMemo(() => filterAgents(agentsWithMetrics, agentFilter, searchQuery), [agentsWithMetrics, agentFilter, searchQuery]);

  const totals = useMemo(() => {
    const defaults = emptyAgentMetrics();
    return {
      tokens: data?.tokens ?? defaults.tokens,
      latency: data?.latency ?? defaults.latency,
      errors: data?.errors ?? defaults.errors,
      activity: data?.activity ?? defaults.activity,
    };
  }, [data]);

  const totalErrors = Math.max(sumRecord(totals.errors.errorsByProvider), sumRecord(totals.errors.errorsByType));

  const { tabs: agentTabs } = useFilterTabs(agentsWithMetrics, AGENT_TAB_DEFS);

  const handleResetRequest = useCallback(
    async (agentId: string) => {
      if (resettingId) return;
      const agent = agentsWithMetrics.find(a => a.agentId === agentId);
      const displayName = agent?.displayName ?? agentId;
      const total = agent?.total ?? 0;
      const confirmed = await openConfirm({
        title: "Reset metrics?",
        message: `Clear all recorded costs, tokens, latency, errors, and activity for “${displayName}” (${formatUsd(total)})? This only resets session counters — it does not refund provider usage.`,
        confirmText: "Reset metrics",
        cancelText: "Cancel",
        variant: "warning",
      });
      if (!confirmed) return;
      setResettingId(agentId);
      try {
        const result = await metricsRPCClient.resetAgentCosts({ agentId });
        if (result.status === "agentNotFound") {
          toastManager.error("Agent no longer exists", { duration: 4000 });
        } else {
          toastManager.success("Metrics reset", { duration: 2500 });
        }
        // Refresh either way: clear counters or drop a ghost agent row.
        await mutateSummary();
      } catch (err) {
        toastManager.error(formatError(err, { includeStack: false }), { duration: 5000 });
      } finally {
        setResettingId(null);
      }
    },
    [agentsWithMetrics, mutateSummary, openConfirm, resettingId],
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary" data-testid="metrics-dashboard">
      <AppPageHeader
        title="Metrics"
        subtitle="Live cost, tokens, latency, and activity across agents"
        icon={<DollarSign className="w-4 h-4" />}
        iconGradient="from-emerald-500 to-teal-600"
      >
        <LiveStatusBadge status={streamStatus.status} showSpinner={streamStatus.showSpinner} />
        <button
          type="button"
          onClick={() => void mutateSummary()}
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
          ) : streamStatus.status === "error" ? (
            <ErrorState
              title="Unable to load metrics"
              error={formatError(summary.error, { includeStack: false }).split("\n")[0]}
              onRetry={() => void mutateSummary()}
              variant="page"
            />
          ) : data ? (
            <>
              {streamStatus.isStale ? (
                <div
                  className="px-3 py-2 text-xs text-warning bg-warning/10 border border-warning/30 rounded-lg"
                  role="status"
                  data-testid="metrics-stale-banner"
                >
                  Live updates interrupted: {formatError(summary.error, { includeStack: false }).split("\n")[0]}. Showing last known snapshot.
                </div>
              ) : null}

              {/* Cost summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat
                  label="Session total"
                  value={formatUsd(data.grandTotal)}
                  sub={`${data.agentCount} agent${data.agentCount === 1 ? "" : "s"} tracked`}
                  icon={<DollarSign className="w-4 h-4" />}
                  accentClass="text-emerald-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Chat & models"
                  value={formatUsd(buckets.chat)}
                  sub="Chat + structured generation"
                  icon={<MessageSquare className="w-4 h-4" />}
                  accentClass="text-accent"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Media"
                  value={formatUsd(buckets.media)}
                  sub="Image + video generation"
                  icon={<ImageIcon className="w-4 h-4" />}
                  accentClass="text-pink-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Active now"
                  value={String(data.activeAgentCount)}
                  sub={data.agentCount === 0 ? "Start an agent to track spend" : `${data.agentCount - data.activeAgentCount} idle`}
                  icon={<Sparkles className="w-4 h-4" />}
                  accentClass="text-amber-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
              </div>

              {/* Performance summary cards */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3" data-testid="metrics-performance-stats">
                <SummaryStat
                  label="Tokens"
                  value={`${formatCount(totals.tokens.totalInputTokens)} / ${formatCount(totals.tokens.totalOutputTokens)}`}
                  sub={`in / out · cached ${formatCount(totals.tokens.totalCachedTokens)} · reason ${formatCount(totals.tokens.totalReasoningTokens)}`}
                  icon={<Coins className="w-4 h-4" />}
                  accentClass="text-sky-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Latency"
                  value={formatMs(totals.latency.avgElapsedMs)}
                  sub={
                    totals.latency.requestCount > 0
                      ? `${formatCount(totals.latency.requestCount)} req · ttft ${formatMs(totals.latency.avgTimeToFirstTokenMs)} · ${formatTps(totals.latency.avgTokensPerSecond)}`
                      : "No requests yet"
                  }
                  icon={<Clock className="w-4 h-4" />}
                  accentClass="text-indigo-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Errors"
                  value={formatCount(totalErrors)}
                  sub={`${formatCount(totals.errors.retryCount)} retries across providers`}
                  icon={<AlertTriangle className="w-4 h-4" />}
                  accentClass="text-rose-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
                <SummaryStat
                  label="Activity"
                  value={`${formatCount(totals.activity.totalSteps)} / ${formatCount(totals.activity.totalToolCalls)}`}
                  sub="steps / tool calls"
                  icon={<Wrench className="w-4 h-4" />}
                  accentClass="text-cyan-500"
                  size="lg"
                  iconPosition="right"
                  data-testid="metrics-summary-stat"
                />
              </div>

              {/* Stacked overview */}
              {data.grandTotal > 0 ? (
                <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm" data-testid="metrics-spend-mix">
                  <p className="text-xs font-bold text-muted uppercase tracking-widest mb-3">Spend mix</p>
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

              {/* Errors + top tools overview when present */}
              {(totalErrors > 0 || Object.keys(totals.activity.toolCallsByName).length > 0) && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6" data-testid="metrics-detail-panels">
                  {totalErrors > 0 ? (
                    <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Zap className="w-3.5 h-3.5 text-rose-500" />
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Errors by type</p>
                      </div>
                      <KeyValueList entries={topRecordEntries(totals.errors.errorsByType, 8)} emptyLabel="No errors" />
                      {Object.keys(totals.errors.errorsByProvider).length > 0 ? (
                        <div className="mt-4 pt-3 border-t border-primary">
                          <p className="text-xs text-muted mb-2">By provider</p>
                          <KeyValueList entries={topRecordEntries(totals.errors.errorsByProvider, 8)} emptyLabel="—" />
                        </div>
                      ) : null}
                    </section>
                  ) : null}
                  {Object.keys(totals.activity.toolCallsByName).length > 0 ? (
                    <section className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
                      <div className="flex items-center gap-2 mb-3">
                        <Wrench className="w-3.5 h-3.5 text-cyan-500" />
                        <p className="text-xs font-bold text-muted uppercase tracking-widest">Top tools</p>
                      </div>
                      <KeyValueList entries={topRecordEntries(totals.activity.toolCallsByName, 10)} emptyLabel="No tool calls" />
                    </section>
                  ) : null}
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* By category */}
                <section>
                  <div className="flex items-center justify-between px-1 mb-3">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest">By category</p>
                    <span className="text-xs text-muted">{Object.keys(data.totalsByCategory).length} categories</span>
                  </div>
                  <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
                    <CategoryBars totalsByCategory={data.totalsByCategory} grandTotal={data.grandTotal} />
                  </div>
                </section>

                {/* By agent */}
                <section>
                  <div className="flex items-center justify-between px-1 mb-3">
                    <p className="text-xs font-bold text-muted uppercase tracking-widest">By agent</p>
                    <span className="text-xs text-muted">Updates every ~2s</span>
                  </div>
                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    {agentsWithMetrics.length === 0 ? (
                      <EmptyState
                        icon={Activity}
                        title="No agents running"
                        hint="Create an agent to start tracking costs for this session."
                        data-testid="metrics-agents-empty"
                      />
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
                          <EmptyState
                            variant="compact"
                            icon={Search}
                            title="No matching agents"
                            hint="Try a different filter or search."
                            data-testid="metrics-agents-filtered-empty"
                          />
                        ) : (
                          filteredAgents.map(agent => (
                            <AgentCostRow
                              key={agent.agentId}
                              agent={agent}
                              maxTotal={maxAgentTotal}
                              onReset={handleResetRequest}
                              resetting={resettingId === agent.agentId}
                              expanded={isExpanded(agent.agentId)}
                              onToggleExpand={toggleExpand}
                            />
                          ))
                        )}
                      </>
                    )}
                  </div>
                </section>
              </div>

              <p className="text-xs text-muted text-center px-4">
                Metrics are tracked per agent for the current session (and restored from storage when available). Costs and tokens come from model provider
                usage; latency, steps, tool calls, and errors are collected by the chat and AI client layers.
              </p>
            </>
          ) : (
            <LoadingState message="Waiting for metrics…" size="md" className="py-20" />
          )}
        </div>
      </div>

      <ConfirmDialog />
    </div>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-muted">
      <span className={cn("w-2 h-2 rounded-full", color)} />
      {label}
    </span>
  );
}
