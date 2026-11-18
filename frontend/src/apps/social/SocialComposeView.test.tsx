import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

type XAccounts = Array<{ name: string; maxMessageLength: number }> | null;
type RedditAccounts = { accounts: Array<{ name: string }>; titleMaxLength: number } | null;

let xAccounts: XAccounts = [{ name: "priya", maxMessageLength: 280 }];
let redditAccounts: RedditAccounts = { accounts: [{ name: "priya_r" }], titleMaxLength: 300 };
const swr = (data: unknown) => ({ data, isLoading: false, error: undefined, isValidating: false, mutate: async () => undefined });

const createPost = mock(async (_args: { text: string; account: string }) => ({
  status: "success" as const,
  account: "priya",
  id: "42",
  url: "https://x.com/i/status/42",
}));
const submitPost = mock(async (_args: { subreddit: string; title: string; text: string; account: string }) => ({
  status: "success" as const,
  account: "priya_r",
  subreddit: "writing",
  id: "t3_abc",
  url: "https://www.reddit.com/r/writing/comments/abc/title/",
}));

type GrantsData = {
  status: "success";
  grants: Array<{ id: string; grantedAt: string; uses: number; source: "global"; ignoredReason?: string }>;
  maxGrantLevel: number;
};
let grants: GrantsData | undefined = { status: "success", grants: [], maxGrantLevel: 8 };
let grantsError: Error | undefined;
let schedulerError: Error | undefined;
let schedules: unknown[] = [];
let history: Record<string, unknown[]> = {};
let agentTypes: Array<{ type: string; displayName: string }> | undefined = [{ type: "social", displayName: "Social" }];

const listPermissionGrants = mock(async (_args: unknown): Promise<GrantsData> => {
  if (grantsError) throw grantsError;
  return grants!;
});
const grantPermission = mock(
  async (args: { id: string; summary?: string }): Promise<{ status: "success"; grant: unknown } | { status: "rejected"; message: string }> => ({
    status: "success",
    grant: { id: args.id, grantedAt: "2026-11-16T00:00:00Z", uses: 0, source: "global" },
  }),
);
const addSchedule = mock(
  async (_args: { name: string; schedule: { at?: string; action: { kind: string; tool?: string; agentType?: string; input?: unknown } } }) => ({
    message: "added",
  }),
);
const removeSchedule = mock(async (_args: { name: string }) => ({ message: "removed" }));

// Spread the real module: the registry imports more than this view uses.
const realRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...realRpc,
  useXAccounts: () => swr(xAccounts),
  useRedditAccounts: () => swr(redditAccounts),
  xRPCClient: { createPost },
  redditRPCClient: { submitPost },
  chatRPCClient: { listPermissionGrants, grantPermission },
  schedulerRPCClient: { addSchedule, removeSchedule },
  usePermissionGrants: () => ({ ...swr(grants), error: grantsError }),
  useSchedules: () => ({ ...swr(schedulerError ? undefined : { running: true, schedules }), error: schedulerError }),
  useSchedulerHistory: () => swr({ history }),
  useAgentTypes: () => swr(agentTypes),
  useAgentJobs: () => swr({ jobs: [] }),
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutView } = await import("../../test/layout.tsx");
const { SOCIAL_VIEWS } = await import("./views.ts");
const composeView = SOCIAL_VIEWS.find(v => v.id === "social-compose")!;

async function render() {
  renderLayoutView(composeView);
  const user = userEvent.setup();
  return { user };
}

describe("Social Compose view", () => {
  beforeEach(() => {
    xAccounts = [{ name: "priya", maxMessageLength: 280 }];
    redditAccounts = { accounts: [{ name: "priya_r" }], titleMaxLength: 300 };
    createPost.mockClear();
    submitPost.mockClear();
    grants = { status: "success", grants: [], maxGrantLevel: 8 };
    grantsError = undefined;
    schedulerError = undefined;
    schedules = [];
    history = {};
    agentTypes = [{ type: "social", displayName: "Social" }];
    listPermissionGrants.mockClear();
    grantPermission.mockClear();
    addSchedule.mockClear();
    removeSchedule.mockClear();
  });

  it("lists connected accounts with a counter for X and keeps Post disabled until something valid is chosen", async () => {
    const { user } = await render();
    expect(await screen.findByLabelText("X: priya")).toBeTruthy();
    expect(screen.getByLabelText("Reddit: priya_r")).toBeTruthy();
    expect(screen.getByTestId("counter:x:priya").textContent).toBe("0 / 280");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Post"), "Hello");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true); // nothing selected
    await user.click(screen.getByLabelText("X: priya"));
    expect(screen.getByTestId("counter:x:priya").textContent).toBe("5 / 280");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
  });

  it("blocks an X post over the account's limit", async () => {
    xAccounts = [{ name: "priya", maxMessageLength: 10 }];
    const { user } = await render();
    await user.click(await screen.findByLabelText("X: priya"));
    await user.type(screen.getByLabelText("Post"), "this is far too long");
    expect(screen.getByRole("alert").textContent).toContain("over");
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("asks Reddit for a subreddit and a title", async () => {
    const { user } = await render();
    await user.type(await screen.findByLabelText("Post"), "Body text");
    await user.click(screen.getByLabelText("Reddit: priya_r"));
    expect(screen.getAllByRole("alert").map(a => a.textContent)).toEqual(["Reddit needs a subreddit.", "Reddit needs a title."]);
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText("Subreddit"), "r/writing");
    await user.type(screen.getByLabelText("Title"), "My title");
    expect(screen.queryAllByRole("alert")).toEqual([]);
    expect((screen.getByRole("button", { name: "Post" }) as HTMLButtonElement).disabled).toBe(false);
    expect(within(screen.getByLabelText("Preview")).getByText(/My title/)).toBeTruthy();
  });

  it("confirms naming each platform and account, and posts nothing when cancelled", async () => {
    const { user } = await render();
    await user.type(await screen.findByLabelText("Post"), "Hello");
    await user.click(screen.getByLabelText("X: priya"));
    await user.click(screen.getByLabelText("Reddit: priya_r"));
    await user.type(screen.getByLabelText("Subreddit"), "writing");
    await user.type(screen.getByLabelText("Title"), "Hi");
    await user.click(screen.getByRole("button", { name: "Post" }));

    const confirmText = (await screen.findByText(/This will post publicly to/)).textContent ?? "";
    expect(confirmText).toContain("X as priya");
    expect(confirmText).toContain("Reddit r/writing as priya_r");

    await user.click(screen.getByRole("button", { name: /cancel/i }));
    expect(createPost).not.toHaveBeenCalled();
    expect(submitPost).not.toHaveBeenCalled();
  });

  it("shows per-platform results with links, and does not re-select what failed to send twice", async () => {
    submitPost.mockImplementationOnce(async () => {
      throw new Error("SUBREDDIT_NOEXIST");
    });
    const { user } = await render();
    await user.type(await screen.findByLabelText("Post"), "Hello");
    await user.click(screen.getByLabelText("X: priya"));
    await user.click(screen.getByLabelText("Reddit: priya_r"));
    await user.type(screen.getByLabelText("Subreddit"), "writing");
    await user.type(screen.getByLabelText("Title"), "Hi");
    await user.click(screen.getByRole("button", { name: "Post" }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Post" }));

    const results = await screen.findByLabelText("Results");
    await waitFor(() => expect(within(results).getByText(/Posted: X as priya/)).toBeTruthy());
    expect(within(results).getByText(/Failed: Reddit r\/writing as priya_r\. SUBREDDIT_NOEXIST/)).toBeTruthy();
    expect(
      within(results)
        .getByRole("link", { name: /View post/ })
        .getAttribute("href"),
    ).toBe("https://x.com/i/status/42");
    expect(createPost).toHaveBeenCalledWith({ text: "Hello", account: "priya" });
    // X went out and is no longer selected; the failed Reddit post stays selected for a retry.
    expect((screen.getByLabelText("X: priya") as HTMLInputElement).checked).toBe(false);
    expect((screen.getByLabelText("Reddit: priya_r") as HTMLInputElement).checked).toBe(true);
  });

  async function chooseSchedule(user: ReturnType<typeof userEvent.setup>, when = "2099-01-02T09:30") {
    await user.type(await screen.findByLabelText("Post"), "Hello later");
    await user.click(screen.getByLabelText("X: priya"));
    await user.click(screen.getByLabelText("Schedule for later"));
    fireEvent.change(screen.getByLabelText(/^Post at/), { target: { value: when } });
  }

  it("shows the time zone and refuses a time that is not in the future", async () => {
    const { user } = await render();
    await chooseSchedule(user, "2001-01-02T09:30");
    expect(screen.getByLabelText(new RegExp(`Post at \\(${Intl.DateTimeFormat().resolvedOptions().timeZone}\\)`))).toBeTruthy();
    expect(screen.getByRole("alert").textContent).toBe("Pick a time in the future.");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole("button", { name: "Post" })).toBeNull();
  });

  it("schedules the exact text at the chosen instant when the account's grant exists, with no prompt", async () => {
    grants = { status: "success", grants: [{ id: "x.priya.post", grantedAt: "2026-11-16T00:00:00Z", uses: 0, source: "global" }], maxGrantLevel: 8 };
    const { user } = await render();
    await chooseSchedule(user);
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    await waitFor(() => expect(addSchedule).toHaveBeenCalledTimes(1));
    const call = addSchedule.mock.calls[0]![0];
    expect(call.name).toMatch(/^social-x-[0-9a-f]{8}$/);
    expect(call.schedule.at).toBe(new Date("2099-01-02T09:30").toISOString());
    expect(call.schedule.action).toEqual({ kind: "tool", agentType: "social", tool: "x_createPost", input: { text: "Hello later", account: "priya" } });
    expect(screen.queryByLabelText("Allow scheduled posting")).toBeNull();
    expect(grantPermission).not.toHaveBeenCalled();
    expect(createPost).not.toHaveBeenCalled();
    expect((await screen.findByLabelText("Scheduling results")).textContent).toContain("Scheduled: X as priya");
  });

  it("asks before scheduling without a grant, and grants then schedules on Allow and schedule", async () => {
    const { user } = await render();
    await chooseSchedule(user);
    await user.click(screen.getByRole("button", { name: "Schedule" }));

    const prompt = await screen.findByLabelText("Allow scheduled posting");
    expect(within(prompt).getByText("Scheduled posts publish without anyone approving them. Allow posting to X as priya automatically?")).toBeTruthy();
    expect(addSchedule).not.toHaveBeenCalled();
    expect(grantPermission).not.toHaveBeenCalled();
    const warning = prompt.textContent ?? "";
    expect(warning).toContain("permanent permission (x.priya.post)");
    expect(warning).toContain("every post to that account by any agent or schedule, not just this post");
    expect(warning).toContain("revoke it in Configuration > Permissions");

    await user.click(within(prompt).getByRole("button", { name: "Allow and schedule" }));
    await waitFor(() => expect(addSchedule).toHaveBeenCalledTimes(1));
    expect(grantPermission).toHaveBeenCalledWith({ id: "x.priya.post", summary: "Post on X as priya" });
    expect(grantPermission.mock.invocationCallOrder[0]!).toBeLessThan(addSchedule.mock.invocationCallOrder[0]!);
    expect(screen.queryByLabelText("Allow scheduled posting")).toBeNull();
  });

  it("schedules nothing when the prompt is cancelled", async () => {
    const { user } = await render();
    await chooseSchedule(user);
    await user.click(screen.getByRole("button", { name: "Schedule" }));
    const prompt = await screen.findByLabelText("Allow scheduled posting");
    await user.click(within(prompt).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByLabelText("Allow scheduled posting")).toBeNull();
    expect(grantPermission).not.toHaveBeenCalled();
    expect(addSchedule).not.toHaveBeenCalled();
  });

  it("does not schedule when the grant is refused", async () => {
    grantPermission.mockImplementationOnce(async () => ({ status: "rejected", message: "Grants are locked" }));
    const { user } = await render();
    await chooseSchedule(user);
    await user.click(screen.getByRole("button", { name: "Schedule" }));
    await user.click(within(await screen.findByLabelText("Allow scheduled posting")).getByRole("button", { name: "Allow and schedule" }));
    expect((await screen.findByText(/Could not allow posting to X as priya: Grants are locked/)).textContent).toBeTruthy();
    expect(addSchedule).not.toHaveBeenCalled();
  });

  it("covers a Reddit post with the reddit permission and the reddit tool input", async () => {
    grants = { status: "success", grants: [{ id: "reddit.*.post", grantedAt: "2026-11-16T00:00:00Z", uses: 0, source: "global" }], maxGrantLevel: 8 };
    const { user } = await render();
    await user.type(await screen.findByLabelText("Post"), "Body");
    await user.click(screen.getByLabelText("Reddit: priya_r"));
    await user.type(screen.getByLabelText("Subreddit"), "r/writing");
    await user.type(screen.getByLabelText("Title"), "Hi");
    await user.click(screen.getByLabelText("Schedule for later"));
    fireEvent.change(screen.getByLabelText(/^Post at/), { target: { value: "2099-01-02T09:30" } });
    await user.click(screen.getByRole("button", { name: "Schedule" }));
    await waitFor(() => expect(addSchedule).toHaveBeenCalledTimes(1));
    expect(addSchedule.mock.calls[0]![0].schedule.action).toEqual({
      kind: "tool",
      agentType: "social",
      tool: "reddit_submitPost",
      input: { subreddit: "writing", title: "Hi", text: "Body", account: "priya_r" },
    });
  });

  it("disables scheduling and explains when permission grants are unavailable", async () => {
    grants = undefined;
    grantsError = new Error("no PermissionService");
    const { user } = await render();
    await chooseSchedule(user);
    expect(screen.getByTestId("schedule-unavailable").textContent).toContain("Permission grants are not available");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("disables scheduling when grants cannot cover level 8", async () => {
    grants = { status: "success", grants: [], maxGrantLevel: 5 };
    const { user } = await render();
    await chooseSchedule(user);
    expect(screen.getByTestId("schedule-unavailable").textContent).toContain("highest grantable level is 5");
    expect((screen.getByRole("button", { name: "Schedule" }) as HTMLButtonElement).disabled).toBe(true);
  });

  it("schedules nothing when the grant check itself fails at click time", async () => {
    const { user } = await render();
    await chooseSchedule(user);
    grantsError = new Error("socket closed");
    await user.click(screen.getByRole("button", { name: "Schedule" }));
    expect((await screen.findByText(/Permission grants could not be read \(socket closed\), so nothing was scheduled/)).textContent).toBeTruthy();
    expect(addSchedule).not.toHaveBeenCalled();
  });

  describe("scheduled posts list", () => {
    const social = (name: string, at: string, tool: string, input: Record<string, unknown>, extra: Record<string, unknown> = {}) => ({
      name,
      source: "user",
      enabled: true,
      state: "scheduled",
      lastRunTime: 0,
      nextRunTime: Date.parse(at),
      error: null,
      currentRun: null,
      definition: { at, action: { kind: "tool", agentType: "social", tool, input } },
      ...extra,
    });

    it("lists upcoming social schedules only, soonest first, and cancels one", async () => {
      schedules = [
        social("social-x-bbbbbbbb", "2099-03-01T10:00:00.000Z", "x_createPost", { text: "Second post", account: "priya" }),
        social("social-reddit-aaaaaaaa", "2099-02-01T10:00:00.000Z", "reddit_submitPost", {
          subreddit: "writing",
          title: "Hi",
          text: "First post",
          account: "priya_r",
        }),
        { ...social("nightly", "2099-02-01T10:00:00.000Z", "x_createPost", { text: "not social", account: "priya" }) },
      ];
      const { user } = await render();
      const list = await screen.findByLabelText("Scheduled posts");
      const items = within(list).getAllByRole("listitem");
      expect(items.map(i => i.getAttribute("aria-label"))).toEqual(["social-reddit-aaaaaaaa", "social-x-bbbbbbbb"]);
      expect(items[0]!.textContent).toContain("Reddit as priya_r in r/writing");
      expect(items[0]!.textContent).toContain("Hi: First post");
      expect(items[1]!.textContent).toContain("Second post");

      await user.click(within(list).getByRole("button", { name: "Cancel social-x-bbbbbbbb" }));
      await user.click(await within(await screen.findByRole("dialog")).findByRole("button", { name: "Cancel the post" }));
      await waitFor(() => expect(removeSchedule).toHaveBeenCalledWith({ name: "social-x-bbbbbbbb" }));
    });

    it("shows a refused run with its reason and a link to Agent jobs", async () => {
      schedules = [
        social(
          "social-x-cccccccc",
          "2026-11-01T10:00:00.000Z",
          "x_createPost",
          { text: "Missed", account: "priya" },
          { state: "paused", enabled: false, lastRunTime: 1 },
        ),
      ];
      history = {
        "social-x-cccccccc": [
          {
            id: "r1",
            scheduledFor: 1,
            startTime: 1,
            endTime: 2,
            status: "failed",
            message: 'Not run: "Post on X as priya?" needs approval and nobody was there to give it. Allow `x.priya.post` and run it again.',
            actionKind: "tool",
            jobId: "job-9",
            manual: false,
          },
        ],
      };
      await render();
      const item = await screen.findByLabelText("social-x-cccccccc");
      expect(within(item).getByText("Not posted")).toBeTruthy();
      expect(within(item).getByRole("alert").textContent).toContain("Allow `x.priya.post`");
      expect(within(item).getByRole("link", { name: "See the run in Agent jobs" }).getAttribute("href")).toBe("/agents/jobs?job=job-9");
      expect(within(item).getByRole("button", { name: "Remove social-x-cccccccc" })).toBeTruthy();
    });

    it("shows a posted one as posted", async () => {
      schedules = [
        social("social-x-dddddddd", "2026-11-01T10:00:00.000Z", "x_createPost", { text: "Done", account: "priya" }, { lastRunTime: 1, enabled: false }),
      ];
      history = {
        "social-x-dddddddd": [
          { id: "r2", scheduledFor: 1, startTime: 1, endTime: 2, status: "completed", message: "Posted 42", actionKind: "tool", jobId: "job-1", manual: false },
        ],
      };
      await render();
      expect(within(await screen.findByLabelText("social-x-dddddddd")).getByText("Posted")).toBeTruthy();
    });
  });

  it("explains when no account is connected", async () => {
    xAccounts = null;
    redditAccounts = null;
    await render();
    expect(await screen.findByText("No accounts connected")).toBeTruthy();
  });
});
