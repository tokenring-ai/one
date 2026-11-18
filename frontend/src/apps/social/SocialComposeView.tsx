import { CalendarClock, ExternalLink, Send } from "lucide-react";
import { useMemo, useState } from "react";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import {
  chatRPCClient,
  redditRPCClient,
  schedulerRPCClient,
  useAgentTypes,
  usePermissionGrants,
  useRedditAccounts,
  useSchedules,
  useXAccounts,
  xRPCClient,
} from "../../rpc.ts";
import { Button, Checkbox, EmptyState, LoadingState, TextArea, TextField, ViewShell } from "../../ui";
import {
  browserTimeZone,
  buildTargets,
  type ComposeClients,
  type ComposeTarget,
  confirmMessage,
  EMPTY_INPUT,
  findMissingGrants,
  formatSendTime,
  grantPosting,
  grantPromptMessage,
  type PostResult,
  pickAgentType,
  postPermissionId,
  previewText,
  type ScheduleClients,
  type ScheduleResult,
  schedulePosts,
  schedulingUnavailable,
  sendPost,
  sendTimeProblem,
  sendTimeToIso,
  type TargetInput,
  targetLabel,
  targetProblems,
} from "./compose.ts";
import ScheduledPosts from "./ScheduledPosts.tsx";

const DEFAULT_REDDIT_TITLE_MAX = 300;

const clients: ComposeClients = {
  xCreatePost: args => xRPCClient.createPost(args),
  redditSubmitPost: args => redditRPCClient.submitPost(args),
};

const scheduleClients: ScheduleClients = {
  listGrants: () => chatRPCClient.listPermissionGrants({}),
  grant: args => chatRPCClient.grantPermission(args),
  addSchedule: args => schedulerRPCClient.addSchedule(args),
};

/**
 * Write one post and send it to several platforms. Clicking Post is the approval (after a confirm that
 * names every platform and account), so this does not go through agent tool approval.
 *
 * "Schedule for later" fixes the exact text now and posts it unattended at the chosen time. Nobody can
 * approve it then, so it only works with a permission grant for the account; when there is none, an inline
 * prompt offers to grant it (the same grant "Always allow" saves, revocable in Configuration).
 */
export default function SocialComposeView() {
  const xAccounts = useXAccounts();
  const redditAccounts = useRedditAccounts();
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const [text, setText] = useState("");
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [inputs, setInputs] = useState<Record<string, TargetInput>>({});
  const [results, setResults] = useState<PostResult[]>([]);
  const [posting, setPosting] = useState(false);
  const [later, setLater] = useState(false);
  const [sendAt, setSendAt] = useState("");
  const [scheduling, setScheduling] = useState(false);
  const [needsGrant, setNeedsGrant] = useState<ComposeTarget[] | null>(null);
  const [scheduleError, setScheduleError] = useState<string | null>(null);
  const [scheduled, setScheduled] = useState<(ScheduleResult & { label: string; at: number })[]>([]);

  const grants = usePermissionGrants();
  const schedulerState = useSchedules();
  const agentTypes = useAgentTypes();
  const agentType = pickAgentType(agentTypes.data);
  const unavailable = schedulingUnavailable({
    grants: { loaded: grants.data !== undefined, failed: grants.error !== undefined && grants.data === undefined, maxGrantLevel: grants.data?.maxGrantLevel },
    schedulerFailed: schedulerState.error !== undefined && schedulerState.data === undefined,
    agentTypeAvailable: agentType !== null || agentTypes.isLoading,
  });
  const timeProblem = later ? sendTimeProblem(sendAt) : null;

  const titleMax = redditAccounts.data?.titleMaxLength ?? DEFAULT_REDDIT_TITLE_MAX;
  const targets = useMemo(() => buildTargets(xAccounts.data, redditAccounts.data?.accounts), [xAccounts.data, redditAccounts.data]);
  const inputFor = (target: ComposeTarget): TargetInput => inputs[target.id] ?? EMPTY_INPUT;

  const chosen = targets.filter(t => selected.has(t.id));
  const problems = new Map(chosen.map(t => [t.id, targetProblems(t, text, inputFor(t), titleMax)]));
  const hasProblems = [...problems.values()].some(p => p.length > 0);
  const canPost = chosen.length > 0 && !hasProblems && !posting;
  const canSchedule = chosen.length > 0 && !hasProblems && !scheduling && timeProblem === null && unavailable === null && needsGrant === null;

  const toggle = (id: string, on: boolean) =>
    setSelected(prev => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  const setInput = (id: string, patch: Partial<TargetInput>) => setInputs(prev => ({ ...prev, [id]: { ...(prev[id] ?? EMPTY_INPUT), ...patch } }));

  async function post() {
    const toSend = chosen.map(target => ({ target, input: inputFor(target) }));
    const ok = await openConfirm({
      title: "Post now?",
      message: confirmMessage(toSend),
      confirmText: "Post",
      variant: "warning",
      dontAskAgain: false,
    });
    if (!ok) return;
    setPosting(true);
    setResults([]);
    try {
      const sent = await Promise.all(toSend.map(({ target, input }) => sendPost(target, text, input, clients)));
      setResults(sent);
      // What went out is not selected again, so a retry after a partial failure cannot post twice.
      setSelected(prev => new Set([...prev].filter(id => !sent.some(r => r.targetId === id && r.ok))));
    } finally {
      setPosting(false);
    }
  }

  async function createSchedules(toSchedule: ComposeTarget[]) {
    const picked = toSchedule.map(target => ({ target, input: inputFor(target) }));
    const at = sendTimeToIso(sendAt);
    const made = await schedulePosts(picked, text, at, agentType!, scheduleClients);
    setScheduled(
      made.map(result => ({
        ...result,
        label: targetLabel(targets.find(t => t.id === result.targetId)!, inputs[result.targetId] ?? EMPTY_INPUT),
        at: Date.parse(at),
      })),
    );
    // What is scheduled is not selected again, so a retry after a partial failure cannot schedule it twice.
    setSelected(prev => new Set([...prev].filter(id => !made.some(r => r.targetId === id && r.ok))));
    void schedulerState.mutate();
  }

  async function schedule() {
    setScheduleError(null);
    setScheduled([]);
    setScheduling(true);
    try {
      const check = await findMissingGrants(chosen, scheduleClients);
      if (check.status === "unavailable") {
        setScheduleError(check.reason);
        return;
      }
      if (check.missing.length > 0) {
        setNeedsGrant(check.missing);
        return;
      }
      await createSchedules(chosen);
    } finally {
      setScheduling(false);
    }
  }

  async function allowAndSchedule() {
    if (!needsGrant) return;
    setScheduleError(null);
    setScheduling(true);
    try {
      const granted = await grantPosting(needsGrant, scheduleClients);
      if (!granted.ok) {
        setScheduleError(granted.error);
        return;
      }
      setNeedsGrant(null);
      void grants.mutate();
      await createSchedules(chosen);
    } finally {
      setScheduling(false);
    }
  }

  if (xAccounts.isLoading || redditAccounts.isLoading) {
    return (
      <ViewShell pad="page" width="prose">
        <LoadingState message="Loading connected accounts..." />
      </ViewShell>
    );
  }

  if (targets.length === 0) {
    return (
      <ViewShell pad="page" width="prose">
        <EmptyState
          title="No accounts connected"
          hint="Connect an X or Reddit account in Platforms, then come back to post to several at once. Other platforms can only be posted to through the agent."
        />
      </ViewShell>
    );
  }

  return (
    <ViewShell pad="page" width="prose">
      <div className="space-y-4">
        <TextArea label="Post" value={text} onChange={setText} rows={6} placeholder="What do you want to say?" />

        <fieldset className="space-y-3">
          <legend className="text-xs font-bold text-muted uppercase tracking-widest mb-1">Post to</legend>
          {targets.map(target => {
            const on = selected.has(target.id);
            const input = inputFor(target);
            const length = text.trim().length;
            const over = target.maxLength !== undefined && length > target.maxLength;
            return (
              <div key={target.id} className="bg-secondary border border-primary rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between gap-3">
                  <Checkbox checked={on} onChange={value => toggle(target.id, value)} label={`${target.platformLabel}: ${target.account}`} />
                  {target.maxLength !== undefined && (
                    <span className={over ? "text-xs text-danger" : "text-xs text-muted"} data-testid={`counter:${target.id}`}>
                      {length} / {target.maxLength}
                    </span>
                  )}
                </div>
                {on && target.platform === "reddit" && (
                  <div className="grid gap-2 sm:grid-cols-2">
                    <TextField
                      label="Subreddit"
                      value={input.subreddit}
                      onChange={value => setInput(target.id, { subreddit: value })}
                      placeholder="r/writing"
                    />
                    <TextField
                      label="Title"
                      value={input.title}
                      onChange={value => setInput(target.id, { title: value })}
                      hint={`${input.title.trim().length} / ${titleMax}`}
                    />
                  </div>
                )}
                {on &&
                  (problems.get(target.id) ?? []).map(problem => (
                    <p key={problem} role="alert" className="text-xs text-danger">
                      {problem}
                    </p>
                  ))}
              </div>
            );
          })}
        </fieldset>

        {chosen.length > 0 && (
          <section className="space-y-2" aria-label="Preview">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Preview</p>
            {chosen.map(target => (
              <div key={target.id} className="border border-primary rounded-xl p-3">
                <p className="text-xs text-muted mb-1">{targetLabel(target, inputFor(target))}</p>
                <p className="text-sm text-primary whitespace-pre-wrap">{previewText(target, text, inputFor(target))}</p>
              </div>
            ))}
          </section>
        )}

        <fieldset className="space-y-2 bg-secondary border border-primary rounded-xl p-3">
          <legend className="text-xs font-bold text-muted uppercase tracking-widest px-1">When</legend>
          <Checkbox checked={later} onChange={setLater} label="Schedule for later" />
          {later && (
            <div className="space-y-1">
              <TextField
                label={`Post at (${browserTimeZone()})`}
                type="datetime-local"
                value={sendAt}
                onChange={value => {
                  setSendAt(value);
                  setNeedsGrant(null);
                }}
                hint={
                  sendAt && timeProblem === null
                    ? `${formatSendTime(new Date(sendAt).getTime())}. The text is fixed now and goes out unattended at that time.`
                    : "Your browser's time zone. The text is fixed now and goes out unattended at that time."
                }
              />
              {sendAt && timeProblem && (
                <p role="alert" className="text-xs text-danger">
                  {timeProblem}
                </p>
              )}
              {unavailable && (
                <p role="alert" className="text-xs text-danger" data-testid="schedule-unavailable">
                  {unavailable}
                </p>
              )}
            </div>
          )}
        </fieldset>

        {needsGrant && (
          <div role="group" aria-label="Allow scheduled posting" className="border border-warning bg-warning-subtle rounded-xl p-3 space-y-2">
            <p className="text-sm text-primary">{grantPromptMessage(needsGrant)}</p>
            <p className="text-xs text-muted">
              This saves a permanent permission ({needsGrant.map(postPermissionId).join(", ")}), the same one Always allow saves. It applies to every post to{" "}
              {needsGrant.length === 1 ? "that account" : "those accounts"} by any agent or schedule, not just this post. You can revoke it in Configuration
              {" > "}Permissions.
            </p>
            <div className="flex gap-2">
              <Button busy={scheduling} busyLabel="Scheduling..." onClick={() => void allowAndSchedule()}>
                Allow and schedule
              </Button>
              <Button variant="ghost" disabled={scheduling} onClick={() => setNeedsGrant(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center gap-3">
          {later ? (
            <Button
              icon={CalendarClock}
              disabled={!canSchedule}
              busy={scheduling && needsGrant === null}
              busyLabel="Scheduling..."
              onClick={() => void schedule()}
            >
              Schedule
            </Button>
          ) : (
            <Button icon={Send} disabled={!canPost} busy={posting} busyLabel="Posting..." onClick={() => void post()}>
              Post
            </Button>
          )}
          <p className="text-xs text-muted">Posts are public and cannot be unsent.</p>
        </div>

        {scheduleError && (
          <p role="alert" className="text-sm text-danger">
            {scheduleError}
          </p>
        )}

        {scheduled.length > 0 && (
          <section className="space-y-1" aria-label="Scheduling results">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Scheduling</p>
            {scheduled.map(result => (
              <p key={result.targetId} className={result.ok ? "text-sm text-success" : "text-sm text-danger"}>
                {result.ok
                  ? `Scheduled: ${result.label} for ${formatSendTime(result.at)}`
                  : `Not scheduled: ${result.label}. ${result.error ?? "Unknown error"}`}
              </p>
            ))}
          </section>
        )}

        {results.length > 0 && (
          <section className="space-y-1" aria-label="Results">
            <p className="text-xs font-bold text-muted uppercase tracking-widest">Results</p>
            {results.map(result => {
              const target = targets.find(t => t.id === result.targetId);
              const label = target ? targetLabel(target, inputFor(target)) : result.targetId;
              return (
                <p key={result.targetId} className={result.ok ? "text-sm text-success" : "text-sm text-danger"}>
                  {result.ok ? `Posted: ${label}` : `Failed: ${label}. ${result.error ?? "Unknown error"}`}
                  {result.url && (
                    <>
                      {" "}
                      <a href={result.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 underline">
                        View post <ExternalLink className="w-3 h-3" />
                      </a>
                    </>
                  )}
                </p>
              );
            })}
          </section>
        )}

        <ScheduledPosts />
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
