import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

const codeAgentType = {
  type: "code",
  displayName: "Code Engineer",
  description: "Writes and reviews code",
  category: "Engineering",
  enabledTools: ["filesystem/*", "shell/run"],
  source: "bundled" as const,
};

const researchAgentType = {
  type: "research",
  displayName: "Researcher",
  description: "Digs through the web",
  category: "Research",
  enabledTools: [],
  source: "bundled" as const,
};

/** An agent authored in the workspace agent directory — editable, unlike the bundled two. */
const authoredAgentType = {
  type: "reviewer",
  displayName: "Reviewer",
  description: "Reviews diffs",
  category: "Engineering",
  enabledTools: ["file_read"],
  source: "workspace" as const,
};

const agentBodies: Record<string, Record<string, unknown>> = {
  code: {
    displayName: "Code Engineer",
    description: "Writes and reviews code",
    category: "Engineering",
    chat: { systemPrompt: "You write code.", enabledTools: ["filesystem/*", "shell/run"] },
  },
  research: { displayName: "Researcher", description: "Digs through the web", category: "Research", chat: { enabledTools: [] } },
  reviewer: {
    displayName: "Reviewer",
    description: "Reviews diffs",
    category: "Engineering",
    chat: { systemPrompt: "Review it.", enabledTools: ["file_read"] },
  },
};

const marketplaceEntry = {
  kind: "agent" as const,
  id: "agent/coding/code-reviewer",
  installAs: "code-reviewer",
  displayName: "Community Code Reviewer",
  description: "Reviews diffs for correctness bugs",
  category: "Coding",
  author: "TokenRing Core",
  tags: ["review", "quality"],
  version: "1.0.0",
  updatedAt: "2026-08-01",
  icon: "🔍",
  requiresPlugins: [],
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

const createAgent = mock(async (_args: { agentType: string }) => ({ id: "agent-2", displayName: "New", description: "" }));
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" as const }));
const branchAgent = mock(async (_args: { agentId: string; at?: number }) => ({ status: "success" as const, agentId: "agent-branch", agentName: "Branch" }));
const createAgentDefinition = mock(async (args: { name: string; agent: Record<string, unknown> }) => ({
  agent: { ...args.agent, name: args.name, updatedAt: "" },
}));
const updateAgentDefinition = mock(async (args: { name: string; agent: Record<string, unknown> }) => ({
  agent: { ...args.agent, name: args.name, updatedAt: "" },
}));
const deleteAgentDefinition = mock(async (_args: { name: string }) => ({ success: true }));
const getAgentDirectory = mock(async () => ({ directory: "/workspace/agents" }));
let workspaceDefinitions: { name: string; updatedAt: string }[] = [];
const listAgentDefinitions = mock(async () => workspaceDefinitions);
const getAgentConfig = mock(async (_args: { agentId: string }) => ({ status: "success" as const, description: "Live config", idleTimeout: 120 }));
const installMarketplaceItem = mock(async (args: { id: string; installAs?: string }) => ({ kind: "agent" as const, name: args.installAs ?? "code-reviewer" }));
const listMarketplaceItems = mock(async (_args: { refresh: boolean }) => marketplaceListData);
const clearChatMessages = mock(async (_args: { agentId: string }) => ({ status: "success" as const }));

let agentList: (typeof runningAgent)[] = [];
let agentTypesData: (typeof codeAgentType | typeof authoredAgentType)[] = [codeAgentType, researchAgentType];
const marketplaceListData: Record<string, unknown> = {
  status: "success",
  registryName: "tokenring-ai/community",
  fetchedAt: 0,
  items: [marketplaceEntry],
  installed: {},
};
const marketplaceItemData: Record<string, unknown> = {
  entry: marketplaceEntry,
  marketplace: { version: "1.0.0", author: "TokenRing Core", readme: "Reviews your diffs." },
  kind: "agent",
  item: {
    displayName: "Community Code Reviewer",
    description: "Reviews diffs for correctness bugs",
    category: "Coding",
    chat: { enabledTools: ["file_read"] },
  },
  installedAs: null,
  existingNames: [],
};
const settled = () => mock(async () => undefined);

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agentList, isLoading: false, error: undefined, mutate: settled() }),
  useAgentTypes: () => ({ data: agentTypesData, isLoading: false, error: undefined, mutate: settled() }),
  useAgentTypeDetail: (type: string | null | undefined) => ({
    data: type && agentBodies[type] ? { status: "success", agent: agentBodies[type], updatedAt: null } : undefined,
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  useMarketplaceItems: (enabled: boolean) => ({ data: enabled ? marketplaceListData : undefined, isLoading: false, error: undefined, mutate: settled() }),
  useMarketplaceItem: (id: string | null | undefined) => ({
    data: id ? marketplaceItemData : undefined,
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  useTodos: () => ({ data: { status: "success", todos: [] }, isLoading: false }),
  usePermissionGrants: () => ({ data: { status: "success", grants: [], maxGrantLevel: 8 }, isLoading: false, error: undefined, mutate: async () => undefined }),
  useAgentJobs: () => ({ data: { jobs: [] }, isLoading: false, error: undefined, mutate: settled() }),
  useJobRollup: () => ({ data: undefined, isLoading: true, error: undefined, mutate: settled() }),
  useAgentCheckpointList: () => ({ data: undefined, isLoading: false, error: undefined, mutate: settled() }),
  useCheckpointList: () => ({
    data: {
      items: [{ id: 7, name: "Before the refactor", agentId: "agent-1", agentType: "code", createdAt: 1 }],
      total: 1,
      hasMore: false,
      limit: 50,
      offset: 0,
    },
    isLoading: false,
    error: undefined,
    mutate: settled(),
  }),
  agentRPCClient: {
    createAgent,
    deleteAgent,
    branchAgent,
    createAgentDefinition,
    updateAgentDefinition,
    deleteAgentDefinition,
    getAgentDirectory,
    listAgentDefinitions,
    getAgentConfig,
  },
  agentJobsRPCClient: { cancelJob: mock() },
  chatRPCClient: { clearChatMessages },
  checkpointRPCClient: { launchAgentFromCheckpoint: mock() },
  marketplaceRPCClient: { installMarketplaceItem, listMarketplaceItems },
}));

// The live chat body and the agent controls are covered by their own tests.
void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId, header }: { agentId: string; header?: React.ReactNode }) => <div data-testid={`chat-panel:${agentId}`}>{header}chat</div>,
}));
// The agent-setting selectors in the chat header have their own tests.
const NoSelector = () => null;
void mock.module("../../components/HookSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/SkillSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/ToolApprovalSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/chat/GoalChip.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/ModelSelector.tsx", () => ({ default: () => <span>model selector</span> }));
void mock.module("../../components/ToolSelector.tsx", () => ({ default: () => <span>tool selector</span> }));

// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { defineView } = await import("../../layout/define.ts");
const { Radar } = await import("lucide-react");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { AGENTS_APP } = await import("./manifest.ts");
const { AGENTS_VIEWS } = await import("./views.ts");
const { resetAgentDraftStore, getAgentDraft, NEW_DRAFT_KEY } = await import("./agentDraftStore.ts");
const { clearAgentSessionMetaForTests, setAgentSessionTitle } = await import("../../hooks/agentSessionMetaStore.ts");

const registry = createLayoutRegistry({ apps: [AGENTS_APP], views: [...AGENTS_VIEWS, ...CHAT_VIEWS], kinds: CORE_KINDS });

/** The element a panel renders into, for scoping queries (the list and the overview share labels). */
function panel(key: string): HTMLElement {
  const node = document.querySelector<HTMLElement>(`[data-panel="${key}"]`);
  if (!node) throw new Error(`panel ${key} is not mounted`);
  return node;
}
const list = () => within(panel("agent-list:_"));
const tab = (name: string | RegExp) => screen.getByRole("tab", { name });

function renderAgents(url: string, withRegistry = registry) {
  return renderLayoutApp({ registry: withRegistry, url });
}

/** The Monitors app is a plugin's; the Agents app relies only on its create view's id and route. */
const monitorsRegistry = createLayoutRegistry({
  apps: [
    AGENTS_APP,
    {
      id: "monitors",
      path: "/monitors",
      label: "Monitors",
      shortLabel: "MO",
      description: "",
      group: "Operate",
      icon: Radar,
      iconClass: "",
      gradient: "",
      views: ["monitor-create"],
      primaryKind: "monitor",
      layout: { presenter: "tabs", accepts: ["monitor"], items: [], primary: true },
    },
  ],
  views: [
    ...AGENTS_VIEWS,
    ...CHAT_VIEWS,
    defineView({
      id: "monitor-create",
      kind: "monitor",
      title: "New monitor",
      icon: Radar,
      route: "new/:kind?/:target?",
      component: () => <p>monitor form stub</p>,
    }),
  ],
  kinds: [...CORE_KINDS, { id: "monitor", label: "Monitors", plural: "monitor views" }],
});

describe("Agents app", () => {
  beforeEach(() => {
    localStorage.clear();
    clearAgentSessionMetaForTests();
    resetAgentDraftStore();
    for (const fn of [createAgent, deleteAgent, createAgentDefinition, updateAgentDefinition, deleteAgentDefinition, installMarketplaceItem, getAgentConfig]) {
      fn.mockClear();
    }
    workspaceDefinitions = [{ name: "reviewer", updatedAt: "2026-08-01T00:00:00.000Z" }];
    agentList = [];
    agentTypesData = [codeAgentType, researchAgentType];
  });

  describe("routes", () => {
    it("/agents shows the running agents beside the Start page", () => {
      agentList = [runningAgent];
      renderAgents("/agents");
      expect(list().getByRole("link", { name: /^Open agent Code Engineer #1/ })).toBeInTheDocument();
      // Agent types are on the Start page, not in the sidebar.
      expect(list().queryByText("Researcher")).toBeNull();
      const start = within(panel("agents-start:_"));
      expect(start.getByRole("region", { name: "Engineering" })).toBeInTheDocument();
      expect(start.getByRole("button", { name: "Launch Researcher" })).toBeInTheDocument();
    });

    it("lists a sub-agent under the agent that started it", () => {
      const subAgent = { ...idleAgent, id: "agent-sub", parentAgentId: runningAgent.id, createdAt: 1_800_000_000_000 };
      agentList = [subAgent, runningAgent];
      renderAgents("/agents");
      const rows = list()
        .getAllByRole("listitem")
        .filter(row => row.hasAttribute("data-depth"));
      expect(rows.map(row => row.getAttribute("data-depth"))).toEqual(["0", "1"]);
      expect(within(rows[1]!).getByRole("link", { name: /^Open agent Researcher #1.*, sub-agent of Code Engineer #1$/ })).toBeInTheDocument();
    });

    it("describes a type's live agents in the same words as the rows", () => {
      agentList = [idleAgent];
      renderAgents("/agents");
      const start = within(panel("agents-start:_"));
      expect(start.getByText("1 idle")).toBeInTheDocument();
      expect(start.queryByText(/running/)).toBeNull();
    });

    it("/agents/new opens the create form", () => {
      renderAgents("/agents/new");
      expect(tab(/^New agent type/).getAttribute("aria-selected")).toBe("true");
      expect(within(panel("agent-type-create:_")).getByLabelText(/Agent type/)).toBeInTheDocument();
    });

    it("/agents/<type> opens that type", async () => {
      renderAgents("/agents/code");
      const detail = within(panel("agent-type-detail:code"));
      expect(detail.getByLabelText(/Display name/)).toHaveValue("Code Engineer");
      // The tab takes the type's display name.
      await waitFor(() => expect(tab(/^Code Engineer/).getAttribute("aria-selected")).toBe("true"));
    });

    it("/agent/<id> opens the chat with the agent's controls in its header", async () => {
      agentList = [runningAgent];
      renderAgents("/agent/agent-1");
      expect(screen.getByTestId("chat-panel:agent-1")).toBeInTheDocument();
      const header = screen.getByTestId("chat-header");
      expect(within(header).getByText("model selector")).toBeInTheDocument();
      expect(within(header).getByText("tool selector")).toBeInTheDocument();
      expect(within(header).getByText("Working")).toBeInTheDocument();
      await waitFor(() => expect(tab(/^Code Engineer #1/).getAttribute("aria-selected")).toBe("true"));
    });

    it("opens chats in the main area, where the Start page gives way to them", () => {
      agentList = [runningAgent];
      const app = renderAgents("/agents");
      expect(document.querySelector('[data-panel="agents-start:_"]')).not.toBeNull();
      app.go("/agent/agent-1");
      expect(screen.getByTestId("chat-panel:agent-1")).toBeInTheDocument();
      expect(document.querySelector('[data-panel="agents-start:_"]')).toBeNull();
      // The sidebar's tabs plus one main strip: the chat took the Start page's place rather than a new column.
      expect(screen.getAllByRole("tablist")).toHaveLength(2);
    });
  });

  describe("agent list", () => {
    it("opens a running agent's chat at /agent/<id>", async () => {
      const user = userEvent.setup();
      agentList = [idleAgent, runningAgent];
      const app = renderAgents("/agents");
      const rows = list().getAllByRole("link", { name: /^Open agent/ });
      // Busy agents first.
      expect(rows.map(row => row.getAttribute("aria-label"))).toEqual(["Open agent Code Engineer #1, working", "Open agent Researcher #1, idle"]);
      expect(rows[1]!.getAttribute("href")).toBe("/agent/agent-idle");

      await user.click(rows[1]!);
      expect(app.location().pathname).toBe("/agent/agent-idle");
      expect(screen.getByTestId("chat-panel:agent-idle")).toBeInTheDocument();
    });

    it("lists agents waiting on you first and says so", () => {
      agentList = [idleAgent, runningAgent, { ...idleAgent, id: "asking", displayName: "Asker", pendingQuestions: 1 } as typeof runningAgent];
      renderAgents("/agents");
      const rows = list().getAllByRole("link", { name: /^Open agent/ });
      expect(rows[0]!.getAttribute("aria-label")).toBe("Open agent Asker, needs you");
      expect(within(rows[0]!).getByText("Needs you")).toBeInTheDocument();
    });

    it("has Running, Checkpoints and Launch tabs, with the count on Running", async () => {
      const user = userEvent.setup();
      agentList = [runningAgent, idleAgent];
      const app = renderAgents("/agents");
      expect(tab(/^Running/)).toHaveTextContent("2");
      expect(list().queryByText("Running")).toBeNull();

      await user.click(tab(/^Checkpoints/));
      expect(within(panel("agent-checkpoints:_")).getByText("Before the refactor")).toBeInTheDocument();

      await user.click(tab(/^Launch$/));
      const launcher = within(panel("agent-launch:_"));
      await user.click(launcher.getByRole("button", { name: "Launch Researcher" }));
      await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research" }));
      await user.click(launcher.getByRole("link", { name: "Marketplace" }));
      expect(app.location().pathname).toBe("/marketplace/agent");
    });

    it("shows the agent type as a label, not under the row's controls", () => {
      agentList = [runningAgent];
      setAgentSessionTitle("agent-1", "hi");
      renderAgents("/agents");
      const row = list().getByRole("link", { name: /^Open agent/ });
      expect(row).toHaveTextContent("hi");
      expect(row).toHaveTextContent("Code Engineer #1");
      expect(list().getAllByRole("button", { name: /^Actions for/ })).toHaveLength(1);
    });

    it("branches an agent from its row menu and opens the copy", async () => {
      agentList = [runningAgent];
      const app = renderAgents("/agents");
      fireEvent.keyDown(list().getByRole("button", { name: "Actions for Code Engineer #1" }), { key: "Enter" });
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Branch into a new agent" }));
      await waitFor(() => expect(branchAgent).toHaveBeenCalledWith({ agentId: "agent-1" }));
      await waitFor(() => expect(app.location().pathname).toBe("/agent/agent-branch"));
    });

    it("opens the Monitors create form with this agent chosen", async () => {
      agentList = [runningAgent];
      const app = renderAgents("/agents", monitorsRegistry);
      fireEvent.keyDown(list().getByRole("button", { name: "Actions for Code Engineer #1" }), { key: "Enter" });
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Monitor this agent" }));
      await waitFor(() => expect(app.location().pathname).toBe("/monitors/new/agent/agent-1"));
    });

    it("offers the open agent's actions in the sidebar's area menu", () => {
      agentList = [runningAgent];
      renderAgents("/agent/agent-1");
      const section = panel("agent-list:_").closest("section");
      fireEvent.keyDown(within(section as HTMLElement).getByRole("button", { name: "Container options" }), { key: "Enter" });
      const menu = within(screen.getByRole("menu"));
      expect(menu.getByRole("menuitem", { name: "Copy transcript as Markdown" })).toBeInTheDocument();
      expect(menu.getByRole("menuitem", { name: "Download as JSON" })).toBeInTheDocument();
    });

    it("ends a running agent after confirmation and closes its chat", async () => {
      const user = userEvent.setup();
      agentList = [runningAgent];
      const app = renderAgents("/agent/agent-1");
      fireEvent.keyDown(list().getByRole("button", { name: "Actions for Code Engineer #1" }), { key: "Enter" });
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "End agent…" }));
      await user.click(within(await screen.findByRole("dialog")).getByRole("button", { name: "End agent" }));

      await waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(expect.objectContaining({ agentId: "agent-1" })));
      await waitFor(() => expect(screen.queryByTestId("chat-panel:agent-1")).toBeNull());
      expect(app.location().pathname).toBe("/agents");
    });

    it("Ctrl/⌘+⌫ asks to delete the agent whose chat is focused", async () => {
      agentList = [runningAgent];
      renderAgents("/agent/agent-1");
      act(() => {
        document.body.dispatchEvent(new KeyboardEvent("keydown", { key: "Backspace", metaKey: true, bubbles: true, cancelable: true }));
      });
      await waitFor(() => expect(screen.getByRole("dialog")).toBeInTheDocument());
    });
  });

  describe("start page", () => {
    it("starts an agent and opens its chat in place of the page", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents");
      await user.click(within(panel("agents-start:_")).getByRole("button", { name: "Launch Researcher" }));
      await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research" }));
      await waitFor(() => expect(app.location().pathname).toBe("/agent/agent-2"));
    });

    it("opens a type from its name without starting it", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents");
      await user.click(within(panel("agents-start:_")).getByRole("link", { name: "Researcher" }));
      expect(createAgent).not.toHaveBeenCalled();
      expect(app.location().pathname).toBe("/agents/research");
      expect(within(panel("agent-type-detail:research")).getByLabelText(/Display name/)).toHaveValue("Researcher");
    });

    it("filters the agent types and links to the create form and the Marketplace app", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents");
      const start = within(panel("agents-start:_"));
      await user.type(start.getByRole("textbox", { name: "Find an agent type" }), "web");
      expect(start.queryByRole("button", { name: "Launch Code Engineer" })).toBeNull();
      expect(start.getByRole("button", { name: "Launch Researcher" })).toBeInTheDocument();
      expect(start.getByRole("link", { name: /Browse marketplace/ })).toHaveAttribute("href", "/marketplace/agent");
      await user.click(start.getByRole("button", { name: "New agent type" }));
      expect(app.location().pathname).toBe("/agents/new");
    });
  });

  describe("type detail", () => {
    it("browses a bundled agent type read-only, offering a clone instead of edits", () => {
      renderAgents("/agents/code");
      const detail = within(panel("agent-type-detail:code"));
      expect(detail.getByLabelText(/Display name/)).toBeDisabled();
      expect(detail.queryByRole("button", { name: /^Save$/ })).not.toBeInTheDocument();
      expect(detail.getByRole("button", { name: "Clone to workspace" })).toBeInTheDocument();
    });

    it("badges the tab with a warning while the draft is unsaved", async () => {
      agentTypesData = [codeAgentType, authoredAgentType];
      const user = userEvent.setup();
      renderAgents("/agents/reviewer");
      const detail = within(panel("agent-type-detail:reviewer"));
      const reviewerTab = () => tab(/^Reviewer/);
      expect(within(reviewerTab()).queryByRole("img", { name: "Unsaved changes" })).toBeNull();

      await user.type(detail.getByLabelText(/Display name/), "!");
      expect(within(reviewerTab()).getByRole("img", { name: "Unsaved changes" })).toBeInTheDocument();

      await user.click(detail.getByRole("button", { name: /Revert|Discard/ }));
      expect(within(reviewerTab()).queryByRole("img", { name: "Unsaved changes" })).toBeNull();
    });

    it("saves an edited workspace agent", async () => {
      agentTypesData = [codeAgentType, authoredAgentType];
      const user = userEvent.setup();
      renderAgents("/agents/reviewer");
      const detail = within(panel("agent-type-detail:reviewer"));
      const displayName = detail.getByLabelText(/Display name/);
      await user.clear(displayName);
      await user.type(displayName, "Reviewer II");
      await user.click(detail.getByRole("button", { name: "Save" }));

      await waitFor(() => expect(updateAgentDefinition).toHaveBeenCalled());
      const call = updateAgentDefinition.mock.calls[0]![0];
      expect(call.name).toBe("reviewer");
      expect(call.agent).toMatchObject({ displayName: "Reviewer II" });
      expect(call.agent.chat).toMatchObject({ systemPrompt: "Review it.", enabledTools: ["file_read"] });
      await waitFor(() => expect(getAgentDraft("reviewer")).toBeUndefined());
    });

    it("deletes a workspace agent after confirmation, closing its tab and returning to the start page", async () => {
      agentTypesData = [codeAgentType, authoredAgentType];
      const user = userEvent.setup();
      const app = renderAgents("/agents/reviewer");
      await user.click(within(panel("agent-type-detail:reviewer")).getByRole("button", { name: "Delete agent Reviewer" }));
      await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Delete" }));

      await waitFor(() => expect(deleteAgentDefinition).toHaveBeenCalledWith({ name: "reviewer" }));
      await waitFor(() => expect(app.location().pathname).toBe("/agents"));
      expect(screen.queryByRole("tab", { name: /^Reviewer/ })).toBeNull();
    });

    it("clones a bundled agent into the create form with a free name", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents/code");
      await user.click(within(panel("agent-type-detail:code")).getByRole("button", { name: "Clone to workspace" }));
      expect(app.location().pathname).toBe("/agents/new");
      expect(within(panel("agent-type-create:_")).getByLabelText(/Agent type/)).toHaveValue("code-copy");
      expect(getAgentDraft(NEW_DRAFT_KEY)?.displayName).toBe("Code Engineer (copy)");
    });

    it("shows a not-found state for a type that is no longer configured, and closes it", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents/ghost");
      const detail = within(panel("agent-type-detail:ghost"));
      expect(detail.getByText("Agent type not found")).toBeInTheDocument();
      await user.click(detail.getByRole("button", { name: "Close panel" }));
      expect(app.location().pathname).toBe("/agents");
    });
  });

  describe("create", () => {
    it("creates a new workspace agent and opens it in place of the form", async () => {
      const user = userEvent.setup();
      const app = renderAgents("/agents/new");
      const form = within(panel("agent-type-create:_"));
      await user.type(form.getByLabelText(/Agent type/), "helper");
      await user.type(form.getByLabelText(/Display name/), "Helper");
      await user.type(form.getByLabelText("Description"), "Helps out");
      await user.type(form.getByLabelText("System prompt"), "Be helpful.");
      await user.click(form.getByRole("button", { name: "Create" }));

      await waitFor(() => expect(createAgentDefinition).toHaveBeenCalled());
      const call = createAgentDefinition.mock.calls[0]![0];
      expect(call.name).toBe("helper");
      expect(call.agent.chat).toMatchObject({ systemPrompt: "Be helpful." });
      await waitFor(() => expect(app.location().pathname).toBe("/agents/helper"));
      expect(screen.queryByRole("tab", { name: /^New agent type/ })).toBeNull();
    });

    it("rejects the reserved route names as agent type names", async () => {
      const user = userEvent.setup();
      renderAgents("/agents/new");
      const form = within(panel("agent-type-create:_"));
      await user.type(form.getByLabelText(/Display name/), "Helper");
      await user.type(form.getByLabelText("Description"), "Helps out");
      for (const reserved of ["new", "Marketplace", "jobs"]) {
        const name = form.getByLabelText(/Agent type/);
        await user.clear(name);
        await user.type(name, reserved);
        expect(form.getByText(`"${reserved}" is reserved by the Agents dashboard; pick another name.`)).toBeInTheDocument();
        expect(form.getByRole("button", { name: "Create" })).toBeDisabled();
      }
      expect(createAgentDefinition).not.toHaveBeenCalled();
    });

    it("badges the create tab while the new agent type has unsaved input", async () => {
      const user = userEvent.setup();
      renderAgents("/agents/new");
      expect(within(tab(/^New agent type/)).queryByRole("img")).toBeNull();
      await user.type(within(panel("agent-type-create:_")).getByLabelText(/Display name/), "Helper");
      expect(within(tab(/^New agent type/)).getByRole("img", { name: "Unsaved new agent type" })).toBeInTheDocument();
    });
  });
});
