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

const idleAgent = {
  id: "agent-idle",
  createdAt: 1_700_000_100_000,
  agentType: "research",
  displayName: "Researcher #1",
  description: "Digs through the web",
  idle: true,
  currentActivity: "Waiting for input",
};

const todos = [
  { id: "t1", content: "Read the existing app", status: "completed" },
  { id: "t2", content: "Add the sidebar", status: "in_progress" },
  { id: "t3", content: "Wire up launching", status: "pending" },
];

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({ id: "agent-2", displayName: "New", description: "" }));
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" as const }));
const mutateAgents = mock(async () => undefined);
const mutateAgentTypes = mock(async () => undefined);

let agentList: (typeof runningAgent)[] = [];
let agentsError: Error | undefined;
let agentTypesData: (typeof codeAgentType)[] = [codeAgentType, researchAgentType];
let agentTypesLoading = false;
let agentTypesError: Error | undefined;

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, error: agentsError, mutate: mutateAgents }),
  useAgentTypes: () => ({
    data: agentTypesData,
    isLoading: agentTypesLoading,
    error: agentTypesError,
    mutate: mutateAgentTypes,
  }),
  useTodos: () => ({ data: { status: "success", todos }, isLoading: false }),
  useCheckpointList: () => ({ data: [], isLoading: false }),
  agentRPCClient: { createAgent, deleteAgent },
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
        <Route path="/configuration/:plugin?" element={<div>Configuration app</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("AgentsApp", () => {
  beforeEach(() => {
    createAgent.mockClear();
    deleteAgent.mockClear();
    mutateAgents.mockClear();
    mutateAgents.mockImplementation(async () => undefined);
    mutateAgentTypes.mockClear();
    agentList = [];
    agentsError = undefined;
    agentTypesData = [codeAgentType, researchAgentType];
    agentTypesLoading = false;
    agentTypesError = undefined;
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
    expect(screen.getByRole("link", { name: "Configuration" })).toBeInTheDocument();
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

  it("opens a running agent when clicking its todo text", async () => {
    const user = userEvent.setup();
    agentList = [runningAgent];
    renderApp();

    await user.click(screen.getByText("Add the sidebar"));
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
    expect(screen.getByText(/delete "Code Engineer #1"/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAgent).toHaveBeenCalledTimes(1));
    expect(deleteAgent.mock.calls[0]![0]!.agentId).toBe("agent-1");
  });

  it("filters agent types by search query", async () => {
    const user = userEvent.setup();
    renderApp();

    const filter = screen.getByRole("searchbox", { name: "Filter agent types" });
    await user.type(filter, "research");

    expect(screen.getByText("Researcher")).toBeInTheDocument();
    expect(screen.queryByText("Code Engineer")).not.toBeInTheDocument();
    expect(screen.getByText("1 of 2")).toBeInTheDocument();

    await user.clear(filter);
    await user.type(filter, "zzz-no-match");
    expect(screen.getByText(/No types match/)).toBeInTheDocument();
  });

  it("sorts busy running agents ahead of idle ones", () => {
    agentList = [idleAgent, runningAgent];
    renderApp();

    const openBusy = screen.getByRole("button", { name: "Open agent Code Engineer #1" });
    const openIdle = screen.getByRole("button", { name: "Open agent Researcher #1" });
    // DOM order: busy agent appears before idle agent.
    expect(openBusy.compareDocumentPosition(openIdle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("returns to the overview from a type detail page", async () => {
    const user = userEvent.setup();
    renderApp("/agents/code");

    expect(screen.getByText("Writes and reviews code")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Overview" }));
    expect(screen.getByText("Select an agent type")).toBeInTheDocument();
  });

  it("shows a loading state while resolving a type route", () => {
    agentTypesLoading = true;
    agentTypesData = [];
    renderApp("/agents/code");

    expect(screen.getByText("Loading agent type…")).toBeInTheDocument();
  });

  it("shows agent-type load errors on the overview instead of a false empty state", () => {
    agentTypesData = [];
    agentTypesError = new Error("RPC down");
    renderApp();

    // Title appears in both the sidebar and the main overview pane.
    expect(screen.getAllByText("Failed to load agent types").length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText(/RPC down/).length).toBeGreaterThan(0);
    expect(screen.queryByText("No agent types configured")).not.toBeInTheDocument();
  });

  it("shows a configuration link when no agent types are configured", () => {
    agentTypesData = [];
    renderApp();

    // Copy appears in both the sidebar empty state and the overview hero.
    expect(screen.getAllByText("No agent types configured").length).toBeGreaterThanOrEqual(2);
    const links = screen.getAllByRole("link", { name: /configuration/i });
    expect(links.length).toBeGreaterThan(0);
  });

  it("navigates to overview when the Agents header is clicked", async () => {
    const user = userEvent.setup();
    renderApp("/agents/code");

    await user.click(screen.getByRole("button", { name: "Agents" }));
    expect(screen.getByText("Select an agent type")).toBeInTheDocument();
  });

  it("keeps showing cached running agents when the agent stream has a transient error", () => {
    agentList = [runningAgent];
    agentsError = new Error("stream reconnect failed");
    renderApp();

    expect(screen.getByText("Code Engineer #1")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open agent Code Engineer #1" })).toBeInTheDocument();
    expect(screen.queryByText("Failed to load agents")).not.toBeInTheDocument();
  });

  it("keeps showing cached agent types when a revalidation error arrives with data", () => {
    agentTypesError = new Error("stale revalidation failed");
    renderApp();

    expect(screen.getByText("Code Engineer")).toBeInTheDocument();
    expect(screen.getByText("Select an agent type")).toBeInTheDocument();
    // Sidebar should not swap the type list for a full error state when types are cached.
    expect(screen.queryByText("Failed to load agent types")).not.toBeInTheDocument();
  });

  it("navigates to the new agent even if the agent list refresh fails", async () => {
    const user = userEvent.setup();
    mutateAgents.mockImplementation(async () => {
      throw new Error("mutate failed");
    });
    renderApp();

    await user.click(screen.getByRole("button", { name: "Launch Researcher" }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false }));
    expect(screen.getByText(/Chat with agent-2/)).toBeInTheDocument();
  });

  it("navigates away from a deleted agent's chat even if the list refresh fails", async () => {
    const user = userEvent.setup();
    agentList = [runningAgent];
    mutateAgents.mockImplementation(async () => {
      throw new Error("mutate failed");
    });
    renderApp("/agent/agent-1");

    await user.click(screen.getByRole("button", { name: "Delete agent Code Engineer #1" }));
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await waitFor(() => expect(deleteAgent).toHaveBeenCalledTimes(1));
    expect(screen.getByText("Select an agent type")).toBeInTheDocument();
    expect(screen.queryByText(/Chat with agent-1/)).not.toBeInTheDocument();
  });
});
