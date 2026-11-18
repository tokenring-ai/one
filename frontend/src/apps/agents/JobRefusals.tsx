import type { JobRecord } from "@tokenring-ai/agent/schema";
import { permissionPatternMatches } from "@tokenring-ai/chat/permissions/permissionIds";
import formatError from "@tokenring-ai/utility/error/formatError";
import { TriangleAlert } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { chatRPCClient, useAgentJobs, usePermissionGrants } from "../../rpc.ts";
import { Badge, Button, toastManager } from "../../ui/index.ts";
import { agentJobPath } from "./JobLink.tsx";

/** "1 action refused" / "3 actions refused". */
export function refusalLabel(count: number): string {
  return `${count} ${count === 1 ? "action" : "actions"} refused`;
}

/**
 * The warning that an unattended run finished without something it tried to do: the approval policy
 * refused it because nobody could (or did) answer. The run's status is unchanged, so this is what
 * makes it visible.
 */
export function RefusalBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span title="The run's approval limit refused these actions; it carried on without them">
      <Badge tone="warning">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        {refusalLabel(count)}
      </Badge>
    </span>
  );
}

/** "1 question answered by default" / "3 questions answered by default". */
export function unansweredLabel(count: number): string {
  return `${count} ${count === 1 ? "question" : "questions"} answered by default`;
}

/** Warns that an unattended run asked something nobody answered, so it went on with the default answer. */
export function UnansweredBadge({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span title="Nobody answered these questions in time; the run carried on with the default answer">
      <Badge tone="warning">
        <TriangleAlert className="h-3 w-3" aria-hidden="true" />
        {unansweredLabel(count)}
      </Badge>
    </span>
  );
}

/**
 * "Always allow" for the permission id a refusal names: saves the same grant the approval prompt
 * does, so the next run goes through. Shows "Allowed" once any grant (exact or wildcard) covers the id.
 */
function AllowPermission({ id, summary }: { id: string; summary?: string }) {
  const grants = usePermissionGrants().data?.grants;
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [busy, setBusy] = useState(false);
  const [granted, setGranted] = useState(false);
  const covered = granted || (grants ?? []).some(grant => !grant.ignoredReason && permissionPatternMatches(grant.id, id));

  const allow = async () => {
    const confirmed = await openConfirm({
      id: "agents:allow-permission",
      title: "Always allow this action",
      message: `The next run of any job, including unattended ones, will ${summary ? summary.charAt(0).toLowerCase() + summary.slice(1) : "do this"} (${id}) without asking. You can change this any time in Configuration → Permissions.`,
      confirmText: "Always allow",
      cancelText: "Cancel",
      variant: "warning",
      dontAskAgain: false,
    });
    if (!confirmed) return;
    setBusy(true);
    try {
      const result = await chatRPCClient.grantPermission(summary ? { id, summary } : { id });
      if (result.status === "rejected") toastManager.error(`Could not allow "${id}": ${result.message}`);
      else setGranted(true);
    } catch (error) {
      toastManager.error(`Could not allow "${id}": ${formatError(error, { includeStack: false })}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <span className="ml-2 inline-flex items-center gap-1.5 align-middle">
      <code className="text-muted">{id}</code>
      {covered ? (
        <Badge tone="success">Allowed</Badge>
      ) : (
        <Button variant="ghost" busy={busy} onClick={() => void allow()} aria-label={`Always allow ${id}`}>
          Always allow
        </Button>
      )}
      <ConfirmDialog />
    </span>
  );
}

/** The refused actions of a job, as a list under its row. */
export function RefusalList({ job }: { job: Pick<JobRecord, "refusals" | "refusalCount"> }) {
  if (job.refusalCount <= 0) return null;
  const more = job.refusalCount - job.refusals.length;
  return (
    <div className="mt-1 text-xs text-warning" data-testid="job-refusals">
      <p className="font-medium">{refusalLabel(job.refusalCount)}, because nobody could approve them:</p>
      <ul className="ml-4 list-disc">
        {job.refusals.map((refusal, index) => (
          // Refusals have no id; the list only ever grows, so the position is stable.
          <li key={index} className="break-words">
            <span className="font-medium">{refusal.tool}</span> (level {refusal.level}): {refusal.message}
            {refusal.permissionId ? (
              <AllowPermission id={refusal.permissionId} {...(refusal.permissionSummary ? { summary: refusal.permissionSummary } : {})} />
            ) : null}
          </li>
        ))}
        {more > 0 ? <li>and {more} more</li> : null}
      </ul>
    </div>
  );
}

/** The questions of a job that nobody answered, with the default each took. */
export function UnansweredList({ job }: { job: Pick<JobRecord, "unanswered" | "unansweredCount"> }) {
  if (job.unansweredCount <= 0) return null;
  const more = job.unansweredCount - job.unanswered.length;
  return (
    <div className="mt-1 text-xs text-warning" data-testid="job-unanswered">
      <p className="font-medium">{unansweredLabel(job.unansweredCount)}:</p>
      <ul className="ml-4 list-disc">
        {job.unanswered.map((entry, index) => (
          // Entries have no id; the list only ever grows, so the position is stable.
          <li key={index} className="break-words">
            Asked: {entry.question} {"\u2192"} used default: {entry.answer}
            <span className="text-muted"> ({entry.reason === "nobody" ? "nobody could answer" : "no answer by the deadline"})</span>
          </li>
        ))}
        {more > 0 ? <li>and {more} more</li> : null}
      </ul>
    </div>
  );
}

/** The refusal and defaulted-question badges of the job with this id, from the live job list; links to the job. Nothing when there are none. */
export function JobRefusalBadge({ jobId }: { jobId: string }) {
  const jobs = useAgentJobs().data?.jobs;
  const job = jobs?.find(candidate => candidate.id === jobId);
  const count = job?.refusalCount ?? 0;
  const unanswered = job?.unansweredCount ?? 0;
  if (count <= 0 && unanswered <= 0) return null;
  return (
    <Link to={agentJobPath(jobId)} className="inline-flex gap-1 rounded focus-ring" onClick={event => event.stopPropagation()}>
      <RefusalBadge count={count} />
      <UnansweredBadge count={unanswered} />
    </Link>
  );
}
