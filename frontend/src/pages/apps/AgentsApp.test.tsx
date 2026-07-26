import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const codeAgentType = {
  type: "code",
  displayName: "Code Engineer",
  description: "Writes and reviews code",
  category: "Engineering",
  enabledTools: ["filesystem/*", "shell/run"],
};

const researchAgentType = {
  type: "research",
  displayName: "Researcher",
  description: "Digs through the web",
  category: "Research",
  enabledTools: [],
};

const runningAgent = {
  id: "agent-1",
  createdAt: 1_700_000_000_000,
  agentType: "code",
  displayName: "Code Engineer #1",
  description: "Writes and reviews code",
  idle: false,
  currentActivity: "Editing AgentsApp.tsx",
};

const todos = [
  { id: "t1", content: "Read the existing app", status: "completed" },
  { id: "t2", content: "Add the sidebar", status: "in_progress" },
  { id: "t3", content: "Wire up launching", status: "pending" },
];

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({ id: "agent-2", displayName: "New", description: "" }));
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" as const }));
const spawnWorkflow = mock(async (_args: { name: string; headless: boolean }) => ({ id: "agent-3", displayName: "Leader", description: "" }));
const mutateAgents = mock(async () => undefined);

let agentList: (typeof runningAgent)[] = [];

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, mutate: mutateAgents }),
  useAgentTypes: () => ({ data: [codeAgentType, researchAgentType], isLoading: false, mutate: mock() }),
  useWorkflows: () => ({ data: [{ name: "bugHunter", displayName: "Bug Hunter", description: "Finds bugs" }], isLoading: false }),
  useTodos: () => ({ data: { status: "success", todos }, isLoading: false }),
  useCheckpointList: () => ({ data: [], isLoading: false }),
  agentRPCClient: { createAgent, deleteAgent },
  workflowRPCClient: { spawnWorkflow },
  checkpointRPCClient: {},
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div>Chat with {agentId}</div>,
}));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: AgentsApp } = await import("./AgentsApp.tsx");

function renderApp(initialPath = "/agents") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/agents/:agentType?" element={<AgentsApp />} />
        <Route path="/agent/:agentId/*" element={<AgentsApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentsApp", () => {
  beforeEach(() => {
    createAgent.mockClear();
    deleteAgent.mockClear();
    spawnWorkflow.mockClear();
    agentList = [];
  });

  it("groups agent types by category and shows the empty selection state", () => {
    renderApp();

    expect(screen.getByText("Engineering")).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Code Engineer")).toBeInTheDocument();
    expect(screen.getByText("Select an agent type")).toBeInTheDocument();
    expect(screen.getByText("No active agents")).toBeInTheDocument();
  });

  it("browses an agent type without offering any edits", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "View Code Engineer" }));

    expect(screen.getByText("Writes and reviews code")).toBeInTheDocument();
    expect(screen.getByText("filesystem/*")).toBeInTheDocument();
    expect(screen.getByText("shell/run")).toBeInTheDocument();
    expect(screen.queryByRole("textbox")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /save/i })).not.toBeInTheDocument();
  });

  it("launches an agent from the sidebar without selecting it first", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Launch Researcher" }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false }));
    expect(screen.getByText(/Chat with agent-2/)).toBeInTheDocument();
  });

  it("launches the selected agent type from the detail header", async () => {
    const user = userEvent.setup();
    renderApp("/agents/code");

    await user.click(screen.getByRole("button", { name: /Launch$/ }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "code", headless: false }));
  });

  it("lists running agents with their todos and opens them", async () => {
    const user = userEvent.setup();
    agentList = [runningAgent];
    renderApp();

    expect(screen.getByText("1 running")).toBeInTheDocument();
    expect(screen.getByText("Editing AgentsApp.tsx")).toBeInTheDocument();
    const todoList = screen.getByRole("list", { name: "Todos for Code Engineer #1" });
    expect(todoList).toHaveTextContent("Read the existing app");
    expect(todoList).toHaveTextContent("Add the sidebar");
    expect(todoList).toHaveTextContent("Wire up launching");

    await user.click(screen.getByRole("button", { name: "Open agent Code Engineer #1" }));
    expect(screen.getByText(/Chat with agent-1/)).toBeInTheDocument();
  });

  it("keeps the sidebar alongside the chat once an agent is open", () => {
    agentList = [runningAgent];
    renderApp("/agent/agent-1");

    expect(screen.getByText(/Chat with agent-1/)).toBeInTheDocument();
    // Sidebar is still there: the running agent, its todos, and the agent-type list.
    expect(screen.getByRole("button", { name: "Open agent Code Engineer #1" })).toBeInTheDocument();
    expect(screen.getByRole("list", { name: "Todos for Code Engineer #1" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Launch Researcher" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "View Researcher" })).toBeInTheDocument();
  });

  it("shows running agents of the selected type on its detail page", () => {
    agentList = [runningAgent];
    renderApp("/agents/code");

    expect(screen.getByText("Running agents of this type")).toBeInTheDocument();
    expect(screen.getByText(/· 1 running/)).toBeInTheDocument();
  });

  it("deletes a running agent after confirmation", async () => {
    const user = userEvent.setup();
    agentList = [runningAgent];
    renderApp();

    await user.click(screen.getByRole("button", { name: "Delete agent Code Engineer #1" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAgent).toHaveBeenCalledTimes(1));
    expect(deleteAgent.mock.calls[0]![0]!.agentId).toBe("agent-1");
  });

  it("spawns a workflow from the overview pane", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByRole("button", { name: "Spawn workflow: Bug Hunter" }));

    await waitFor(() => expect(spawnWorkflow).toHaveBeenCalledWith({ name: "bugHunter", headless: false }));
  });
});
