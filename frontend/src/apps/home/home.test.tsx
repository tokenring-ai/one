import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { CLIENT_PREFERENCE_KEYS } from "../../lib/uiPreferences.ts";

type Agent = { id: string; createdAt: number; agentType: string; displayName: string; description: string; idle: boolean; currentActivity: string };
type Models = Record<string, Record<string, { available: boolean }>>;

const coder: Agent = { id: "agent-1", createdAt: 1, agentType: "code", displayName: "Coder", description: "", idle: true, currentActivity: "" };
const busy: Agent = { id: "agent-2", createdAt: 2, agentType: "code", displayName: "Busy Bee", description: "", idle: false, currentActivity: "Thinking" };
const now = Date.now();
const checkpointItems = [
  { id: 1, name: "First checkpoint", agentId: "agent-1", agentType: "code", sessionId: "s", createdAt: now - 1000 },
  { id: 2, name: "Second checkpoint", agentId: "agent-1", agentType: "code", sessionId: "s", createdAt: now - 2000 },
];

let agentList: Agent[] = [];
let agentTypes = [{ type: "code", displayName: "Code Engineer", description: "Writes code" }];
let modelsByProvider: Models | undefined;
let checkpoints = checkpointItems;
const createAgent = mock(async (_args: { agentType: string }) => ({ id: "agent-new" }));
const abortCurrentOperation = mock(async (_args: { agentId: string; message: string }) => ({ status: "success" as const }));
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" as const }));
const getCheckpoint = mock(async (args: { id: number }) => ({ status: "success" as const, checkpoint: { id: args.id, state: { note: "stored payload" } } }));
const launchAgentFromCheckpoint = mock(async (_args: { checkpointId: number }) => ({
  status: "success" as const,
  agentId: "agent-restored",
}));
const settled = () => mock(async () => undefined);

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, error: undefined, mutate: settled() }),
  useAgentTypes: () => ({ data: agentTypes, isLoading: false, error: undefined, mutate: settled() }),
  useChatModelsByProvider: () => ({ data: modelsByProvider ? { modelsByProvider } : undefined, isLoading: false, error: undefined, mutate: settled() }),
  useAppLogs: () => ({
    data: { logs: [{ id: 1, level: "info", message: "Server started", timestamp: now }] },
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  useCheckpointList: () => ({
    data: { items: checkpoints, total: checkpoints.length, hasMore: false, limit: 500, offset: 0 },
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  useAgentCheckpointList: () => ({ data: undefined, isLoading: false, error: undefined, mutate: settled() }),
  agentRPCClient: { createAgent, abortCurrentOperation, deleteAgent },
  checkpointRPCClient: { getCheckpoint, launchAgentFromCheckpoint },
  chatRPCClient: { clearChatMessages: mock() },
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div data-testid={`chat-panel:${agentId}`}>chat</div>,
}));
void mock.module("../../components/ModelSelector.tsx", () => ({ default: () => null }));
// The chat header's agent-setting selectors have their own tests.
void mock.module("../../components/HookSelector.tsx", () => ({ default: () => null }));
void mock.module("../../components/SkillSelector.tsx", () => ({ default: () => null }));
void mock.module("../../components/ToolApprovalSelector.tsx", () => ({ default: () => null }));
void mock.module("../../components/chat/GoalChip.tsx", () => ({ default: () => null }));
void mock.module("../../components/ToolSelector.tsx", () => ({ default: () => null }));
// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

// jsdom has no scrolling; the log widget's AutoScrollContainer calls scrollTo.
if (!Element.prototype.scrollTo) Element.prototype.scrollTo = () => {};

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { HOME_APP } = await import("./manifest.ts");
const { HOME_VIEWS } = await import("./views.ts");
const { STARTER_TASKS, summarizeProviders, WELCOME_DISMISSED_KEY } = await import("./WelcomeView.tsx");

const registry = createLayoutRegistry({ apps: [HOME_APP], views: [...HOME_VIEWS, ...CHAT_VIEWS], kinds: CORE_KINDS });

function panel(key: string) {
  const node = document.querySelector<HTMLElement>(`[data-panel="${key}"]`);
  if (!node) throw new Error(`panel ${key} is not mounted`);
  return within(node);
}

const renderHome = (url = "/home") => renderLayoutApp({ registry, url });

describe("Home app", () => {
  beforeEach(() => {
    localStorage.clear();
    agentList = [coder, busy];
    agentTypes = [{ type: "code", displayName: "Code Engineer", description: "Writes code" }];
    modelsByProvider = { openai: { "openai/gpt": { available: true }, "openai/old": { available: false } } };
    checkpoints = checkpointItems;
    for (const fn of [createAgent, abortCurrentOperation, deleteAgent, getCheckpoint, launchAgentFromCheckpoint]) fn.mockClear();
  });

  it("shows the welcome guide and every core widget", () => {
    renderHome();
    expect(panel("welcome:_").getByText("Welcome to TokenRing")).toBeInTheDocument();
    expect(panel("active-agents:_").getByRole("list", { name: "Running agents" })).toBeInTheDocument();
    expect(panel("quick-launch:_").getByRole("button", { name: "Launch Code Engineer" })).toBeInTheDocument();
    expect(panel("app-logs:_").getByText("Server started")).toBeInTheDocument();
    expect(panel("checkpoints:_").getByText("First checkpoint")).toBeInTheDocument();
  });

  describe("active agents", () => {
    it("opens a chat on Home at /home/agent/<id>", async () => {
      const user = userEvent.setup();
      const app = renderHome();
      await user.click(panel("active-agents:_").getByRole("button", { name: "Open chat with Coder, idle" }));
      expect(app.location().pathname).toBe("/home/agent/agent-1");
      expect(screen.getByTestId("chat-panel:agent-1")).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /^Coder/ }).getAttribute("aria-selected")).toBe("true");
    });

    it("offers Stop only for busy agents and aborts the current operation", async () => {
      const user = userEvent.setup();
      renderHome();
      const widget = panel("active-agents:_");
      expect(widget.queryByRole("button", { name: "Stop Coder" })).toBeNull();
      await user.click(widget.getByRole("button", { name: "Stop Busy Bee" }));
      await waitFor(() => expect(abortCurrentOperation).toHaveBeenCalledWith(expect.objectContaining({ agentId: "agent-2" })));
    });

    it("deletes an agent only after confirmation, closing its open chat", async () => {
      const user = userEvent.setup();
      const app = renderHome("/home/agent/agent-1");
      expect(screen.getByTestId("chat-panel:agent-1")).toBeInTheDocument();
      await user.click(panel("active-agents:_").getByRole("button", { name: "End agent Coder" }));
      const dialog = await screen.findByRole("dialog");
      expect(dialog).toHaveTextContent('End "Coder"');
      expect(deleteAgent).not.toHaveBeenCalled();
      await user.click(within(dialog).getByRole("button", { name: "End agent" }));
      await waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(expect.objectContaining({ agentId: "agent-1" })));
      await waitFor(() => expect(screen.queryByTestId("chat-panel:agent-1")).toBeNull());
      expect(app.location().pathname).toBe("/home");
    });

    it("sends an empty list to the Agents app", async () => {
      const user = userEvent.setup();
      agentList = [];
      const app = renderHome();
      await user.click(panel("active-agents:_").getByRole("button", { name: "New agent" }));
      expect(app.location().pathname).toBe("/agents");
    });
  });

  describe("quick launch", () => {
    it("launches an agent and opens its chat on Home", async () => {
      const user = userEvent.setup();
      const app = renderHome();
      await user.click(panel("quick-launch:_").getByRole("button", { name: "Launch Code Engineer" }));
      await waitFor(() => expect(app.location().pathname).toBe("/home/agent/agent-new"));
      expect(createAgent).toHaveBeenCalledWith({ agentType: "code" });
    });

    it("offers New agent and a marketplace link when there are no agent types", async () => {
      const user = userEvent.setup();
      agentTypes = [];
      const app = renderHome();
      const widget = panel("quick-launch:_");
      expect(widget.getByRole("link", { name: "Browse marketplace" })).toHaveAttribute("href", "/marketplace/agent");
      await user.click(widget.getByRole("button", { name: "New agent" }));
      expect(app.location().pathname).toBe("/agents/new");
    });
  });

  describe("checkpoints", () => {
    it("relaunches a checkpoint into a chat on Home", async () => {
      const user = userEvent.setup();
      const app = renderHome();
      await user.click(panel("checkpoints:_").getByRole("button", { name: "Launch agent from checkpoint: First checkpoint" }));
      await waitFor(() => expect(app.location().pathname).toBe("/home/agent/agent-restored"));
      expect(launchAgentFromCheckpoint).toHaveBeenCalledWith({ checkpointId: 1 });
    });

    it("loads the stored checkpoint when a row is opened", async () => {
      const user = userEvent.setup();
      renderHome();
      await user.click(panel("checkpoints:_").getByRole("button", { name: "Open checkpoint Second checkpoint" }));
      const stored = await panel("checkpoints:_").findByRole("region", { name: "Stored checkpoint Second checkpoint" });
      expect(stored.textContent).toContain("stored payload");
      expect(getCheckpoint).toHaveBeenCalledWith({ id: 2 });
    });

    it("says how checkpoints are created when there are none", () => {
      checkpoints = [];
      renderHome();
      expect(panel("checkpoints:_").getByText("No checkpoints yet")).toBeInTheDocument();
    });
  });

  describe("welcome", () => {
    // Running agents lead on Home; the guide is the tab beside them.
    const openWelcome = () => userEvent.setup().click(screen.getByRole("tab", { name: /^Welcome/ }));

    it("stores its dismissal under a clearable preference key", () => {
      expect(CLIENT_PREFERENCE_KEYS).toContain(WELCOME_DISMISSED_KEY);
    });

    it("summarizes reachable providers and models", () => {
      expect(summarizeProviders({ a: { x: { available: true }, y: { available: false } }, b: { z: { available: false } } })).toEqual({
        providers: 2,
        onlineProviders: 1,
        onlineModels: 1,
      });
    });

    it("says a provider is ready and links to Agents, the marketplace and Configuration", async () => {
      renderHome();
      await openWelcome();
      const welcome = panel("welcome:_");
      expect(welcome.getByTestId("welcome-provider-ready")).toBeInTheDocument();
      expect(welcome.getByRole("link", { name: "Open Agents" })).toHaveAttribute("href", "/agents");
      expect(welcome.getByRole("link", { name: "Browse marketplace" })).toHaveAttribute("href", "/marketplace/agent");
      expect(welcome.getByRole("link", { name: "Configuration" })).toHaveAttribute("href", "/configuration");
    });

    it("links to the AI client's configuration when no provider is configured", async () => {
      modelsByProvider = {};
      renderHome();
      await openWelcome();
      const welcome = panel("welcome:_");
      expect(welcome.getByTestId("welcome-no-provider")).toBeInTheDocument();
      expect(welcome.getByRole("link", { name: "Connect an AI service" })).toHaveAttribute("href", "/configuration/ai-providers");
    });

    it("links to the setup guide on the docs site, in a new tab", async () => {
      renderHome();
      await openWelcome();
      const link = panel("welcome:_").getByRole("link", { name: /Setup guide/ });
      expect(link).toHaveAttribute("href", "https://docs.tokenring.ai/docs/getting-started");
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noopener noreferrer");
    });

    it("offers practical starter tasks once a provider is connected, each on an agent type that is installed", async () => {
      agentTypes = [
        ...agentTypes,
        { type: "writer", displayName: "Writer", description: "Writes" },
        { type: "calendar", displayName: "Calendar", description: "Calendar" },
      ];
      renderHome();
      await openWelcome();
      const starters = within(panel("welcome:_").getByTestId("welcome-starter-tasks"));
      expect(starters.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual([
        "Reply to a customer's email",
        "Write a quote for a job",
        "Friendly reminder for an unpaid invoice",
        "Plan next week's crew schedule",
        "Summarise a document",
        "Brainstorm options for a decision",
      ]);
    });

    it("starts a writer and opens its chat with the request prefilled, not sent", async () => {
      const user = userEvent.setup();
      agentTypes = [...agentTypes, { type: "writer", displayName: "Writer", description: "Writes" }];
      const app = renderHome();
      await openWelcome();
      await user.click(within(panel("welcome:_").getByTestId("welcome-starter-tasks")).getByRole("button", { name: "Reply to a customer's email" }));
      await waitFor(() => expect(app.location().pathname).toBe("/home/agent/agent-new"));
      expect(createAgent).toHaveBeenCalledWith({ agentType: "writer" });
      const drafts = JSON.parse(localStorage.getItem("tokenring-chat-inputs") ?? "{}") as Record<string, string>;
      expect(drafts["agent-new"]).toContain("same language the customer wrote in");
      expect(drafts["agent-new"]).toContain("Do not send anything");
      expect(drafts["agent-new"]).toContain("[paste it here]");
    });

    it("starts the calendar assistant for the schedule card, prefilled as read-only, and hides cards whose agent type is missing", async () => {
      const user = userEvent.setup();
      agentTypes = [...agentTypes, { type: "calendar", displayName: "Calendar", description: "Calendar" }];
      const app = renderHome();
      await openWelcome();
      const starters = within(panel("welcome:_").getByTestId("welcome-starter-tasks"));
      // No writer installed: only the calendar card remains.
      expect(starters.getAllByRole("button").map(button => button.getAttribute("aria-label"))).toEqual(["Plan next week's crew schedule"]);
      await user.click(starters.getByRole("button", { name: "Plan next week's crew schedule" }));
      await waitFor(() => expect(app.location().pathname).toBe("/home/agent/agent-new"));
      expect(createAgent).toHaveBeenCalledWith({ agentType: "calendar" });
      const drafts = JSON.parse(localStorage.getItem("tokenring-chat-inputs") ?? "{}") as Record<string, string>;
      expect(drafts["agent-new"]).toContain("do not create, move, change or delete any event");
    });

    it("keeps every starter prompt to a draft and offers at most six cards", () => {
      expect(STARTER_TASKS.length).toBeLessThanOrEqual(6);
      for (const task of STARTER_TASKS.filter(t => ["reply", "quote", "invoice-reminder"].includes(t.id))) {
        expect(task.prompt).toContain("Do not send anything");
      }
    });

    it("tells people TokenRing asks before sending, posting or publishing", async () => {
      renderHome();
      await openWelcome();
      const note = panel("welcome:_").getByTestId("welcome-ask-first");
      expect(note).toHaveTextContent("asks you before it sends an email, posts online or publishes");
      expect(within(note).getByRole("link", { name: "See what is allowed" })).toHaveAttribute("href", "/configuration/permissions");
    });

    it("hides the starter tasks when no provider is connected and keeps the set-up call to action", async () => {
      modelsByProvider = {};
      agentTypes = [...agentTypes, { type: "writer", displayName: "Writer", description: "Writes" }];
      renderHome();
      await openWelcome();
      const welcome = panel("welcome:_");
      expect(welcome.queryByTestId("welcome-starter-tasks")).toBeNull();
      expect(welcome.getByRole("link", { name: "Connect an AI service" })).toBeInTheDocument();
      expect(welcome.queryByText(/model server/)).toBeNull();
    });

    it("dismissal persists in this browser and closes the panel", async () => {
      const user = userEvent.setup();
      renderHome();
      await openWelcome();
      await user.click(panel("welcome:_").getByRole("button", { name: "Dismiss welcome" }));
      expect(JSON.parse(localStorage.getItem(WELCOME_DISMISSED_KEY) ?? "null")).toBe(true);
      expect(screen.queryByRole("tab", { name: /^Welcome/ })).toBeNull();
    });
  });
});
