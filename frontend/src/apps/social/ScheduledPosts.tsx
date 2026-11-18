import formatError from "@tokenring-ai/utility/error/formatError";
import { useState } from "react";
import { Link } from "react-router-dom";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { schedulerRPCClient, useSchedulerHistory, useSchedules } from "../../rpc.ts";
import { Badge, Button, toastManager } from "../../ui";
import { AGENT_JOBS_PATH, agentJobPath } from "../agents/JobLink.tsx";
import { JobRefusalBadge } from "../agents/JobRefusals.tsx";
import { formatSendTime, type ScheduledPost, scheduledPosts } from "./compose.ts";

const STATUS: Record<ScheduledPost["status"], { label: string; tone: "info" | "success" | "danger" | "neutral" | "warning" }> = {
  upcoming: { label: "Scheduled", tone: "info" },
  running: { label: "Posting", tone: "warning" },
  posted: { label: "Posted", tone: "success" },
  failed: { label: "Not posted", tone: "danger" },
  cancelled: { label: "Cancelled", tone: "neutral" },
  missed: { label: "Missed, not posted", tone: "warning" },
};

function preview(post: ScheduledPost): string {
  const body = post.platform === "reddit" ? `${post.title ?? ""}: ${post.text}` : post.text;
  return body.length > 140 ? `${body.slice(0, 139)}…` : body;
}

/**
 * Social posts scheduled from Compose (schedules named `social-…`): when, where, a preview, and Cancel.
 * A post that went out, failed, or was refused stays listed with the reason until it is removed. A refusal
 * (no permission was granted when it ran) links to the Agent jobs view, where Always allow lives.
 */
export default function ScheduledPosts() {
  const schedules = useSchedules();
  const history = useSchedulerHistory();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [removing, setRemoving] = useState<string | null>(null);
  const posts = scheduledPosts(schedules.data?.schedules, history.data?.history);

  if (posts.length === 0) return null;

  const remove = async (post: ScheduledPost) => {
    const upcoming = post.status === "upcoming";
    if (upcoming) {
      const confirmed = await openConfirm({
        title: "Cancel scheduled post?",
        message: `The post to ${post.platformLabel} as ${post.account} for ${formatSendTime(post.at)} will not be published.`,
        confirmText: "Cancel the post",
        cancelText: "Keep it",
        variant: "warning",
        dontAskAgain: false,
      });
      if (!confirmed) return;
    }
    setRemoving(post.name);
    try {
      await schedulerRPCClient.removeSchedule({ name: post.name });
      void schedules.mutate();
    } catch (error) {
      toastManager.error(`Could not ${upcoming ? "cancel" : "remove"} the post: ${formatError(error, { includeStack: false })}`);
    } finally {
      setRemoving(null);
    }
  };

  return (
    <section className="space-y-2" aria-label="Scheduled posts">
      <p className="text-xs font-bold text-muted uppercase tracking-widest">Scheduled posts</p>
      <ul className="space-y-2">
        {posts.map(post => {
          const { label, tone } = STATUS[post.status];
          const upcoming = post.status === "upcoming";
          return (
            <li key={post.name} aria-label={post.name} className="border border-primary rounded-xl p-3 space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone={tone}>{label}</Badge>
                <span className="text-sm font-medium text-primary">{formatSendTime(post.at)}</span>
                <span className="text-xs text-muted">
                  {post.platformLabel} as {post.account}
                  {post.subreddit ? ` in r/${post.subreddit}` : ""}
                </span>
                <span className="flex-1" />
                {post.status !== "running" && (
                  <Button
                    variant="ghost"
                    busy={removing === post.name}
                    onClick={() => void remove(post)}
                    aria-label={`${upcoming ? "Cancel" : "Remove"} ${post.name}`}
                  >
                    {upcoming ? "Cancel" : "Remove"}
                  </Button>
                )}
              </div>
              <p className="text-sm text-secondary whitespace-pre-wrap break-words">{preview(post)}</p>
              {post.reason && (
                <p role="alert" className="text-xs text-danger break-words">
                  {post.reason}
                </p>
              )}
              {(post.status === "failed" || post.status === "posted") && post.jobId && (
                <p className="flex flex-wrap items-center gap-2 text-xs">
                  <JobRefusalBadge jobId={post.jobId} />
                  <Link to={agentJobPath(post.jobId)} className="underline text-accent-soft focus-ring rounded">
                    See the run in Agent jobs
                  </Link>
                </p>
              )}
            </li>
          );
        })}
      </ul>
      <p className="text-xs text-muted">
        Posts go out unattended at their time, only while the scheduler is running and the account's permission is granted. Anything refused shows in{" "}
        <Link to={AGENT_JOBS_PATH} className="underline focus-ring rounded">
          Agent jobs
        </Link>
        , where it can be allowed.
      </p>
      <ConfirmDialog />
    </section>
  );
}
