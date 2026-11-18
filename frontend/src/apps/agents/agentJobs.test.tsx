import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { JobRecord } from "@tokenring-ai/agent/schema";
import type React from "react";
import { toastManager } from "../../components/ui/toast.tsx";

function job(overrides: Partial<JobRecord> & Pick<JobRecord, "id" | "label">): JobRecord {
  return {
    owner: "queue",
    ownerRef: {},
    agentType: "code",
    origin: { kind: "person", label: "You" },
    parentJobId: null,
    rootJobId: overrides.id,
    depth: 1,
    status: "succeeded",
    requestedAt: 1_700_000_000_000,
    startedAt: 1_700_000_000_000,
    endedAt: 1_700_000_065_000,
    summary: "",
    error: null,
    costUsd: null,
    tokens: null,
    agentId: null,
    maxCostUsd: null,
    approvalLevel: null,
    refusals: [],
    refusalCount: 0,
    unanswered: [],
    unansweredCount: 0,
    ...overrides,
  };
}

const lead = job({
  id: "job-lead",
  label: "ENG-1 · Code",
  owner: "tasks",
  ownerRef: { board: "eng", task: "ENG-1" },
  status: "running",
  endedAt: null,
  agentId: "agent-lead",
  costUsd: 0.42,
});
const child = job({
  id: "job-child",
  label: "docs #3: Write the docs",
  owner: "queue",
  ownerRef: { queue: "docs" },
  parentJobId: "job-lead",
  rootJobId: "job-lead",
  depth: 2,
  status: "queued",
  requestedAt: 1_700_000_010_000,
  startedAt: null,
  endedAt: null,
  origin: { kind: "agent", agentId: "agent-lead", agentType: "code" },
});
const nightly = job({
  id: "job-nightly",
  label: 'Schedule "nightly"',
  owner: "scheduler",
  ownerRef: { schedule: "nightly" },
  origin: { kind: "schedule", scheduleId: "nightly" },
  status: "failed",
  error: "Over its time limit",
  requestedAt: 1_600_000_000_000,
});

let jobs: JobRecord[] = [];
const rollupCalls: { days: number; groupBy: string }[] = [];
const rollupRow = (key: string, label: string, over: Record<string, unknown> = {}) => ({
  key,
  label,
  runs: 0,
  active: 0,
  succeeded: 0,
  failed: 0,
  interrupted: 0,
  cancelled: 0,
  refusedActions: 0,
  totalCostUsd: null,
  costUnavailableJobs: 0,
  averageDurationMs: null,
  lastRunAt: null,
  lastStatus: null,
  ...over,
});
let rollup = (days: number) => {
  const sched = rollupRow("scheduler", "Scheduler", { runs: 4 * days, succeeded: 3 * days, failed: days, refusedActions: 2, totalCostUsd: 1.5 * days });
  const queue = rollupRow("queue", "Queue", { runs: 2, succeeded: 2 });
  const totals = rollupRow("total", "Total", {
    runs: sched.runs + 2,
    succeeded: sched.succeeded + 2,
    failed: days,
    refusedActions: 2,
    totalCostUsd: 1.5 * days,
  });
  return { days, since: 0, groupBy: "owner", truncated: false, rows: [sched, queue], totals };
};
const cancelJob = mock(async (_args: { jobId: string; reason?: string }) => ({ status: "success" as const, cancelled: true }));
const settled = () => mock(async () => undefined);
let grants: { id: string; grantedAt: string; uses: number; source: "global" | "workspace"; ignoredReason?: string }[] = [];
const grantPermission = mock(
  async (_args: { id: string; summary?: string }): Promise<{ status: "success" } | { status: "rejected"; message: string }> => ({ status: "success" }),
);

// Spread the real module: the chat views import many clients this test never calls.
const realRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...realRpc,
  useAgentJobs: () => ({ data: { jobs }, isLoading: false, error: undefined, mutate: settled() }),
  useJobRollup: (options: { days: number; groupBy: string }) => {
    rollupCalls.push(options);
    return { data: rollup(options.days), isLoading: false, error: undefined, mutate: settled() };
  },
  useAgentList: () => ({
    data: [{ id: "agent-lead", createdAt: 1, agentType: "code", displayName: "Code", description: "", idle: false, currentActivity: "" }],
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  useTodos: () => ({ data: { status: "success", todos: [] }, isLoading: false }),
  agentJobsRPCClient: { cancelJob },
  usePermissionGrants: () => ({ data: { status: "success", grants, maxGrantLevel: 8 }, isLoading: false, error: undefined, mutate: settled() }),
  chatRPCClient: { ...realRpc.chatRPCClient, grantPermission },
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div data-testid={`chat-panel:${agentId}`}>chat</div>,
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { AGENTS_APP } = await import("./manifest.ts");
const { AGENTS_VIEWS } = await import("./views.ts");
const { agentJobPath, JobLink } = await import("./JobLink.tsx");
const { jobTree, ownerHref, formatDuration } = await import("./AgentJobsView.tsx");
const { render } = await import("@testing-library/react");
const { MemoryRouter } = await import("react-router-dom");

const registry = createLayoutRegistry({ apps: [AGENTS_APP], views: [...AGENTS_VIEWS, ...CHAT_VIEWS], kinds: CORE_KINDS });

function jobsPanel() {
  const node = document.querySelector<HTMLElement>('[data-panel="agent-jobs:_"]');
  if (!node) throw new Error("the jobs panel is not mounted");
  return within(node);
}

const rowOf = (id: string) => document.querySelector<HTMLElement>(`[data-job-id="${id}"]`);

describe("Agent jobs view", () => {
  beforeEach(() => {
    localStorage.clear();
    cancelJob.mockClear();
    grantPermission.mockClear();
    grantPermission.mockImplementation(async () => ({ status: "success" }));
    grants = [];
    jobs = [child, lead, nightly];
  });

  describe("always allow on refusals", () => {
    const refused = (permissionId = "blog.mysite.publish") =>
      job({
        id: "job-refused",
        label: "Publish run",
        refusalCount: 2,
        refusals: [
          { tool: "blog_updatePost", message: "Needs approval", level: 8, permissionId, permissionSummary: "Publish posts on mysite" },
          { tool: "shell", message: "No", level: 9 },
        ],
      });

    it("confirms, saves the grant and then shows Allowed", async () => {
      const user = userEvent.setup();
      jobs = [refused()];
      renderLayoutApp({ registry, url: "/agents/jobs" });
      const row = within(rowOf("job-refused")!);
      expect(row.getAllByRole("button", { name: /Always allow/ })).toHaveLength(1);
      await user.click(row.getByRole("button", { name: "Always allow blog.mysite.publish" }));
      expect(grantPermission).not.toHaveBeenCalled();
      expect(screen.getByText(/The next run of any job, including unattended ones, will publish posts on mysite/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: "Always allow" }));
      await waitFor(() => expect(grantPermission).toHaveBeenCalledWith({ id: "blog.mysite.publish", summary: "Publish posts on mysite" }));
      expect(await row.findByText("Allowed")).toBeInTheDocument();
      expect(row.queryByRole("button", { name: /Always allow/ })).toBeNull();
    });

    it("shows Allowed at once when an exact or wildcard grant already covers the id", () => {
      grants = [{ id: "blog.*.publish", grantedAt: "2026-11-16T09:12:00Z", uses: 0, source: "global" }];
      jobs = [refused()];
      renderLayoutApp({ registry, url: "/agents/jobs" });
      const row = within(rowOf("job-refused")!);
      expect(row.getByText("Allowed")).toBeInTheDocument();
      expect(row.queryByRole("button", { name: /Always allow/ })).toBeNull();
    });

    it("does not count a grant that is ignored", () => {
      grants = [{ id: "blog.mysite.publish", grantedAt: "2026-11-16T09:12:00Z", uses: 0, source: "workspace", ignoredReason: "untrusted file" }];
      jobs = [refused()];
      renderLayoutApp({ registry, url: "/agents/jobs" });
      expect(within(rowOf("job-refused")!).getByRole("button", { name: "Always allow blog.mysite.publish" })).toBeInTheDocument();
    });

    it("reports the backend's rejection and stays allowable", async () => {
      const user = userEvent.setup();
      const errorToast = spyOn(toastManager, "error").mockImplementation(() => "");
      grantPermission.mockImplementation(async () => ({ status: "rejected", message: "Level 9 actions cannot be granted" }));
      jobs = [refused()];
      renderLayoutApp({ registry, url: "/agents/jobs" });
      const row = within(rowOf("job-refused")!);
      await user.click(row.getByRole("button", { name: "Always allow blog.mysite.publish" }));
      await user.click(screen.getByRole("button", { name: "Always allow" }));
      await waitFor(() => expect(grantPermission).toHaveBeenCalledTimes(1));
      await waitFor(() => expect(errorToast).toHaveBeenCalledWith(expect.stringContaining("Level 9 actions cannot be granted")));
      expect(row.queryByText("Allowed")).toBeNull();
    });
  });

  it("shows the budget next to what was spent, and flags refused actions", () => {
    jobs = [
      job({
        id: "job-budget",
        label: "Nightly report",
        status: "succeeded",
        costUsd: 0.4,
        maxCostUsd: 1,
        approvalLevel: 5,
        refusalCount: 22,
        refusals: Array.from({ length: 20 }, (_, i) => ({ tool: "db_write", message: `Write ${i}`, level: 7 })),
      }),
      job({ id: "job-over", label: "Pricey", status: "failed", costUsd: 2, maxCostUsd: 1, error: "Stopped: over budget. Spent $2.00" }),
    ];
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const row = within(rowOf("job-budget")!);
    expect(row.getByText("Cost $0.40 of $1.00")).toBeInTheDocument();
    expect(row.getByText("Approves up to level 5")).toBeInTheDocument();
    expect(row.getByText("22 actions refused")).toBeInTheDocument();
    // The status stays Succeeded; the badge is what warns.
    expect(row.getByText("Succeeded")).toBeInTheDocument();
    expect(row.getByText("and 2 more")).toBeInTheDocument();
    expect(row.getAllByText(/db_write/)).toHaveLength(20);
    expect(within(rowOf("job-over")!).getByText("Stopped: over budget. Spent $2.00")).toBeInTheDocument();
    expect(within(rowOf("job-over")!).queryByText(/refused/)).toBeNull();
  });

  it("flags questions answered by default and lists what the agent chose", () => {
    jobs = [
      job({
        id: "job-defaults",
        label: "Weekly digest",
        unansweredCount: 22,
        unanswered: Array.from({ length: 20 }, (_, i) => ({
          question: `Which section ${i}?`,
          answer: "Intro",
          reason: i === 0 ? ("nobody" as const) : ("deadline" as const),
          at: 1_700_000_000_000,
        })),
      }),
      job({ id: "job-quiet", label: "Quiet" }),
    ];
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const row = within(rowOf("job-defaults")!);
    expect(row.getAllByText("22 questions answered by default").length).toBeGreaterThan(0);
    expect(row.getByText(/Asked: Which section 0\?/)).toBeInTheDocument();
    expect(row.getAllByText(/used default: Intro/)).toHaveLength(20);
    expect(row.getByText("and 2 more")).toBeInTheDocument();
    expect(within(rowOf("job-quiet")!).queryByText(/answered by default/)).toBeNull();
  });

  it("lists every job with its owner, agent type, status, cost and outcome", () => {
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const view = jobsPanel();
    const list = within(view.getByRole("list", { name: "Agent jobs" }));
    expect(list.getAllByRole("listitem")).toHaveLength(3);

    const leadRow = within(rowOf("job-lead")!);
    expect(leadRow.getByText("Running")).toBeInTheDocument();
    expect(leadRow.getByText("Cost $0.42")).toBeInTheDocument();
    expect(leadRow.getByRole("link", { name: "Open in Tasks" }).getAttribute("href")).toBe("/tasks/eng/ENG-1");
    // Its agent still exists: a link to its chat.
    expect(leadRow.getByRole("link", { name: "Open the agent of ENG-1 · Code" }).getAttribute("href")).toBe("/agent/agent-lead");

    const nightlyRow = within(rowOf("job-nightly")!);
    expect(nightlyRow.getByText("Failed")).toBeInTheDocument();
    expect(nightlyRow.getByText("Over its time limit")).toBeInTheDocument();
    expect(nightlyRow.getByText("Took 1m 5s")).toBeInTheDocument();
    expect(nightlyRow.getByRole("link", { name: "nightly" }).getAttribute("href")).toBe("/scheduler");
    expect(nightlyRow.getByRole("link", { name: "Open in Scheduler" }).getAttribute("href")).toBe("/scheduler/runs");
  });

  it("nests a job under the job that started it", () => {
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const order = [...document.querySelectorAll<HTMLElement>("[data-job-id]")].map(row => [row.dataset.jobId, row.dataset.level]);
    expect(order).toEqual([
      ["job-lead", "0"],
      ["job-child", "1"],
      ["job-nightly", "0"],
    ]);
    expect(jobTree([child, lead]).map(row => row.level)).toEqual([0, 1]);
  });

  it("filters by status and by owner, and says who started a job whose parent is filtered out", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const view = jobsPanel();

    await user.selectOptions(view.getByLabelText("Status"), "queued");
    expect(rowOf("job-lead")).toBeNull();
    const childRow = within(rowOf("job-child")!);
    expect(rowOf("job-child")!.dataset.level).toBe("0");
    expect(childRow.getByRole("link", { name: "ENG-1 · Code" }).getAttribute("href")).toBe(agentJobPath("job-lead"));

    await user.selectOptions(view.getByLabelText("Status"), "all");
    await user.selectOptions(view.getByLabelText("Started by"), "scheduler");
    expect([...document.querySelectorAll<HTMLElement>("[data-job-id]")].map(row => row.dataset.jobId)).toEqual(["job-nightly"]);

    await user.selectOptions(view.getByLabelText("Status"), "running");
    expect(view.getByText("No jobs match these filters")).toBeInTheDocument();
  });

  it("opens on the job a link names, whatever the filters", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: agentJobPath("job-child") });
    expect(rowOf("job-child")!.getAttribute("aria-current")).toBe("true");
    expect(rowOf("job-lead")!.getAttribute("aria-current")).toBeNull();
    await user.selectOptions(jobsPanel().getByLabelText("Started by"), "scheduler");
    expect(rowOf("job-child")).not.toBeNull();
  });

  it("cancels a running job after confirming, saying that the jobs it started go too", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/agents/jobs" });
    // Finished jobs have nothing to cancel.
    expect(within(rowOf("job-nightly")!).queryByRole("button", { name: /^Cancel/ })).toBeNull();

    await user.click(within(rowOf("job-lead")!).getByRole("button", { name: "Cancel ENG-1 · Code" }));
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/every job it started is cancelled with it \(1 still queued or running\)/)).toBeInTheDocument();
    expect(cancelJob).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole("button", { name: "Cancel job" }));
    await waitFor(() => expect(cancelJob).toHaveBeenCalledTimes(1));
    expect(cancelJob.mock.calls[0]![0]).toMatchObject({ jobId: "job-lead" });
  });

  it("does not cancel when the confirmation is dismissed", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/agents/jobs" });
    await user.click(within(rowOf("job-child")!).getByRole("button", { name: /^Cancel docs/ }));
    await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "Keep running" }));
    expect(cancelJob).not.toHaveBeenCalled();
  });

  it("is reachable from the Running sidebar, with the number of active jobs", async () => {
    const user = userEvent.setup();
    const app = renderLayoutApp({ registry, url: "/agents" });
    const link = screen.getByRole("link", { name: /Agent jobs/ });
    expect(within(link).getByText("2 active")).toBeInTheDocument();
    await user.click(link);
    await waitFor(() => expect(app.location().pathname).toBe("/agents/jobs"));
  });

  it("shows an empty state before any job ran", () => {
    jobs = [];
    renderLayoutApp({ registry, url: "/agents/jobs" });
    expect(jobsPanel().getByText("No agent jobs yet")).toBeInTheDocument();
  });
});

describe("spend and outcomes summary", () => {
  beforeEach(() => {
    rollupCalls.length = 0;
    jobs = [child, lead, nightly];
  });

  it("shows totals, a per-owner breakdown and warns about failures and refusals", () => {
    renderLayoutApp({ registry, url: "/agents/jobs" });
    const summary = within(screen.getByRole("region", { name: "Spend and outcomes" }));
    expect(summary.getByText("Success rate").nextSibling?.textContent).toBe("77%");
    expect(summary.getByText("Spend").nextSibling?.textContent).toBe("$10.50");
    expect(summary.getByText("Refused actions").nextSibling?.textContent).toBe("2");
    expect(summary.getByText("Failures").nextSibling?.textContent).toBe("7");
    const owners = within(summary.getByRole("list", { name: "By owner" }));
    expect(owners.getByRole("button", { name: /Scheduler/ }).getAttribute("data-tone")).toBe("danger");
    expect(owners.getByRole("button", { name: /Queue/ }).getAttribute("data-tone")).toBeNull();
    expect(owners.getByRole("button", { name: /Queue/ }).textContent).toContain("Cost not available");
  });

  it("refetches when the window changes", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/agents/jobs" });
    expect(rollupCalls.at(-1)).toMatchObject({ days: 7, groupBy: "owner" });
    await user.click(screen.getByRole("button", { name: "30 days" }));
    expect(rollupCalls.at(-1)).toMatchObject({ days: 30 });
    await user.click(screen.getByRole("button", { name: "Today" }));
    expect(rollupCalls.at(-1)).toMatchObject({ days: 1 });
  });

  it("never shows $0 when no cost is known", () => {
    const original = rollup;
    rollup = days => ({ ...original(days), totals: rollupRow("total", "Total", { runs: 1, succeeded: 1 }), rows: [] });
    renderLayoutApp({ registry, url: "/agents/jobs" });
    expect(within(screen.getByRole("region", { name: "Spend and outcomes" })).getByText("Spend").nextSibling?.textContent).toBe("Cost not available");
    rollup = original;
  });

  it("applies the owner filter when an owner is clicked, and clears it on a second click", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/agents/jobs" });
    expect(rowOf("job-lead")).not.toBeNull();
    const button = screen.getByRole("button", { name: /Scheduler/ });
    await user.click(button);
    expect(rowOf("job-lead")).toBeNull();
    expect(rowOf("job-nightly")).not.toBeNull();
    expect(button.getAttribute("aria-pressed")).toBe("true");
    await user.click(button);
    expect(rowOf("job-lead")).not.toBeNull();
  });
});

describe("job links", () => {
  it("links a plugin entry to its job in the jobs view", () => {
    render(
      <MemoryRouter>
        <JobLink jobId="job 1" />
      </MemoryRouter>,
    );
    expect(screen.getByRole("link", { name: "Open agent job job 1" }).getAttribute("href")).toBe("/agents/jobs?job=job%201");
  });

  it("points each owner at its entry, or its app when the job does not say which", () => {
    expect(ownerHref({ owner: "queue", ownerRef: { queue: "docs" } })).toBe("/queue/docs");
    expect(ownerHref({ owner: "workflow", ownerRef: { run: "r1" } })).toBe("/workflows/runs/r1");
    expect(ownerHref({ owner: "tasks", ownerRef: {} })).toBe("/tasks");
    expect(ownerHref({ owner: "other", ownerRef: {} })).toBeNull();
    expect(formatDuration(3_725_000)).toBe("1h 2m");
  });
});
