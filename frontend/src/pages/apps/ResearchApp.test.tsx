import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const topics = [
  { name: "solid-state-batteries", itemCount: 2, updatedAt: "2026-07-01T12:00:00.000Z" },
  { name: "local-ai-tools", itemCount: 0, updatedAt: "2026-07-01T11:00:00.000Z" },
];

const batteryItems = [
  { topicName: "solid-state-batteries", name: "summary", size: 420, updatedAt: "2026-07-01T12:00:00.000Z" },
  { topicName: "solid-state-batteries", name: "toc", size: 180, updatedAt: "2026-07-01T12:01:00.000Z" },
];

const summaryItem = {
  topicName: "solid-state-batteries",
  name: "summary",
  content: "# Summary\n\nSolid-state batteries are promising.",
  size: 420,
  updatedAt: "2026-07-01T12:00:00.000Z",
};

let topicsState = [...topics];
let itemsByTopic: Record<string, typeof batteryItems> = {
  "solid-state-batteries": [...batteryItems],
  "local-ai-tools": [],
};
let getItemResult: typeof summaryItem | null = summaryItem;

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({
  id: "research-agent-1",
  displayName: "Researcher",
  description: "",
}));
const sendInput = mock(async () => ({ status: "ok" as const }));
const deleteAgent = mock(async () => ({ status: "success" as const }));
const createTopic = mock(async (args: { name: string }) => {
  const topic = { name: args.name, itemCount: 0, updatedAt: new Date().toISOString() };
  topicsState = [...topicsState, topic];
  itemsByTopic[args.name] = [];
  return { topic };
});
const deleteTopic = mock(async (args: { name: string }) => {
  topicsState = topicsState.filter(t => t.name !== args.name);
  delete itemsByTopic[args.name];
  return { success: true };
});
const createItem = mock(async (args: { topicName: string; name: string; content: string }) => {
  const item = {
    topicName: args.topicName,
    name: args.name,
    content: args.content,
    size: args.content.length,
    updatedAt: new Date().toISOString(),
  };
  const list = itemsByTopic[args.topicName] ?? [];
  itemsByTopic[args.topicName] = [...list, { topicName: args.topicName, name: args.name, size: item.size, updatedAt: item.updatedAt }];
  const topic = topicsState.find(t => t.name === args.topicName);
  if (topic) topic.itemCount = itemsByTopic[args.topicName]!.length;
  return { item };
});
const updateItem = mock(async (args: { topicName: string; name: string; content: string }) => {
  const item = {
    topicName: args.topicName,
    name: args.name,
    content: args.content,
    size: args.content.length,
    updatedAt: new Date().toISOString(),
  };
  return { item };
});
const deleteItem = mock(async (args: { topicName: string; name: string }) => {
  itemsByTopic[args.topicName] = (itemsByTopic[args.topicName] ?? []).filter(i => i.name !== args.name);
  return { success: true };
});
const getItem = mock(async (_args: { topicName: string; name: string }) => ({ item: getItemResult }));
const listItems = mock(async (args: { topicName: string }) => ({ items: itemsByTopic[args.topicName] ?? [] }));
const updateResearchState = mock(async () => ({
  status: "success" as const,
  selectedTopicName: null,
  selectedItemName: null,
}));
const mutateTopics = mock(async () => undefined);

void mock.module("../../rpc.ts", () => ({
  useTopics: () => ({ data: { topics: topicsState }, isLoading: false, error: undefined, mutate: mutateTopics }),
  useItems: (topicName: string | null) => ({
    data: topicName ? { items: itemsByTopic[topicName] ?? [] } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useAgentTypes: () => ({
    data: [{ type: "research", displayName: "Researcher", description: "Deep research", category: "Research", enabledTools: [] }],
    isLoading: false,
  }),
  agentRPCClient: { createAgent, sendInput, deleteAgent },
  researchRPCClient: {
    createTopic,
    deleteTopic,
    createItem,
    updateItem,
    deleteItem,
    getItem,
    listItems,
    updateResearchState,
  },
}));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div>Chat with {agentId}</div>,
}));

void mock.module("../../components/AgentLauncherBar.tsx", () => ({
  default: ({ buttonLabel, onLaunch }: { buttonLabel: string; onLaunch: (id: string) => void }) => (
    <button type="button" onClick={() => onLaunch("launched-agent")}>
      {buttonLabel}
    </button>
  ),
}));

void mock.module("@monaco-editor/react", () => ({
  default: ({ value, onChange }: { value: string; onChange?: (v: string | undefined) => void }) => (
    <textarea aria-label="Markdown editor" value={value} onChange={e => onChange?.(e.target.value)} />
  ),
}));

void mock.module("../../hooks/useTheme.ts", () => ({
  useTheme: () => ["dark", mock()] as const,
}));

const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { default: ResearchApp } = await import("./ResearchApp.tsx");

function renderApp(initialPath = "/research") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/research/:topicName?/:itemName?" element={<ResearchApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("ResearchApp", () => {
  beforeEach(() => {
    topicsState = [...topics];
    itemsByTopic = {
      "solid-state-batteries": [...batteryItems],
      "local-ai-tools": [],
    };
    getItemResult = { ...summaryItem };
    createAgent.mockClear();
    sendInput.mockClear();
    createTopic.mockClear();
    deleteTopic.mockClear();
    createItem.mockClear();
    updateItem.mockClear();
    deleteItem.mockClear();
    getItem.mockClear();
    listItems.mockClear();
    updateResearchState.mockClear();
    mutateTopics.mockClear();
  });

  it("shows the landing empty state and topic list", () => {
    renderApp();

    expect(screen.getByText("Start researching")).toBeInTheDocument();
    expect(screen.getByText("solid-state-batteries")).toBeInTheDocument();
    expect(screen.getByText("local-ai-tools")).toBeInTheDocument();
    expect(screen.getByLabelText("Research query")).toBeInTheDocument();
  });

  it("starts a research agent from the landing prompt", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.type(screen.getByLabelText("Research query"), "Solid-state battery timeline");
    await user.click(screen.getByRole("button", { name: "Start research agent" }));

    await waitFor(() => expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false }));
    expect(sendInput).toHaveBeenCalledWith({
      agentId: "research-agent-1",
      input: {
        from: "Research app",
        message: "/deep research Solid-state battery timeline",
      },
    });
    expect(screen.getByText("Chat with research-agent-1")).toBeInTheDocument();
  });

  it("opens a markdown dossier in preview mode", async () => {
    renderApp("/research/solid-state-batteries/summary");

    await waitFor(() => expect(getItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "summary" }));
    await waitFor(() => expect(screen.getByText("Solid-state batteries are promising.")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Preview/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.queryByLabelText("Markdown editor")).not.toBeInTheDocument();
  });

  it("switches to edit mode and saves changes", async () => {
    const user = userEvent.setup();
    renderApp("/research/solid-state-batteries/summary");

    await waitFor(() => expect(screen.getByText("Solid-state batteries are promising.")).toBeInTheDocument());

    await user.click(screen.getByRole("button", { name: /Edit/i }));
    const editor = await screen.findByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "# Updated summary");

    const saveButton = screen.getByRole("button", { name: "Save" });
    expect(saveButton).not.toBeDisabled();
    await user.click(saveButton);

    await waitFor(() =>
      expect(updateItem).toHaveBeenCalledWith({
        topicName: "solid-state-batteries",
        name: "summary",
        content: "# Updated summary",
      }),
    );
  });

  it("lists items when a topic is expanded", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByText("solid-state-batteries"));
    expect(await screen.findByText("summary")).toBeInTheDocument();
    expect(screen.getByText("toc")).toBeInTheDocument();
  });

  it("creates a new topic", async () => {
    const user = userEvent.setup();
    renderApp();

    await user.click(screen.getByTitle("New topic"));
    const input = screen.getByPlaceholderText("solid-state-batteries");
    await user.type(input, "quantum-sensors");
    await user.click(screen.getByRole("button", { name: "Create" }));

    await waitFor(() => expect(createTopic).toHaveBeenCalledWith({ name: "quantum-sensors" }));
  });

  it("shows a retry action when an item fails to load", async () => {
    const user = userEvent.setup();
    getItemResult = null;
    renderApp("/research/solid-state-batteries/summary");

    await waitFor(() => expect(screen.getByText(/not found/i)).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Retry" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Back to topics" })).toBeInTheDocument();

    getItemResult = { ...summaryItem };
    await user.click(screen.getByRole("button", { name: "Retry" }));

    await waitFor(() => expect(screen.getByText("Solid-state batteries are promising.")).toBeInTheDocument());
  });

  it("prompts before discarding unsaved edits when opening another item", async () => {
    const user = userEvent.setup();
    renderApp("/research/solid-state-batteries/summary");

    await waitFor(() => expect(screen.getByText("Solid-state batteries are promising.")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: /Edit/i }));
    const editor = await screen.findByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "# Unsaved draft");

    // Selected topic is auto-expanded from the route, so toc is already listed
    await user.click(await screen.findByText("toc"));

    expect(screen.getByText("Discard unsaved changes?")).toBeInTheDocument();
    expect(getItem).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Discard" }));

    await waitFor(() => expect(getItem).toHaveBeenCalledWith({ topicName: "solid-state-batteries", name: "toc" }));
  });
});
