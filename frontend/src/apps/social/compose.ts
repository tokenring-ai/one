import { permissionPatternMatches, permissionSlug } from "@tokenring-ai/chat/permissions/permissionIds";
import { MISSED_RUN_MESSAGE, type ScheduleAction, type ScheduleDefinition, type ScheduleRun } from "@tokenring-ai/scheduler/schema";

/**
 * Pure logic for the Social Compose view: which platforms can be posted to, what each one requires,
 * and how a post is sent. Clicking Post in the UI is the approval, so this goes straight to the
 * platform plugins' RPC methods and never through agent tool approval.
 *
 * A scheduled post is different: nobody clicks anything when it goes out. It is a `tool` schedule that
 * runs the immediate post tool with the exact input fixed now, which only works when the tool's
 * permission is granted. The compose view asks for that grant when it schedules.
 */

export type ComposePlatform = "x" | "reddit";

export interface ComposeTarget {
  /** `<platform>:<account>`, unique per connected account. */
  id: string;
  platform: ComposePlatform;
  account: string;
  /** "X", "Reddit" */
  platformLabel: string;
  /** Longest post body the account will send, when the plugin defines one. */
  maxLength?: number;
}

/** What Reddit needs on top of the text. */
export interface TargetInput {
  subreddit: string;
  title: string;
}

export interface PostResult {
  targetId: string;
  ok: boolean;
  /** Link to the created post, when the platform returned one. */
  url?: string;
  error?: string;
}

export const EMPTY_INPUT: TargetInput = { subreddit: "", title: "" };

export function buildTargets(
  x: ReadonlyArray<{ name: string; maxMessageLength: number }> | null | undefined,
  reddit: ReadonlyArray<{ name: string }> | null | undefined,
): ComposeTarget[] {
  return [
    ...(x ?? []).map(a => ({ id: `x:${a.name}`, platform: "x" as const, account: a.name, platformLabel: "X", maxLength: a.maxMessageLength })),
    ...(reddit ?? []).map(a => ({ id: `reddit:${a.name}`, platform: "reddit" as const, account: a.name, platformLabel: "Reddit" })),
  ];
}

/** `r/Writing`, `/r/Writing` and `Writing` all mean the same subreddit. */
export function normalizeSubreddit(value: string): string {
  return value
    .trim()
    .replace(/^\/?r\//i, "")
    .trim();
}

export function targetLabel(target: ComposeTarget, input: TargetInput = EMPTY_INPUT): string {
  if (target.platform === "reddit") {
    const sr = normalizeSubreddit(input.subreddit);
    return `Reddit ${sr ? `r/${sr}` : "(subreddit needed)"} as ${target.account}`;
  }
  return `${target.platformLabel} as ${target.account}`;
}

/** What is wrong with this post for this platform, in plain words. Empty when it can be sent. */
export function targetProblems(target: ComposeTarget, text: string, input: TargetInput, redditTitleMax: number): string[] {
  const body = text.trim();
  const problems: string[] = [];
  if (!body) problems.push("Write something to post.");
  if (target.maxLength !== undefined && body.length > target.maxLength) {
    problems.push(`${target.platformLabel} allows ${target.maxLength} characters for ${target.account}; this is ${body.length - target.maxLength} over.`);
  }
  if (target.platform === "reddit") {
    if (!normalizeSubreddit(input.subreddit)) problems.push("Reddit needs a subreddit.");
    const title = input.title.trim();
    if (!title) problems.push("Reddit needs a title.");
    else if (title.length > redditTitleMax) problems.push(`Reddit titles are limited to ${redditTitleMax} characters.`);
  }
  return problems;
}

/** The plain text that will be posted to this platform. */
export function previewText(target: ComposeTarget, text: string, input: TargetInput): string {
  const body = text.trim();
  return target.platform === "reddit" ? `${input.title.trim()}\n\n${body}` : body;
}

/** The sentence the confirm dialog shows: every platform and account, and that it cannot be unsent. */
export function confirmMessage(targets: ReadonlyArray<{ target: ComposeTarget; input: TargetInput }>): string {
  const where = targets.map(({ target, input }) => targetLabel(target, input)).join("; ");
  return `This will post publicly to: ${where}. Posts cannot be unsent.`;
}

export interface ComposeClients {
  xCreatePost(args: { text: string; account: string }): Promise<{ url: string }>;
  redditSubmitPost(args: { subreddit: string; title: string; text: string; account: string }): Promise<{ url?: string }>;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Posts to one account. Never throws: a failure becomes a result so the other platforms still go out. */
export async function sendPost(target: ComposeTarget, text: string, input: TargetInput, clients: ComposeClients): Promise<PostResult> {
  try {
    if (target.platform === "x") {
      const { url } = await clients.xCreatePost({ text: text.trim(), account: target.account });
      return { targetId: target.id, ok: true, url };
    }
    const { url } = await clients.redditSubmitPost({
      subreddit: normalizeSubreddit(input.subreddit),
      title: input.title.trim(),
      text: text.trim(),
      account: target.account,
    });
    return { targetId: target.id, ok: true, ...(url && { url }) };
  } catch (error) {
    return { targetId: target.id, ok: false, error: errorMessage(error) };
  }
}

// ─── Scheduling ─────────────────────────────────────────────────────────────

/** The chat tool a scheduled post runs, per platform: the same one an agent uses to post now. */
export const POST_TOOLS: Record<ComposePlatform, string> = { x: "x_createPost", reddit: "reddit_submitPost" };

/** Every scheduled social post is a schedule named `social-<platform>-<short id>`. */
export const SOCIAL_SCHEDULE_PREFIX = "social-";

/** The agent type that runs scheduled posts when it exists; any other type works as well, as no model runs. */
export const PREFERRED_AGENT_TYPE = "social";

/** The permission id of posting from this account (the same id the posting tools carry, which is what one grant covers). */
export function postPermissionId(target: ComposeTarget): string {
  return `${target.platform}.${permissionSlug(target.account)}.post`;
}

export function postPermissionSummary(target: ComposeTarget): string {
  return `Post on ${target.platformLabel} as ${target.account}`;
}

/** What `listPermissionGrants` returns, as far as this view reads it. */
export interface GrantList {
  grants: ReadonlyArray<{ id: string; ignoredReason?: string | undefined }>;
  maxGrantLevel: number;
}

/** Approval level of a public post; a grant can cover it only when the operator's grantable maximum is at least this. */
export const POST_APPROVAL_LEVEL = 8;

/** Whether a grant already covers posting from this account. Grants that are not in effect do not count. */
export function isPostAllowed(target: ComposeTarget, list: Pick<GrantList, "grants">): boolean {
  const id = postPermissionId(target);
  return list.grants.some(grant => !grant.ignoredReason && permissionPatternMatches(grant.id, id));
}

/** Why scheduling is not offered, or null when it is. */
export function schedulingUnavailable(state: {
  grants: { loaded: boolean; failed: boolean; maxGrantLevel?: number | undefined };
  schedulerFailed: boolean;
  agentTypeAvailable: boolean;
}): string | null {
  if (state.schedulerFailed) return "The scheduler is not available, so posts cannot be scheduled.";
  if (state.grants.failed) return "Permission grants are not available, and a scheduled post can only go out unattended with one. Post now instead.";
  if (state.grants.maxGrantLevel !== undefined && state.grants.maxGrantLevel < POST_APPROVAL_LEVEL) {
    return `This installation does not allow permanent permissions for public posts (the highest grantable level is ${state.grants.maxGrantLevel}, a post is level ${POST_APPROVAL_LEVEL}), and a scheduled post needs one. Post now instead.`;
  }
  if (!state.agentTypeAvailable) return "No agent type is available to run a scheduled post.";
  return null;
}

/** The agent type to run scheduled posts in: `social` when it exists, else the first one; null when there is none. */
export function pickAgentType(types: ReadonlyArray<{ type: string }> | null | undefined): string | null {
  if (!types || types.length === 0) return null;
  return (types.find(t => t.type === PREFERRED_AGENT_TYPE) ?? types[0])?.type ?? null;
}

/** What is wrong with a `datetime-local` value as a send time, in plain words; null when it is a future time. */
export function sendTimeProblem(value: string, now = Date.now()): string | null {
  if (!value.trim()) return "Pick a date and time to post.";
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return "That is not a date and time.";
  if (time <= now) return "Pick a time in the future.";
  return null;
}

/** A `datetime-local` value (read in the browser's time zone) as an ISO instant. */
export function sendTimeToIso(value: string): string {
  return new Date(value).toISOString();
}

/** The browser's time zone, e.g. "Europe/Paris", for showing next to the time picker. */
export function browserTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
  } catch {
    return "UTC";
  }
}

export function formatSendTime(ms: number): string {
  return new Date(ms).toLocaleString(undefined, { weekday: "short", year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

/** The tool call a scheduled post makes: exactly what the immediate tool takes. */
export function postToolInput(target: ComposeTarget, text: string, input: TargetInput): Record<string, unknown> {
  if (target.platform === "x") return { text: text.trim(), account: target.account };
  return { subreddit: normalizeSubreddit(input.subreddit), title: input.title.trim(), text: text.trim(), account: target.account };
}

export function buildScheduleAction(target: ComposeTarget, text: string, input: TargetInput, agentType: string): ScheduleAction {
  return { kind: "tool", agentType, tool: POST_TOOLS[target.platform], input: postToolInput(target, text, input) };
}

/** `social-x-1a2b3c4d`: unique per post. */
export function newScheduleName(target: ComposeTarget, id: string = crypto.randomUUID()): string {
  return `${SOCIAL_SCHEDULE_PREFIX}${target.platform}-${id.slice(0, 8)}`;
}

export interface ScheduleClients {
  listGrants(): Promise<GrantList>;
  grant(args: { id: string; summary: string }): Promise<{ status: "success" } | { status: "rejected"; message: string }>;
  addSchedule(args: { name: string; schedule: ScheduleDefinition }): Promise<unknown>;
}

/** The accounts among `targets` that no grant covers yet, or why grants cannot be read. */
export async function findMissingGrants(
  targets: ReadonlyArray<ComposeTarget>,
  clients: Pick<ScheduleClients, "listGrants">,
): Promise<{ status: "ok"; missing: ComposeTarget[] } | { status: "unavailable"; reason: string }> {
  let list: GrantList;
  try {
    list = await clients.listGrants();
  } catch (error) {
    return { status: "unavailable", reason: `Permission grants could not be read (${errorMessage(error)}), so nothing was scheduled.` };
  }
  if (list.maxGrantLevel < POST_APPROVAL_LEVEL) {
    return {
      status: "unavailable",
      reason: schedulingUnavailable({
        grants: { loaded: true, failed: false, maxGrantLevel: list.maxGrantLevel },
        schedulerFailed: false,
        agentTypeAvailable: true,
      })!,
    };
  }
  return { status: "ok", missing: targets.filter(target => !isPostAllowed(target, list)) };
}

/** Saves the grant for each account (the same grant "Always allow" saves). Stops at the first one that is refused. */
export async function grantPosting(
  targets: ReadonlyArray<ComposeTarget>,
  clients: Pick<ScheduleClients, "grant">,
): Promise<{ ok: true } | { ok: false; error: string }> {
  for (const target of targets) {
    try {
      const result = await clients.grant({ id: postPermissionId(target), summary: postPermissionSummary(target) });
      if (result.status === "rejected") return { ok: false, error: `Could not allow posting to ${targetLabel(target)}: ${result.message}` };
    } catch (error) {
      return { ok: false, error: `Could not allow posting to ${targetLabel(target)}: ${errorMessage(error)}` };
    }
  }
  return { ok: true };
}

export interface ScheduleResult {
  targetId: string;
  ok: boolean;
  name?: string;
  error?: string;
}

/** Creates one schedule per account. Never throws: a failure becomes a result so the other accounts are still scheduled. */
export async function schedulePosts(
  targets: ReadonlyArray<{ target: ComposeTarget; input: TargetInput }>,
  text: string,
  atIso: string,
  agentType: string,
  clients: Pick<ScheduleClients, "addSchedule">,
): Promise<ScheduleResult[]> {
  return await Promise.all(
    targets.map(async ({ target, input }): Promise<ScheduleResult> => {
      const name = newScheduleName(target);
      try {
        await clients.addSchedule({ name, schedule: { at: atIso, action: buildScheduleAction(target, text, input, agentType) } });
        return { targetId: target.id, ok: true, name };
      } catch (error) {
        return { targetId: target.id, ok: false, error: errorMessage(error) };
      }
    }),
  );
}

/** The sentence under the grant prompt. */
export function grantPromptMessage(targets: ReadonlyArray<ComposeTarget>): string {
  const accounts = targets.map(target => `${target.platformLabel} as ${target.account}`).join(", ");
  return `Scheduled posts publish without anyone approving them. Allow posting to ${accounts} automatically?`;
}

// ─── The scheduled posts list ───────────────────────────────────────────────

/** One scheduled (or finished) social post, as the list shows it. */
export interface ScheduledPost {
  name: string;
  platform: ComposePlatform;
  platformLabel: string;
  account: string;
  /** What will be (or was) posted. */
  text: string;
  /** Reddit only */
  subreddit?: string;
  title?: string;
  /** When it is set to go out, ms since the epoch. */
  at: number;
  /** upcoming: waiting for its time. running. posted. failed: its run failed or was refused; see `reason`. */
  status: "upcoming" | "running" | "posted" | "failed" | "cancelled" | "missed";
  reason?: string;
  jobId?: string | null;
}

interface ScheduleViewLike {
  name: string;
  definition: ScheduleDefinition;
  state: string;
  lastRunTime: number;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The social posts among the scheduler's schedules, soonest first; others are ignored. */
export function scheduledPosts(
  schedules: ReadonlyArray<ScheduleViewLike> | undefined,
  history: Readonly<Record<string, ReadonlyArray<ScheduleRun>>> | undefined,
): ScheduledPost[] {
  const posts: ScheduledPost[] = [];
  for (const schedule of schedules ?? []) {
    const { action, at } = schedule.definition;
    if (!schedule.name.startsWith(SOCIAL_SCHEDULE_PREFIX) || action.kind !== "tool" || at === undefined) continue;
    const platform = (Object.entries(POST_TOOLS) as Array<[ComposePlatform, string]>).find(([, tool]) => tool === action.tool)?.[0];
    if (!platform) continue;
    const time = Date.parse(at);
    if (Number.isNaN(time)) continue;
    const run = history?.[schedule.name]?.at(-1);
    let status: ScheduledPost["status"] = "upcoming";
    let reason: string | undefined;
    if (run) {
      status =
        run.message === MISSED_RUN_MESSAGE
          ? "missed"
          : run.status === "running"
            ? "running"
            : run.status === "completed"
              ? "posted"
              : run.status === "cancelled"
                ? "cancelled"
                : "failed";
      if (status === "missed") reason = "Missed, not posted: the app was not running at the scheduled time.";
      else if (status === "failed" || status === "cancelled")
        reason = run.message || (run.status === "interrupted" ? "Interrupted by a restart" : "The run failed");
    } else if (schedule.lastRunTime > 0) {
      status = "running";
    }
    const input = action.input;
    posts.push({
      name: schedule.name,
      platform,
      platformLabel: platform === "x" ? "X" : "Reddit",
      account: str(input.account),
      text: str(input.text),
      ...(platform === "reddit" ? { subreddit: str(input.subreddit), title: str(input.title) } : {}),
      at: time,
      status,
      ...(reason !== undefined ? { reason } : {}),
      jobId: run?.jobId ?? null,
    });
  }
  return posts.sort((a, b) => a.at - b.at);
}
