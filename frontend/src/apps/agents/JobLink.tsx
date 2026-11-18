import { Workflow } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "../../lib/utils.ts";

/** The Agents app's jobs view: every unattended agent job (queue items, task dispatches, workflow runs, schedules). */
export const AGENT_JOBS_PATH = "/agents/jobs";

/** The jobs view, opened on (and highlighting) one job. */
export function agentJobPath(jobId: string): string {
  return `${AGENT_JOBS_PATH}?job=${encodeURIComponent(jobId)}`;
}

/**
 * A small "Job" link from a plugin's entry (a queue result, task dispatch, workflow run or schedule
 * run) to its agent job in the Agents app, where its status, cost, lineage and agent are shown.
 */
export function JobLink({ jobId, className, label = "Job" }: { jobId: string; className?: string; label?: string }) {
  return (
    <Link
      to={agentJobPath(jobId)}
      title={`Agent job ${jobId}`}
      aria-label={`Open agent job ${jobId}`}
      className={cn("inline-flex items-center gap-0.5 rounded text-xs text-accent-soft hover:underline focus-ring", className)}
      onClick={event => event.stopPropagation()}
    >
      <Workflow className="h-3 w-3 shrink-0" aria-hidden="true" />
      {label}
    </Link>
  );
}
