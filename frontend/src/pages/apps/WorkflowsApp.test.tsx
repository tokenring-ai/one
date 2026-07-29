import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const bugHunter = {
  name: "bugHunter",
  displayName: "All-Package Bug Hunter",
  category: "Code Review",
  description: "Finds and fixes bugs",
  agentType: "leader",
  steps: ["/list @packages = getPackages()", "/eval /agent run fix bugs"],
  subAgent: {
    forwardChatOutput: false,
    forwardStatusMessages: true,
    forwardSystemOutput: false,
    forwardHumanRequests: true,
    forwardReasoning: false,
    forwardInputCommands: true,
    timeout: 0,
    maxResponseLength: 10000,
    minContextLength: 1000,
  },
  updatedAt: "2026-07-01T12:00:00.000Z",
};

type SaveArgs = { name: string; workflow: Omit<typeof bugHunter, "name" | "updatedAt"> };

const createWorkflow = mock(async (_args: SaveArgs) => ({ workflow: bugHunter }));
const updateWorkflow = mock(async (_args: SaveArgs) => ({ workflow: bugHunter }));
const deleteWorkflow = mock(async (_args: { name: string }) => ({ success: true }));
const spawnWorkflow = mock(async (_args: { name: string; headless: boolean }) => ({ id: "agent-1", displayName: "Leader", description: "" }));
const mutateWorkflows = mock(async () => undefined);

const activeRun: { agentId: string | null; status: string; [key: string]: unknown } = {
  id: "run-1",
  workflowName: "bugHunter",
  displayName: "All-Package Bug Hunter",
  agentType: "leader",
  agentId: "agent-1",
  steps: bugHunter.steps,
  currentStep: 1,
  status: "running",
  message: "",
  startedAt: 1_700_000_000_000,
  finishedAt: null,
};

let workflowRuns: (typeof activeRun)[] = [];

void mock.module("../../rpc.ts", () => ({
  useWorkflows: () => ({ data: [bugHunter], isLoading: false, mutate: mutateWorkflows }),
  useWorkflowRuns: () => ({ data: { status: "success", runs: workflowRuns }, isLoading: false }),
  useAgentList: () => ({ data: [], isLoading: false, mutate: mock() }),
  useAgentTypes: () => ({ data: [{ type: "leader", displayName: "Leader", description: "", category: "General", enabledTools: [] }], isLoading: false }),
  useTypedSWR: () => ({ data: { directory: "/project/.tokenring/workflows" }, isLoading: false }),
  workflowRPCClient: { createWorkflow, updateWorkflow, deleteWorkflow, spawnWorkflow },
}));

const { default: WorkflowsApp } = await import("./WorkflowsApp.tsx");

function renderApp(initialPath = "/workflows") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/workflows/:workflowName?" element={<WorkflowsApp />} />
        <Route path="/agent/:agentId" element={<div>Agent page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("WorkflowsApp", () => {
  beforeEach(() => {
    createWorkflow.mockClear();
    updateWorkflow.mockClear();
    deleteWorkflow.mockClear();
    spawnWorkflow.mockClear();
    workflowRuns = [];
  });

  it("groups workflows by category and shows the empty selection state", () => {
    renderApp();

    expect(screen.getByText("Code Review")).toBeInTheDocument();
    expect(screen.getByText("All-Package Bug Hunter")).toBeInTheDocument();
    expect(screen.getByText("Select a workflow")).toBeInTheDocument();
    expect(screen.getByText("/project/.tokenring/workflows")).toBeInTheDocument();
  });

  it("shows a workflow's steps and settings when it is selected", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText("All-Package Bug Hunter"));

    expect(screen.getByText("bugHunter.yaml")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Finds and fixes bugs")).toBeInTheDocument();
    expect(screen.getByLabelText("Step 1")).toHaveValue("/list @packages = getPackages()");
    expect(screen.getByLabelText("Step 2")).toHaveValue("/eval /agent run fix bugs");
  });

  it("saves edits to an existing workflow", async () => {
    const user = userEvent.setup();
    renderApp("/workflows/bugHunter");

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).toBeDisabled();

    const displayName = screen.getByLabelText("Display name");
    await user.clear(displayName);
    await user.type(displayName, "Renamed Hunter");
    expect(saveButton).not.toBeDisabled();

    await user.click(saveButton);

    await waitFor(() => expect(updateWorkflow).toHaveBeenCalledTimes(1));
    const { name: _name, updatedAt: _updatedAt, ...body } = bugHunter;
    expect(updateWorkflow.mock.calls[0]![0]).toEqual({ name: "bugHunter", workflow: { ...body, displayName: "Renamed Hunter" } });
  });

  it("creates a new workflow", async () => {
    const user = userEvent.setup();
    renderApp();

    // The sidebar and the empty state both offer "New workflow"; either opens the create form.
    await user.click(screen.getAllByRole("button", { name: "New workflow" })[0]!);
    await user.type(screen.getByLabelText("Name"), "newFlow");
    await user.type(screen.getByLabelText("Display name"), "New Flow");
    await user.selectOptions(screen.getByLabelText("Agent type"), "leader");
    await user.type(screen.getByLabelText("Step 1"), "/chat do the thing");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createWorkflow).toHaveBeenCalledTimes(1));
    const call = createWorkflow.mock.calls[0]![0];
    expect(call.name).toBe("newFlow");
    expect(call.workflow.displayName).toBe("New Flow");
    expect(call.workflow.agentType).toBe("leader");
    expect(call.workflow.steps).toEqual(["/chat do the thing"]);
  });

  it("deletes a workflow after confirmation", async () => {
    const user = userEvent.setup();
    renderApp("/workflows/bugHunter");

    await user.click(screen.getByRole("button", { name: "Delete workflow" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteWorkflow).toHaveBeenCalledWith({ name: "bugHunter" }));
  });

  it("launches a workflow on a new agent", async () => {
    const user = userEvent.setup();
    renderApp("/workflows/bugHunter");

    await user.click(screen.getByRole("button", { name: /Launch/ }));

    await waitFor(() => expect(spawnWorkflow).toHaveBeenCalledWith({ name: "bugHunter", headless: false }));
  });

  it("runs a workflow from the sidebar without selecting it first", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Run All-Package Bug Hunter" }));

    await waitFor(() => expect(spawnWorkflow).toHaveBeenCalledWith({ name: "bugHunter", headless: false }));
  });

  it("shows the step an active run is on and opens its agent", async () => {
    const user = userEvent.setup();
    workflowRuns = [activeRun];
    renderApp("/workflows/bugHunter");

    expect(screen.getByText(/running step 2 of 2/)).toBeInTheDocument();
    expect(screen.getByText(`Step 2 of 2: ${bugHunter.steps[1]}`)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Open agent running All-Package Bug Hunter" }));
    expect(screen.getByText("Agent page")).toBeInTheDocument();
  });

  it("shows a run that has not started its first step yet", () => {
    workflowRuns = [{ ...activeRun, status: "starting", agentId: null, currentStep: 0 }];
    renderApp("/workflows/bugHunter");

    expect(screen.getByText("Starting agent…")).toBeInTheDocument();
    expect(screen.getByText(/· starting agent…/)).toBeInTheDocument();
  });

  it("shows finished run history in the sidebar and editor", () => {
    workflowRuns = [
      {
        ...activeRun,
        id: "run-done",
        status: "completed",
        currentStep: 2,
        message: 'Workflow "bugHunter" completed',
        finishedAt: 1_700_000_100_000,
      },
      {
        ...activeRun,
        id: "run-failed",
        status: "failed",
        currentStep: 0,
        message: "Step failed",
        finishedAt: 1_700_000_050_000,
      },
    ];
    renderApp("/workflows/bugHunter");

    expect(screen.getByText("Recent runs")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow run progress")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow run history")).toBeInTheDocument();
    expect(screen.getAllByText("Completed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Failed").length).toBeGreaterThan(0);
    expect(screen.getByText('Workflow "bugHunter" completed')).toBeInTheDocument();
  });

  it("shows an empty run-history prompt when a workflow has never been launched", () => {
    renderApp("/workflows/bugHunter");

    expect(screen.getByText(/No runs yet for this workflow/)).toBeInTheDocument();
  });

  it("opens the agent for an active run from the editor", async () => {
    const user = userEvent.setup();
    workflowRuns = [activeRun];
    renderApp("/workflows/bugHunter");

    await user.click(screen.getAllByRole("button", { name: /Open agent/ })[0]!);
    expect(screen.getByText("Agent page")).toBeInTheDocument();
  });

  it("navigates to a workflow when a finished run is clicked in the sidebar", async () => {
    const user = userEvent.setup();
    workflowRuns = [
      {
        ...activeRun,
        id: "run-done",
        status: "completed",
        currentStep: 2,
        message: "done",
        finishedAt: 1_700_000_100_000,
      },
    ];
    renderApp();

    await user.click(screen.getByRole("button", { name: "View runs for All-Package Bug Hunter" }));
    expect(screen.getByText("bugHunter.yaml")).toBeInTheDocument();
    expect(screen.getByLabelText("Workflow run progress")).toBeInTheDocument();
  });
});
