import { formatDurationBetween } from "@tokenring-ai/utility/date/formatDuration";
import { formatRelativeTime } from "@tokenring-ai/utility/date/formatRelativeTime";
import { type FormatTimestampOptions, formatTimestamp } from "@tokenring-ai/utility/date/formatTimestamp";
import { Ban, CheckCircle2, Circle, XCircle } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";

export type HistoryRunStatus = "completed" | "failed" | "cancelled" | "custom";

export interface HistoryRunRowProps {
  /** Unique key for this run entry */
  id: string;
  /** Name of the entity that ran (e.g., task name, workflow name). Omit when context is already known. */
  entityName?: string | undefined;
  /** Click handler for the entity name (e.g., filter to this entity) */
  onEntityClick?: (() => void) | undefined;
  /** Run status for icon and badge coloring */
  status: HistoryRunStatus;
  /** Custom status label (when status is "custom", or to override the default label) */
  statusLabel?: string | undefined;
  /** Fully custom status badge; when provided, the built-in badge is not rendered */
  statusBadge?: ReactNode | undefined;
  /** Run start time (unix-ms). Used for relative time and as the absolute timestamp. */
  startTime: number;
  /** Run end time (unix-ms). Used for duration calculation when `duration` is not provided. */
  endTime?: number | undefined;
  /** Pre-computed duration string (overrides automatic calculation from start/end) */
  duration?: string | undefined;
  /** Optional result/message text */
  message?: string | undefined;
  /** Whether to truncate the message with line-clamp-3 (default: true) */
  truncateMessage?: boolean | undefined;
  /** Optional action button rendered on the right side */
  action?: ReactNode | undefined;
  /** Optional content before the status icon (e.g. expand chevron) */
  leading?: ReactNode | undefined;
  /** Extra content below the message (e.g. expanded details, active step) */
  children?: ReactNode | undefined;
  /** Whether to show the status icon (default: true) */
  showIcon?: boolean | undefined;
  /** Whether to show the absolute timestamp line (default: true) */
  showTimestamp?: boolean | undefined;
  /** Whether to show relative time next to duration (default: true) */
  showRelativeTime?: boolean | undefined;
  /** Options for the absolute timestamp formatter */
  timestampOptions?: FormatTimestampOptions | undefined;
  /** Additional class names for the root row */
  className?: string | undefined;
  "data-testid"?: string | undefined;
}

const STATUS_BADGE_CLASSES: Record<Exclude<HistoryRunStatus, "custom">, string> = {
  completed: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
  failed: "bg-red-500/10 text-red-600 dark:text-red-400 border-red-500/30",
  cancelled: "bg-tertiary text-muted border-primary",
};

function StatusIcon({ status }: { status: HistoryRunStatus }) {
  if (status === "completed") {
    return <CheckCircle2 className="w-4 h-4 text-emerald-500" aria-hidden />;
  }
  if (status === "failed") {
    return <XCircle className="w-4 h-4 text-red-500" aria-hidden />;
  }
  if (status === "cancelled") {
    return <Ban className="w-4 h-4 text-muted" aria-hidden />;
  }
  return <Circle className="w-4 h-4 text-muted" aria-hidden />;
}

function BuiltInStatusBadge({ status, label }: { status: HistoryRunStatus; label: string }) {
  const colorClass = status === "custom" ? "bg-tertiary text-muted border-primary" : STATUS_BADGE_CLASSES[status];
  return <span className={cn("text-xs px-1.5 py-0.5 rounded-md border", colorClass)}>{label}</span>;
}

/**
 * List row for execution history entries (task runs, workflow runs, queue results).
 * Shows status icon, entity name, status badge, duration, relative time, absolute
 * timestamp, and optional result message — the shared pattern across history lists.
 */
export default function HistoryRunRow({
  id,
  entityName,
  onEntityClick,
  status,
  statusLabel,
  statusBadge,
  startTime,
  endTime,
  duration,
  message,
  truncateMessage = true,
  action,
  leading,
  children,
  showIcon = true,
  showTimestamp = true,
  showRelativeTime = true,
  timestampOptions,
  className,
  "data-testid": testId,
}: HistoryRunRowProps) {
  const resolvedDuration = duration ?? formatDurationBetween(startTime, endTime);
  const badgeLabel = statusLabel ?? status;
  const absoluteTs = formatTimestamp(startTime, { withSeconds: true, ...timestampOptions });

  return (
    <div className={cn("px-4 py-3", className)} data-testid={testId} data-run-id={id}>
      <div className="flex items-start gap-3">
        {leading != null ? leading : null}

        {showIcon ? (
          <div className="mt-0.5 shrink-0">
            <StatusIcon status={status} />
          </div>
        ) : null}

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            {entityName != null && entityName !== "" ? (
              onEntityClick ? (
                <button
                  type="button"
                  onClick={onEntityClick}
                  className="text-sm font-medium text-primary hover:underline focus-ring rounded cursor-pointer"
                  title={`Filter history to ${entityName}`}
                >
                  {entityName}
                </button>
              ) : (
                <span className="text-sm font-medium text-primary">{entityName}</span>
              )
            ) : null}

            {statusBadge != null ? statusBadge : <BuiltInStatusBadge status={status} label={badgeLabel} />}

            {resolvedDuration !== "—" ? <span className="text-xs text-muted tabular-nums">{resolvedDuration}</span> : null}

            {showRelativeTime ? (
              <span className="text-xs text-muted tabular-nums" title={absoluteTs}>
                ({formatRelativeTime(startTime, { precise: true })})
              </span>
            ) : null}
          </div>

          {showTimestamp ? <p className="text-xs text-muted mb-1">{absoluteTs}</p> : null}

          {message ? (
            <p className={cn("text-xs text-secondary whitespace-pre-wrap break-words", truncateMessage ? "line-clamp-3" : null)} title={message}>
              {message}
            </p>
          ) : null}

          {children}
        </div>

        {action != null ? <div className="shrink-0">{action}</div> : null}
      </div>
    </div>
  );
}
