import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const agent = {
  id: "agent-1",
  createdAt: 1_700_000_000_000,
  agentType: "code",
  displayName: "Code Engineer #1",
  description: "Writes code",
  idle: true,
  currentActivity: "",
};

const dailyTask = {
  message: "Summarize overnight CI failures and open a draft status update.",
  lastRunTime: 0,
  repeat: "1 day",
  after: "09:00",
  before: "17:00",
  weekdays: "mon tue wed thu fri",
  timezone: "UTC",
};

const nextRun = Date.now() + 60 * 60_000;

const getTasks = mock(async () => ({
  status: "success" as const,
  tasks: { "Daily standup": dailyTask },
  count: 1,
}));

const getStatus = mock(async () => ({
  status: "success" as const,
  running: false,
  autoStart: true,
  executions: {
    "Daily standup": { nextRunTime: nextRun, status: "pending" as const },
  },
}));

const getHistory = mock(async () => ({
  status: "success" as const,
  history: {
    "Daily standup": [
      {
        startTime: Date.now() - 3_600_000,
        endTime: Date.now() - 3_540_000,
        status: "completed" as const,
        message: "Brief generated successfully",
      },
      {
        startTime: Date.now() - 86_400_000,
        endTime: Date.now() - 86_300_000,
        status: "failed" as const,
        message: "Agent busy",
      },
    ],
  },
}));

const startScheduler = mock(async () => ({ status: "success" as const, success: true, message: "Scheduler started" }));
const stopScheduler = mock(async () => ({ status: "success" as const, success: true, message: "Scheduler stopped" }));
const removeTask = mock(async () => ({ status: "success" as const, success: true, message: 'Task "Daily standup" removed' }));
const addTask = mock(async () => ({ status: "success" as const, success: true, message: 'Task "New task" added' }));
const createAgent = mock(async () => ({ id: "agent-2", displayName: "New", description: "" }));
const mutateAgents = mock(async () => undefined);
const mutateTasks = mock(async () => undefined);
const mutateStatus = mock(async () => undefined);
const mutateHistory = mock(async () => undefined);

let agentList: (typeof agent)[] = [agent];
let schedulerRunning = false;

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, error: undefined, mutate: mutateAgents }),
  useAgentTypes: () => ({
    data: [{ type: "code", displayName: "Code Engineer", description: "", category: "Engineering", enabledTools: [] }],
    isLoading: false,
    mutate: mock(),
  }),
  useSchedulerTasks: () => ({
    data: agentList.length
      ? {
          status: "success" as const,
          tasks: { "Daily standup": dailyTask },
          count: 1,
        }
      : undefined,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateTasks,
  }),
  useSchedulerStatus: () => ({
    data: agentList.length
      ? {
          status: "success" as const,
          running: schedulerRunning,
          autoStart: true,
          executions: {
            "Daily standup": { nextRunTime: nextRun, status: "pending" as const },
          },
        }
      : undefined,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateStatus,
  }),
  useSchedulerHistory: () => ({
    data: agentList.length
      ? {
          status: "success" as const,
          history: {
            "Daily standup": [
              {
                startTime: Date.now() - 3_600_000,
                endTime: Date.now() - 3_540_000,
                status: "completed" as const,
                message: "Brief generated successfully",
              },
              {
                startTime: Date.now() - 86_400_000,
                endTime: Date.now() - 86_300_000,
                status: "failed" as const,
                message: "Agent busy",
              },
            ],
          },
        }
      : undefined,
    isLoading: false,
    isValidating: false,
    error: undefined,
    mutate: mutateHistory,
  }),
  agentRPCClient: { createAgent, getAgentTypes: mock(async () => [{ type: "code", displayName: "Code Engineer", category: "Engineering" }]) },
  schedulerRPCClient: { getTasks, getStatus, getHistory, startScheduler, stopScheduler, removeTask, addTask },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
    info: mock(),
  },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: SchedulerDashboard } = await import("./SchedulerDashboard.tsx");

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/scheduler"]}>
      <Routes>
        <Route path="/scheduler" element={<SchedulerDashboard />} />
        <Route path="/agent/:agentId" element={<div>Agent chat</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SchedulerDashboard", () => {
  beforeEach(() => {
    agentList = [agent];
    schedulerRunning = false;
    startScheduler.mockClear();
    stopScheduler.mockClear();
    removeTask.mockClear();
    addTask.mockClear();
    createAgent.mockClear();
    mutateAgents.mockClear();
    mutateTasks.mockClear();
    mutateStatus.mockClear();
    mutateHistory.mockClear();
  });

  it("lists scheduled tasks for the selected agent", () => {
    renderApp();

    expect(screen.getByRole("heading", { name: "Scheduler" })).toBeInTheDocument();
    expect(screen.getByText("Daily standup")).toBeInTheDocument();
    expect(screen.getByText(/Every 1 day/)).toBeInTheDocument();
    expect(screen.getByText("Pending")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Enable" })).toBeInTheDocument();
  });

  it("shows empty agents state with create action", async () => {
    agentList = [];
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText("No agents available")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Create agent" }));
    await waitFor(() => expect(createAgent).toHaveBeenCalled());
  });

  it("enables the scheduler when disabled", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Enable" }));
    await waitFor(() => {
      expect(startScheduler).toHaveBeenCalledWith({ agentId: "agent-1" });
    });
  });

  it("disables the scheduler when enabled", async () => {
    schedulerRunning = true;
    const user = userEvent.setup();
    renderApp();

    expect(screen.getByText("Scheduler enabled")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Disable" }));
    await waitFor(() => {
      expect(stopScheduler).toHaveBeenCalledWith({ agentId: "agent-1" });
    });
  });

  it("opens the add task form", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Add task" }));
    expect(screen.getByText("Add scheduled task")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Daily standup brief")).toBeInTheDocument();
  });

  it("confirms and removes a task", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Remove task Daily standup" }));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Remove "Daily standup"/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole("button", { name: "Remove" }));
    await waitFor(() => {
      expect(removeTask).toHaveBeenCalledWith({ agentId: "agent-1", name: "Daily standup" });
    });
  });

  it("shows run history with filters", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: /History/ }));
    expect(screen.getByText("Brief generated successfully")).toBeInTheDocument();
    expect(screen.getByText("Agent busy")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter history by task")).toBeInTheDocument();
    expect(screen.getByLabelText("Filter history by status")).toBeInTheDocument();

    await user.selectOptions(screen.getByLabelText("Filter history by status"), "failed");
    expect(screen.queryByText("Brief generated successfully")).not.toBeInTheDocument();
    expect(screen.getByText("Agent busy")).toBeInTheDocument();
  });
});
