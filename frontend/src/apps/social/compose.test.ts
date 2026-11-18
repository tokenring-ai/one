import { describe, expect, it, mock } from "bun:test";
import {
  buildScheduleAction,
  buildTargets,
  type ComposeClients,
  confirmMessage,
  findMissingGrants,
  isPostAllowed,
  normalizeSubreddit,
  postPermissionId,
  previewText,
  scheduledPosts,
  schedulePosts,
  sendPost,
  sendTimeProblem,
  targetProblems,
} from "./compose.ts";

const [x, reddit] = buildTargets([{ name: "priya", maxMessageLength: 280 }], [{ name: "priya_r" }]) as [
  ReturnType<typeof buildTargets>[number],
  ReturnType<typeof buildTargets>[number],
];
const input = { subreddit: "", title: "" };

describe("compose targets", () => {
  it("builds one target per connected account, with the plugin's limit", () => {
    expect(x).toMatchObject({ id: "x:priya", platform: "x", maxLength: 280 });
    expect(reddit).toMatchObject({ id: "reddit:priya_r", platform: "reddit" });
    expect(reddit.maxLength).toBeUndefined();
    expect(buildTargets(null, undefined)).toEqual([]);
  });

  it("normalizes subreddit spellings", () => {
    expect(normalizeSubreddit(" r/Writing ")).toBe("Writing");
    expect(normalizeSubreddit("/r/Writing")).toBe("Writing");
    expect(normalizeSubreddit("Writing")).toBe("Writing");
  });
});

describe("targetProblems", () => {
  it("needs some text", () => {
    expect(targetProblems(x, "   ", input, 300)).toEqual(["Write something to post."]);
  });

  it("checks the account's character limit", () => {
    expect(targetProblems(x, "a".repeat(280), input, 300)).toEqual([]);
    expect(targetProblems(x, "a".repeat(285), input, 300)[0]).toContain("5 over");
  });

  it("needs a subreddit and a title for Reddit, and keeps titles short enough", () => {
    expect(targetProblems(reddit, "hello", input, 300)).toEqual(["Reddit needs a subreddit.", "Reddit needs a title."]);
    expect(targetProblems(reddit, "hello", { subreddit: "r/writing", title: "Hi" }, 300)).toEqual([]);
    expect(targetProblems(reddit, "hello", { subreddit: "writing", title: "t".repeat(301) }, 300)).toEqual(["Reddit titles are limited to 300 characters."]);
  });

  it("does not apply the X limit to Reddit bodies", () => {
    expect(targetProblems(reddit, "a".repeat(5000), { subreddit: "writing", title: "Hi" }, 300)).toEqual([]);
  });
});

describe("preview and confirm", () => {
  it("previews the text each platform will receive", () => {
    expect(previewText(x, "  Hello  ", input)).toBe("Hello");
    expect(previewText(reddit, "Body", { subreddit: "writing", title: "Title" })).toBe("Title\n\nBody");
  });

  it("names every platform and account and says it cannot be unsent", () => {
    const message = confirmMessage([
      { target: x, input },
      { target: reddit, input: { subreddit: "r/writing", title: "Hi" } },
    ]);
    expect(message).toContain("X as priya");
    expect(message).toContain("Reddit r/writing as priya_r");
    expect(message).toContain("cannot be unsent");
  });
});

describe("sendPost", () => {
  const clients = (): ComposeClients => ({
    xCreatePost: mock(async () => ({ url: "https://x.com/i/status/1" })),
    redditSubmitPost: mock(async () => ({ url: "https://reddit.com/r/writing/comments/abc" })),
  });

  it("posts to X and returns the link", async () => {
    const c = clients();
    expect(await sendPost(x, " Hello ", input, c)).toEqual({ targetId: "x:priya", ok: true, url: "https://x.com/i/status/1" });
    expect(c.xCreatePost).toHaveBeenCalledWith({ text: "Hello", account: "priya" });
  });

  it("posts to Reddit with a normalized subreddit", async () => {
    const c = clients();
    const result = await sendPost(reddit, "Body", { subreddit: "r/writing", title: " Title " }, c);
    expect(result).toEqual({ targetId: "reddit:priya_r", ok: true, url: "https://reddit.com/r/writing/comments/abc" });
    expect(c.redditSubmitPost).toHaveBeenCalledWith({ subreddit: "writing", title: "Title", text: "Body", account: "priya_r" });
  });

  it("turns a failure into a result instead of throwing", async () => {
    const c: ComposeClients = { ...clients(), xCreatePost: async () => Promise.reject(new Error("401 Unauthorized")) };
    expect(await sendPost(x, "Hello", input, c)).toEqual({ targetId: "x:priya", ok: false, error: "401 Unauthorized" });
  });
});

describe("scheduling helpers", () => {
  it("names the same permission id the posting tools carry", () => {
    expect(postPermissionId(x)).toBe("x.priya.post");
    expect(postPermissionId({ ...reddit, account: "My Brand.Co" })).toBe("reddit.my-brand-co-608ccd1f8629a469.post");
  });

  it("builds the tool action with exactly the immediate tool's input", () => {
    expect(buildScheduleAction(x, " Hi ", input, "social")).toEqual({
      kind: "tool",
      agentType: "social",
      tool: "x_createPost",
      input: { text: "Hi", account: "priya" },
    });
    expect(buildScheduleAction(reddit, " Body ", { subreddit: "r/writing", title: " T " }, "social")).toEqual({
      kind: "tool",
      agentType: "social",
      tool: "reddit_submitPost",
      input: { subreddit: "writing", title: "T", text: "Body", account: "priya_r" },
    });
  });

  it("counts only grants in effect, including wildcards", () => {
    expect(isPostAllowed(x, { grants: [{ id: "x.priya.post" }] })).toBe(true);
    expect(isPostAllowed(x, { grants: [{ id: "x.**" }] })).toBe(true);
    expect(isPostAllowed(x, { grants: [{ id: "x.priya.post", ignoredReason: "untrusted" }] })).toBe(false);
    expect(isPostAllowed(x, { grants: [{ id: "reddit.priya.post" }, { id: "x.other.post" }] })).toBe(false);
  });

  it("requires a future send time", () => {
    const now = Date.parse("2026-11-16T12:00:00");
    expect(sendTimeProblem("", now)).toMatch(/Pick a date/);
    expect(sendTimeProblem("2026-11-16T11:00", now)).toMatch(/future/);
    expect(sendTimeProblem("2026-11-16T13:00", now)).toBeNull();
  });

  it("reports missing grants, and unavailable grants without throwing", async () => {
    const listGrants = mock(async () => ({ grants: [{ id: "x.priya.post" }], maxGrantLevel: 8 }));
    expect(await findMissingGrants([x, reddit], { listGrants })).toEqual({ status: "ok", missing: [reddit] });
    const failing = { listGrants: async () => Promise.reject(new Error("down")) };
    expect(await findMissingGrants([x], failing)).toMatchObject({ status: "unavailable" });
    expect(await findMissingGrants([x], { listGrants: async () => ({ grants: [], maxGrantLevel: 7 }) })).toMatchObject({ status: "unavailable" });
  });

  it("schedules each account and reports a failure without stopping the others", async () => {
    const addSchedule = mock(async ({ name }: { name: string }) => {
      if (name.startsWith("social-reddit-")) throw new Error("Tool does not exist");
    });
    const results = await schedulePosts(
      [
        { target: x, input },
        { target: reddit, input: { subreddit: "w", title: "t" } },
      ],
      "Hi",
      "2099-01-01T00:00:00.000Z",
      "social",
      { addSchedule },
    );
    expect(results.map(r => [r.targetId, r.ok])).toEqual([
      ["x:priya", true],
      ["reddit:priya_r", false],
    ]);
  });

  it("recognises only social tool schedules and reads their last run", () => {
    const view = (name: string, tool: string, lastRunTime = 0) => ({
      name,
      state: "scheduled",
      lastRunTime,
      definition: { at: "2099-01-01T00:00:00.000Z", action: { kind: "tool" as const, agentType: "social", tool, input: { text: "t", account: "a" } } },
    });
    const posts = scheduledPosts([view("social-x-1", "x_createPost"), view("social-x-2", "x_other"), view("other", "x_createPost")], {});
    expect(posts.map(p => p.name)).toEqual(["social-x-1"]);
    expect(posts[0]!.status).toBe("upcoming");
  });

  it("shows a post whose time passed while the app was down as missed, not posted", () => {
    const view = {
      name: "social-x-1",
      state: "missed",
      lastRunTime: 1,
      definition: {
        at: "2020-01-01T00:00:00.000Z",
        action: { kind: "tool" as const, agentType: "social", tool: "x_createPost", input: { text: "t", account: "a" } },
      },
    };
    const run = {
      id: "r",
      scheduledFor: 1,
      startTime: 2,
      endTime: 2,
      status: "cancelled" as const,
      message: "Missed: the app was not running at the scheduled time",
      actionKind: "tool" as const,
      jobId: null,
      manual: false,
    };
    const [post] = scheduledPosts([view], { "social-x-1": [run] });
    expect(post).toMatchObject({ status: "missed", reason: expect.stringContaining("Missed, not posted") });
  });
});
