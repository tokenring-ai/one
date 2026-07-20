import formatError from "@tokenring-ai/utility/error/formatError";
import { Activity, BarChart3, DollarSign, Image as ImageIcon, Loader2, MessageSquare, Pause, RefreshCw, RotateCcw, Sparkles } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { metricsRPCClient, useCostSummary } from "../../rpc.ts";
import { bucketTotals, categoryKind, categoryShares, formatUsd, shortCategoryLabel } from "./formatters.ts";

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
    <div className="px-4 py-3.5 bg-secondary rounded-xl border border-primary shadow-sm">
      <div className="flex items-center justify-between mb-2">
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
        <span className={cn("opacity-80", accentClass)}>{icon}</span>
      </div>
      <div className={cn("text-xl font-semibold tabular-nums tracking-tight", accentClass ?? "text-primary")}>{value}</div>
      {sub ? <p className="text-2xs text-muted mt-1 truncate">{sub}</p> : null}
    </div>
  );
}

function CategoryBars({ totalsByCategory, grandTotal }: { totalsByCategory: Record<string, number>; grandTotal: number }) {
  const shares = categoryShares(totalsByCategory, grandTotal);

  if (shares.length === 0) {
    return (
      <div className="px-4 py-10 text-center bg-secondary border border-primary border-dashed rounded-xl">
        <BarChart3 className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
        <p className="text-sm font-medium text-secondary mb-1">No spend yet</p>
        <p className="text-2xs text-muted max-w-xs mx-auto">Costs appear here as agents chat, generate images, or use other billable tools.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
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
                <span className="text-muted/70 ml-1.5">{(item.share * 100).toFixed(0)}%</span>
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
}) {
  const navigate = useNavigate();
  const barWidth = maxTotal > 0 ? Math.max((agent.total / maxTotal) * 100, agent.total > 0 ? 2 : 0) : 0;
  const topCategories = categoryShares(agent.costs, agent.total).slice(0, 3);

  return (
    <div className="px-4 py-3 border-b border-primary last:border-b-0 hover:bg-hover/40 transition-colors">
      <div className="flex items-start gap-3">
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
            <span className="font-mono opacity-80">{agent.agentId.slice(0, 8)}</span>
          </p>
          <div className="h-1.5 rounded-full bg-tertiary overflow-hidden mb-2">
            <div className="h-full rounded-full bg-emerald-500/80 transition-all duration-500" style={{ width: `${barWidth}%` }} />
          </div>
          {topCategories.length > 0 ? (
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
            </div>
          ) : (
            <span className="text-2xs text-muted">No recorded costs</span>
          )}
        </button>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <span className="text-sm font-semibold tabular-nums text-primary">{formatUsd(agent.total)}</span>
          <button
            type="button"
            disabled={resetting || agent.total === 0}
            onClick={() => onReset(agent.agentId)}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            title="Reset cost counters for this agent"
          >
            {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
            Reset
          </button>
        </div>
      </div>
    </div>
  );
}

export default function MetricsDashboard() {
  const summary = useCostSummary();
  const [resettingId, setResettingId] = useState<string | null>(null);

  const data = summary.data;
  const buckets = useMemo(() => bucketTotals(data?.totalsByCategory ?? {}), [data?.totalsByCategory]);
  const maxAgentTotal = useMemo(() => Math.max(0, ...(data?.agents.map(a => a.total) ?? [0])), [data?.agents]);

  const handleReset = async (agentId: string) => {
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

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Metrics"
        subtitle="Live cost tracking across agents, models, and media"
        icon={<DollarSign className="w-4 h-4" />}
        iconGradient="from-emerald-500 to-teal-600"
      >
        <button
          type="button"
          onClick={() => void summary.mutate()}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh now"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", summary.isValidating && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {summary.isLoading && !data ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-muted animate-spin" />
            </div>
          ) : summary.error && !data ? (
            <ErrorState title="Unable to load metrics" error={summary.error} onRetry={() => void summary.mutate()} variant="page" />
          ) : data ? (
            <>
              {summary.error ? (
                <div className="px-3 py-2 text-2xs text-warning bg-warning/10 border border-warning/30 rounded-lg" role="status">
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
                <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm">
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
                    <LegendDot color="bg-accent" label="Chat & models" />
                    <LegendDot color="bg-pink-500" label="Media" />
                    <LegendDot color="bg-amber-500" label="Other" />
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
                    <span className="text-2xs text-muted">Live · updates every ~2s</span>
                  </div>
                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    {data.agents.length === 0 ? (
                      <div className="px-4 py-10 text-center">
                        <Activity className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                        <p className="text-sm font-medium text-secondary mb-1">No agents running</p>
                        <p className="text-2xs text-muted max-w-xs mx-auto">Create an agent to start tracking costs for this session.</p>
                      </div>
                    ) : (
                      data.agents.map(agent => (
                        <AgentCostRow
                          key={agent.agentId}
                          agent={agent}
                          maxTotal={maxAgentTotal}
                          onReset={handleReset}
                          resetting={resettingId === agent.agentId}
                        />
                      ))
                    )}
                  </div>
                </section>
              </div>

              <p className="text-2xs text-muted text-center px-4">
                Costs are tracked per agent for the current session (and restored checkpoints). Amounts come from model provider usage reported by the AI
                client.
              </p>
            </>
          ) : null}
        </div>
      </div>
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
