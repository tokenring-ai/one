import type { JobRecord, JobStatus } from "@tokenring-ai/agent/schema";
import formatError from "@tokenring-ai/utility/error/formatError";
import { Ban, CornerDownRight, MessageSquare } from "lucide-react";
import { type ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { toastManager } from "../../components/ui/toast.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { usePanel } from "../../layout/hooks.ts";
import { PaneLink } from "../../layout/links.tsx";
import { cn } from "../../lib/utils.ts";
import { agentJobsRPCClient, useAgentJobs, useAgentList } from "../../rpc.ts";
import { Badge, type BadgeTone, Button, EmptyState, ErrorState, LoadingState, Select, ViewShell } from "../../ui/index.ts";
import { CHAT_VIEW } from "../chat/ids.ts";
import { agentJobPath } from "./JobLink.tsx";
import { RefusalBadge, RefusalList, UnansweredBadge, UnansweredList } from "./JobRefusals.tsx";
import { AgentJobsSummary, formatCostUsd, type RollupDays } from "./JobRollup.tsx";

/**
 * The Agents app's "Agent jobs" page: every agent a plugin ran unattended (queue items, task
 * dispatches, workflow runs, schedules), as a tree of who started what, with status, cost and
 * Cancel. `?job=<id>` opens it on one job (the plugins' "Job" links).
 */

const STATUS_LABEL: Record<JobStatus, string> = {
  queued: "Queued",
  running: "Running",
  succeeded: "Succeeded",
  failed: "Failed",
  cancelled: "Cancelled",
  interrupted: "Interrupted",
};

const STATUS_TONE: Record<JobStatus, BadgeTone> = {
  queued: "neutral",
  running: "accent",
  succeeded: "success",
  failed: "danger",
  cancelled: "neutral",
  interrupted: "warning",
};

const STATUSES = Object.keys(STATUS_LABEL) as JobStatus[];

/** The plugins that run jobs, in the order the filter lists them. */
const KNOWN_OWNERS = ["tasks", "queue", "workflow", "scheduler"] as const;

const OWNER_LABEL: Record<string, string> = { tasks: "Tasks", queue: "Queue", workflow: "Workflow", scheduler: "Scheduler" };

export function ownerLabel(owner: string): string {
  return OWNER_LABEL[owner] ?? owner.charAt(0).toUpperCase() + owner.slice(1);
}

/** Where the owner shows the job's entry: the entry itself when the job says which, else the owner's app. */
export function ownerHref(job: Pick<JobRecord, "owner" | "ownerRef">): string | null {
  const ref = job.ownerRef;
  const seg = encodeURIComponent;
  switch (job.owner) {
    case "queue":
      return ref.queue ? `/queue/${seg(ref.queue)}` : "/queue";
    case "tasks":
      return ref.board && ref.task ? `/tasks/${seg(ref.board)}/${seg(ref.task)}` : "/tasks";
    case "workflow":
      return ref.run ? `/workflows/runs/${seg(ref.run)}` : "/workflows";
    case "scheduler":
      return "/scheduler/runs";
    default:
      return null;
  }
}

function isActive(job: Pick<JobRecord, "status">): boolean {
  return job.status === "queued" || job.status === "running";
}

function formatTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

export function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m`;
}

const formatCost = formatCostUsd;

/** "Cost $0.42 of $1.00", "Cost $0.42", or "Budget $1.00" before anything is spent. */
export function costText(job: Pick<JobRecord, "costUsd" | "maxCostUsd">): string | null {
  if (job.costUsd !== null && job.maxCostUsd !== null) return `Cost ${formatCost(job.costUsd)} of ${formatCost(job.maxCostUsd)}`;
  if (job.costUsd !== null) return `Cost ${formatCost(job.costUsd)}`;
  if (job.maxCostUsd !== null) return `Budget ${formatCost(job.maxCostUsd)}`;
  return null;
}

/** Visible jobs as a tree: a job sits under its parent when the parent is shown too, children oldest first. */
export function jobTree(jobs: readonly JobRecord[]): { job: JobRecord; level: number }[] {
  const ids = new Set(jobs.map(job => job.id));
  const children = new Map<string, JobRecord[]>();
  const roots: JobRecord[] = [];
  for (const job of jobs) {
    if (job.parentJobId && ids.has(job.parentJobId)) {
      const siblings = children.get(job.parentJobId) ?? [];
      siblings.push(job);
      children.set(job.parentJobId, siblings);
    } else {
      roots.push(job);
    }
  }
  const rows: { job: JobRecord; level: number }[] = [];
  const visit = (job: JobRecord, level: number) => {
    rows.push({ job, level });
    const kids = [...(children.get(job.id) ?? [])].sort((a, b) => a.requestedAt - b.requestedAt);
    for (const child of kids) visit(child, level + 1);
  };
  for (const root of roots) visit(root, 0);
  return rows;
}

/** Jobs a cancel of `jobId` also cancels: its descendants that are still queued or running. */
function activeDescendants(jobs: readonly JobRecord[], jobId: string): number {
  let count = 0;
  const stack = [jobId];
  while (stack.length > 0) {
    const parent = stack.pop()!;
    for (const job of jobs) {
      if (job.parentJobId !== parent) continue;
      if (isActive(job)) count++;
      stack.push(job.id);
    }
  }
  return count;
}

type StatusFilter = "all" | "active" | JobStatus;

function OriginText({ job, liveAgents }: { job: JobRecord; liveAgents: ReadonlySet<string> }) {
  const { origin } = job;
  if (origin.kind === "person") return <span>Started by {origin.label}</span>;
  if (origin.kind === "schedule") {
    return (
      <span>
        Started by schedule{" "}
        <Link to="/scheduler" className="text-accent-soft hover:underline focus-ring rounded">
          {origin.scheduleId}
        </Link>
      </span>
    );
  }
  return (
    <span>
      Started by a {origin.agentType} agent
      {liveAgents.has(origin.agentId) ? (
        <>
          {" "}
          (
          <PaneLink view={CHAT_VIEW} params={{ agentId: origin.agentId }} className="text-accent-soft hover:underline focus-ring rounded">
            open its chat
          </PaneLink>
          )
        </>
      ) : null}
    </span>
  );
}

function JobRow({
  job,
  level,
  parent,
  highlighted,
  liveAgents,
  cancelling,
  onCancel,
}: {
  job: JobRecord;
  level: number;
  /** The parent's record when it is loaded but not shown above this row (filtered out). */
  parent: JobRecord | null | undefined;
  highlighted: boolean;
  liveAgents: ReadonlySet<string>;
  cancelling: boolean;
  onCancel: (job: JobRecord) => void;
}) {
  const ref = useRef<HTMLLIElement>(null);
  useEffect(() => {
    const node = ref.current;
    // jsdom has no scrollIntoView.
    if (highlighted && node && "scrollIntoView" in node) node.scrollIntoView({ block: "nearest" });
  }, [highlighted]);
  const href = ownerHref(job);
  const ended = job.endedAt ?? (isActive(job) ? Date.now() : null);
  const agentAlive = job.agentId !== null && liveAgents.has(job.agentId);
  const detail = job.error || job.summary;

  return (
    <li
      ref={ref}
      data-job-id={job.id}
      data-level={level}
      aria-current={highlighted ? "true" : undefined}
      aria-label={`${job.label}, ${STATUS_LABEL[job.status].toLowerCase()}`}
      className={cn("my-1.5 rounded-md border px-3 py-2", highlighted ? "border-accent bg-accent-tint" : "border-line bg-surface")}
      style={level > 0 ? { marginLeft: `${level * 1.25}rem` } : undefined}
    >
      <div className="flex min-w-0 items-center gap-2">
        {level > 0 && <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-dim" aria-hidden="true" />}
        <Badge tone={STATUS_TONE[job.status]} dot pulse={job.status === "running"}>
          {STATUS_LABEL[job.status]}
        </Badge>
        <RefusalBadge count={job.refusalCount} />
        <UnansweredBadge count={job.unansweredCount} />
        <span className="min-w-0 flex-1 truncate text-sm font-medium text-primary" title={job.label}>
          {job.label}
        </span>
        {href ? (
          <Link to={href} className="shrink-0 text-xs text-accent-soft hover:underline focus-ring rounded" aria-label={`Open in ${ownerLabel(job.owner)}`}>
            {ownerLabel(job.owner)}
          </Link>
        ) : (
          <span className="shrink-0 text-xs text-muted">{ownerLabel(job.owner)}</span>
        )}
        {isActive(job) && (
          <Button variant="ghost" icon={Ban} busy={cancelling} onClick={() => onCancel(job)} aria-label={`Cancel ${job.label}`}>
            Cancel
          </Button>
        )}
      </div>
      <div className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-muted">
        <span>{job.agentType}</span>
        <span>Depth {job.depth}</span>
        <span>{job.startedAt !== null ? `Started ${formatTime(job.startedAt)}` : `Requested ${formatTime(job.requestedAt)}`}</span>
        {job.endedAt !== null && <span>Ended {formatTime(job.endedAt)}</span>}
        {job.startedAt !== null && ended !== null && <span>Took {formatDuration(ended - job.startedAt)}</span>}
        {costText(job) !== null && (
          <span className={cn("tabular-nums", job.costUsd !== null && job.maxCostUsd !== null && job.costUsd > job.maxCostUsd && "text-error")}>
            {costText(job)}
          </span>
        )}
        {job.approvalLevel !== null && <span>Approves up to level {job.approvalLevel}</span>}
        {job.parentJobId ? (
          parent === undefined ? null : (
            <span>
              Started by job{" "}
              <Link to={agentJobPath(job.parentJobId)} className="text-accent-soft hover:underline focus-ring rounded">
                {parent?.label ?? job.parentJobId}
              </Link>
            </span>
          )
        ) : (
          <OriginText job={job} liveAgents={liveAgents} />
        )}
        {agentAlive && (
          <PaneLink
            view={CHAT_VIEW}
            params={{ agentId: job.agentId! }}
            className="inline-flex items-center gap-1 text-accent-soft hover:underline focus-ring rounded"
            aria-label={`Open the agent of ${job.label}`}
          >
            <MessageSquare className="h-3 w-3" aria-hidden="true" />
            Agent
          </PaneLink>
        )}
      </div>
      <RefusalList job={job} />
      <UnansweredList job={job} />
      {detail ? <p className={cn("mt-1 line-clamp-3 whitespace-pre-wrap text-xs", job.error ? "text-error" : "text-secondary")}>{detail}</p> : null}
    </li>
  );
}

export default function AgentJobsView() {
  const panel = usePanel();
  const jobsQuery = useAgentJobs();
  const agentsQuery = useAgentList();
  const [searchParams] = useSearchParams();
  const highlightId = searchParams.get("job");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [owner, setOwner] = useState(() => searchParams.get("owner") ?? "all");
  const [rollupDays, setRollupDays] = useState<RollupDays>(7);
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const jobs = useMemo(() => jobsQuery.data?.jobs ?? [], [jobsQuery.data]);
  const byId = useMemo(() => new Map(jobs.map(job => [job.id, job])), [jobs]);
  const liveAgents = useMemo(() => new Set((agentsQuery.data ?? []).map(agent => agent.id)), [agentsQuery.data]);
  const owners = useMemo(() => [...new Set([...KNOWN_OWNERS, ...jobs.map(job => job.owner)])], [jobs]);

  const visible = useMemo(
    () =>
      jobs.filter(
        job =>
          // The job a link asked for is shown whatever the filters say.
          job.id === highlightId ||
          ((status === "all" || (status === "active" ? isActive(job) : job.status === status)) && (owner === "all" || job.owner === owner)),
      ),
    [jobs, status, owner, highlightId],
  );
  const rows = useMemo(() => jobTree(visible), [visible]);

  const activeCount = jobs.filter(isActive).length;
  useEffect(() => {
    panel.setBadge(activeCount > 0 ? { tone: "info", count: activeCount, label: `${activeCount} active` } : null);
  }, [panel, activeCount]);

  const cancel = async (job: JobRecord) => {
    const descendants = activeDescendants(jobs, job.id);
    const confirmed = await openConfirm({
      id: "agents:cancel-job",
      title: "Cancel job",
      message:
        `Cancel "${job.label}"? Its agent stops, and every job it started is cancelled with it` +
        (descendants > 0 ? ` (${descendants} still queued or running).` : "."),
      confirmText: "Cancel job",
      cancelText: "Keep running",
      variant: "danger",
      dontAskAgain: false,
    });
    if (!confirmed) return;
    setCancellingId(job.id);
    try {
      const result = await agentJobsRPCClient.cancelJob({ jobId: job.id, reason: "Cancelled from the Agent jobs view" });
      if (!result.cancelled) toastManager.info(`"${job.label}" had already finished`);
      void jobsQuery.mutate();
    } catch (error) {
      toastManager.error(`Could not cancel "${job.label}": ${formatError(error, { includeStack: false })}`);
    } finally {
      setCancellingId(null);
    }
  };

  const filters = (
    <div className="flex flex-wrap items-end gap-3 pb-2">
      <Select label="Status" value={status} onChange={value => setStatus(value as StatusFilter)} className="w-40">
        <option value="all">All</option>
        <option value="active">Queued or running</option>
        {STATUSES.map(value => (
          <option key={value} value={value}>
            {STATUS_LABEL[value]}
          </option>
        ))}
      </Select>
      <Select label="Started by" value={owner} onChange={setOwner} className="w-40">
        <option value="all">Every plugin</option>
        {owners.map(value => (
          <option key={value} value={value}>
            {ownerLabel(value)}
          </option>
        ))}
      </Select>
    </div>
  );

  let body: ReactNode;
  if (jobsQuery.isLoading && jobs.length === 0) {
    body = <LoadingState className="py-8" />;
  } else if (jobsQuery.error && jobs.length === 0) {
    body = <ErrorState title="Failed to load agent jobs" error={jobsQuery.error} onRetry={() => void jobsQuery.mutate()} variant="inline" />;
  } else if (jobs.length === 0) {
    body = (
      <EmptyState
        title="No agent jobs yet"
        hint="Queue items, task dispatches, workflow runs and schedules each run an agent unattended; they show up here."
        variant="inline"
      />
    );
  } else if (rows.length === 0) {
    body = <EmptyState title="No jobs match these filters" variant="inline" />;
  } else {
    body = (
      <ul aria-label="Agent jobs">
        {rows.map(({ job, level }) => (
          <JobRow
            key={job.id}
            job={job}
            level={level}
            parent={level === 0 && job.parentJobId ? (byId.get(job.parentJobId) ?? null) : undefined}
            highlighted={job.id === highlightId}
            liveAgents={liveAgents}
            cancelling={cancellingId === job.id}
            onCancel={target => void cancel(target)}
          />
        ))}
      </ul>
    );
  }

  return (
    <ViewShell pad="page" width="wide">
      <h1 className="text-base font-semibold text-primary">Agent jobs</h1>
      <p className="mb-3 text-xs text-muted">
        Agents that Tasks, Queues, Workflows and the Scheduler run unattended. A job can start others (up to the app's depth and per-tree limits); cancelling
        one cancels everything it started.
      </p>
      <AgentJobsSummary days={rollupDays} onDaysChange={setRollupDays} owner={owner} onOwnerChange={setOwner} />
      {filters}
      {highlightId && !byId.has(highlightId) && jobs.length > 0 && (
        <p className="mb-2 text-xs text-muted">Job {highlightId} is not in the list: only the most recent jobs are kept.</p>
      )}
      {body}
      <ConfirmDialog />
    </ViewShell>
  );
}
