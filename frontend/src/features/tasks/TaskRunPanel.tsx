import { formatDurationMs } from "@tokenring-ai/utility/date/formatDuration";
import { CheckCircle2, Circle, ExternalLink, History, Loader2, X, XCircle } from "lucide-react";
import HistoryRunRow, { type HistoryRunStatus } from "../../components/ui/HistoryRunRow.tsx";
import { RunStatusBadge } from "./taskStatus.tsx";
import { isRunActive, type TaskRun, type TaskRunStatus } from "./types.ts";

function runDurationLabel(run: TaskRun): string | null {
  if (run.finishedAt === null) return null;
  return formatDurationMs(Math.max(0, run.finishedAt - run.startedAt));
}

function toHistoryRunStatus(status: TaskRunStatus): HistoryRunStatus {
  if (status === "completed" || status === "failed" || status === "cancelled") return status;
  return "custom";
}

/** Live step checklist for an in-flight (or just-finished) run, plus an open-agent action. */
export function ActiveRunPanel({ run, onOpenAgent, onCancel }: { run: TaskRun; onOpenAgent: (id: string) => void; onCancel: (runId: string) => void }) {
  const active = isRunActive(run);
  const multiStep = run.messages.length > 1;

  return (
    <div
      role="region"
      aria-label="Task run progress"
      className={`border rounded-xl overflow-hidden ${
        active
          ? "border-amber-500/40 bg-amber-500/5"
          : run.status === "completed"
            ? "border-emerald-500/30 bg-emerald-500/5"
            : run.status === "failed"
              ? "border-red-500/30 bg-red-500/5"
              : "border-primary bg-secondary/40"
      }`}
    >
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-primary/50">
        <RunStatusBadge status={run.status} />
        <span className="flex-1 min-w-0 text-xs text-muted truncate">
          {active
            ? run.status === "starting"
              ? "Spawning agent…"
              : multiStep
                ? `Step ${Math.min(run.currentStep + 1, run.messages.length)} of ${run.messages.length}`
                : "Working…"
            : run.message || run.status}
        </span>
        {active && (
          <button
            type="button"
            onClick={() => onCancel(run.id)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-muted hover:text-red-500 hover:bg-red-500/10 rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
          >
            <X className="w-3 h-3" /> Cancel
          </button>
        )}
        {run.agentId && (
          <button
            type="button"
            onClick={() => onOpenAgent(run.agentId!)}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-cyan-700 dark:text-cyan-400 hover:bg-cyan-500/10 rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
          >
            <ExternalLink className="w-3 h-3" /> Open agent
          </button>
        )}
      </div>

      {multiStep && (
        <ol className="px-3 py-2 space-y-1.5">
          {run.messages.map((message, index) => {
            let state: "done" | "current" | "pending" | "failed" | "cancelled" = "pending";
            if (run.status === "starting") {
              state = "pending";
            } else if (run.status === "completed" || index < run.currentStep) {
              state = "done";
            } else if (active && index === run.currentStep) {
              state = "current";
            } else if (!active && index === run.currentStep) {
              state = run.status === "cancelled" ? "cancelled" : "failed";
            }

            return (
              <li key={index} className="flex items-start gap-2 min-w-0">
                <span className="mt-0.5 shrink-0">
                  {state === "done" ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : state === "current" ? (
                    <Loader2 className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                  ) : state === "failed" ? (
                    <XCircle className="w-3.5 h-3.5 text-red-500" />
                  ) : state === "cancelled" ? (
                    <X className="w-3.5 h-3.5 text-muted" />
                  ) : (
                    <Circle className="w-3.5 h-3.5 text-muted/50" />
                  )}
                </span>
                <span
                  className={`flex-1 min-w-0 text-xs truncate ${
                    state === "current"
                      ? "text-primary font-medium"
                      : state === "done"
                        ? "text-muted"
                        : state === "failed"
                          ? "text-red-600 dark:text-red-400"
                          : "text-muted/70"
                  }`}
                  title={message}
                >
                  <span className="text-muted mr-1.5">{index + 1}.</span>
                  {message}
                </span>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}

export function TaskRunHistory({ runs, emptyMessage, onOpenAgent }: { runs: TaskRun[]; emptyMessage: string | null; onOpenAgent: (id: string) => void }) {
  if (runs.length === 0) {
    if (!emptyMessage) return null;
    return (
      <div className="border border-dashed border-primary rounded-xl px-3 py-4 text-center">
        <History className="w-5 h-5 text-muted mx-auto mb-1.5 opacity-50" />
        <p className="text-xs text-muted">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div role="region" aria-label="Task run history" className="border border-primary rounded-xl bg-secondary/40 overflow-hidden divide-y divide-primary/60">
      {runs.map(run => (
        <HistoryRunRow
          key={run.id}
          id={run.id}
          status={toHistoryRunStatus(run.status)}
          statusLabel={run.status}
          statusBadge={<RunStatusBadge status={run.status} />}
          startTime={run.finishedAt ?? run.startedAt}
          endTime={run.finishedAt ?? undefined}
          duration={runDurationLabel(run) ?? undefined}
          message={run.message}
          showIcon={false}
          showTimestamp={false}
          className="px-3 py-2.5"
          action={
            run.agentId ? (
              <button
                type="button"
                onClick={() => onOpenAgent(run.agentId!)}
                className="p-1 text-muted hover:text-cyan-600 dark:hover:text-cyan-400 rounded transition-colors cursor-pointer focus-ring shrink-0"
                title="Open agent"
                aria-label="Open agent for this run"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </button>
            ) : undefined
          }
        />
      ))}
    </div>
  );
}
