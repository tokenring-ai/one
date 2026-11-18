import type { JobRollupRow } from "@tokenring-ai/agent/rpc/jobs.schema";
import { cn } from "../../lib/utils.ts";
import { useJobRollup } from "../../rpc.ts";
import { Badge, SegmentedControl } from "../../ui/index.ts";

/** The windows the spend and outcome summaries offer; "today" is the last 24 hours. */
export const ROLLUP_WINDOWS = [
  { value: "1", label: "Today", days: 1 },
  { value: "7", label: "7 days", days: 7 },
  { value: "30", label: "30 days", days: 30 },
] as const;

export type RollupDays = (typeof ROLLUP_WINDOWS)[number]["days"];

export function RollupWindowSelect({ days, onChange }: { days: RollupDays; onChange: (days: RollupDays) => void }) {
  return (
    <SegmentedControl
      ariaLabel="Summary window"
      size="sm"
      value={String(days)}
      onChange={value => onChange(ROLLUP_WINDOWS.find(w => w.value === value)?.days ?? 7)}
      options={ROLLUP_WINDOWS.map(w => ({ value: w.value, label: w.label }))}
    />
  );
}

export function formatCostUsd(usd: number): string {
  return `$${usd.toFixed(usd > 0 && usd < 0.01 ? 4 : 2)}`;
}

/** The row's spend, or "Cost not available" when no job reported one (never a made-up $0). */
export function rollupCostText(row: Pick<JobRollupRow, "totalCostUsd" | "costUnavailableJobs">): string {
  if (row.totalCostUsd === null) return "Cost not available";
  const base = formatCostUsd(row.totalCostUsd);
  return row.costUnavailableJobs > 0 ? `${base} (${row.costUnavailableJobs} without cost)` : base;
}

/** Finished jobs that ended well, as a percentage, or null before any job has finished. */
export function successRate(row: Pick<JobRollupRow, "succeeded" | "failed" | "interrupted" | "cancelled">): number | null {
  const finished = row.succeeded + row.failed + row.interrupted + row.cancelled;
  return finished === 0 ? null : Math.round((row.succeeded / finished) * 100);
}

/** How a row should stand out: failures are danger, refused actions or interruptions warning. */
export function rollupTone(row: Pick<JobRollupRow, "failed" | "refusedActions" | "interrupted">): "danger" | "warning" | null {
  if (row.failed > 0) return "danger";
  if (row.refusedActions > 0 || row.interrupted > 0) return "warning";
  return null;
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: "danger" | "warning" | null }) {
  return (
    <div className="min-w-0 rounded-md border border-line bg-surface px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-muted">{label}</div>
      <div
        className={cn("truncate text-base font-semibold tabular-nums text-primary", tone === "danger" && "text-error", tone === "warning" && "text-warning")}
      >
        {value}
      </div>
    </div>
  );
}

const OWNER_NAME: Record<string, string> = { tasks: "Tasks", queue: "Queue", workflow: "Workflow", scheduler: "Scheduler" };

/** Totals of the Agent jobs page for a window, and a per-owner breakdown whose rows apply the page's owner filter. */
export function AgentJobsSummary({
  days,
  onDaysChange,
  owner,
  onOwnerChange,
}: {
  days: RollupDays;
  onDaysChange: (days: RollupDays) => void;
  /** The owner the page is filtered to ("all" for none). */
  owner: string;
  onOwnerChange: (owner: string) => void;
}) {
  const query = useJobRollup({ days, groupBy: "owner" });
  const data = query.data;
  const totals = data?.totals;
  const rate = totals ? successRate(totals) : null;

  return (
    <section aria-label="Spend and outcomes" className="mb-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-primary">Spend and outcomes</h2>
        <RollupWindowSelect days={days} onChange={onDaysChange} />
      </div>
      {query.error && !data ? (
        <p className="text-xs text-error">Could not load the summary.</p>
      ) : !totals ? (
        <p className="text-xs text-muted">Loading summary…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
            <Stat label="Runs" value={String(totals.runs)} />
            <Stat label="Success rate" value={rate === null ? "n/a" : `${rate}%`} />
            <Stat label="Spend" value={rollupCostText(totals)} />
            <Stat label="Refused actions" value={String(totals.refusedActions)} tone={totals.refusedActions > 0 ? "warning" : null} />
            <Stat label="Failures" value={String(totals.failed)} tone={totals.failed > 0 ? "danger" : null} />
          </div>
          {data.rows.length > 0 && (
            <ul aria-label="By owner" className="flex flex-wrap gap-2">
              {data.rows.map(row => {
                const tone = rollupTone(row);
                const selected = owner === row.key;
                return (
                  <li key={row.key}>
                    <button
                      type="button"
                      aria-pressed={selected}
                      data-tone={tone ?? undefined}
                      onClick={() => onOwnerChange(selected ? "all" : row.key)}
                      className={cn(
                        "flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs cursor-pointer focus-ring",
                        selected
                          ? "border-accent bg-accent-tint"
                          : tone === "danger"
                            ? "border-danger"
                            : tone === "warning"
                              ? "border-warning"
                              : "border-line bg-surface",
                      )}
                    >
                      <span className="font-medium text-primary">{OWNER_NAME[row.key] ?? row.label}</span>
                      <span className="tabular-nums text-muted">{row.runs} runs</span>
                      {row.failed > 0 && <Badge tone="danger">{row.failed} failed</Badge>}
                      {row.refusedActions > 0 && <Badge tone="warning">{row.refusedActions} refused</Badge>}
                      <span className="tabular-nums text-muted">{rollupCostText(row)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {data.truncated && <p className="text-xs text-muted">Only the newest 1000 jobs are kept, so older jobs in this window are not counted.</p>}
        </>
      )}
    </section>
  );
}
