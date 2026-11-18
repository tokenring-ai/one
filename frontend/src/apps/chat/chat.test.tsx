import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { List } from "lucide-react";
import type React from "react";

type Agent = { id: string; displayName: string; agentType: string; idle: boolean; currentActivity: string; createdAt: number };
type Checkpoint = { id: number; name: string; agentId: string; createdAt: number };

let agents: Agent[] = [];
let checkpoints: Checkpoint[] = [];
const clearChatMessages = mock(async (_args: { agentId: string }) => ({ status: "success" as const }));
const launchAgentFromCheckpoint = mock(async (_args: { checkpointId: number }) => ({
  status: "success" as const,
  agentId: "agent-restored",
}));

void mock.module("../../rpc.ts", () => ({
  useAgentList: () => ({ data: agents, isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  useAgentCheckpointList: (agentId: string | undefined) => ({
    data: agentId ? { items: checkpoints, total: checkpoints.length, hasMore: false, limit: 200, offset: 0 } : undefined,
    isLoading: false,
    error: undefined,
    mutate: mock(async () => undefined),
  }),
  useAgentTypes: () => ({ data: [], isLoading: false, error: undefined, mutate: mock(async () => undefined) }),
  chatRPCClient: { clearChatMessages },
  checkpointRPCClient: { launchAgentFromCheckpoint },
  agentRPCClient: { branchAgent: mock(async () => ({ status: "success", agentId: "agent-branch", agentName: "Branch" })) },
}));

type BadgeProps = { agentId: string; header?: React.ReactNode; onBadgeChange?: (badge: { tone?: "accent" | "warning"; title?: string } | null) => void };
// focus-trap refuses to activate in jsdom, where nothing has layout and so nothing looks tabbable.
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

// The live chat body is covered by ChatPanel.test; this stand-in raises a badge like a background completion does.
void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId, onBadgeChange, header }: BadgeProps) => (
    <div data-testid={`chat-panel:${agentId}`}>
      {header}
      <button type="button" onClick={() => onBadgeChange?.({ tone: "accent", title: "Task finished — open to view" })}>
        finish in background
      </button>
    </div>
  ),
}));
// The agent-setting selectors in the chat header have their own tests.
const NoSelector = () => null;
void mock.module("../../components/HookSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/SkillSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/ToolApprovalSelector.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/chat/GoalChip.tsx", () => ({ default: NoSelector }));
void mock.module("../../components/ModelSelector.tsx", () => ({ default: ({ agentId }: { agentId: string }) => <span>model for {agentId}</span> }));
void mock.module("../../components/ToolSelector.tsx", () => ({ default: ({ agentId }: { agentId: string }) => <span>tools for {agentId}</span> }));
void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: { error: mock(), warning: mock(), success: mock(), info: mock() },
}));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { defineApp } = await import("../../layout/define.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("./views.ts");

/** A bare app hosting only chats, so the chat view is tested on its own. */
const registry = createLayoutRegistry({
  kinds: CORE_KINDS,
  views: CHAT_VIEWS,
  apps: [
    defineApp({
      id: "lab",
      path: "/lab",
      label: "Lab",
      description: "",
      icon: List,
      group: "System",
      views: ["chat"],
      primaryKind: "agent",
      layout: { presenter: "tabs", accepts: ["agent"], primary: true },
    }),
  ],
});

const agent = (id: string, displayName: string, idle = true): Agent => ({
  id,
  displayName,
  agentType: "code",
  idle,
  currentActivity: idle ? "" : "Thinking",
  createdAt: 1,
});

describe("chat view", () => {
  beforeEach(() => {
    agents = [agent("agent-1", "Code Engineer")];
    checkpoints = [];
    clearChatMessages.mockClear();
    launchAgentFromCheckpoint.mockClear();
  });

  it("titles its tab with the session and carries the agent's controls", async () => {
    agents = [agent("agent-1", "Code Engineer", false)];
    renderLayoutApp({ registry, url: "/lab/agent/agent-1" });
    await waitFor(() => expect(screen.getByRole("tab", { name: /^Code Engineer/ })).toBeInTheDocument());
    const header = screen.getByTestId("chat-header");
    expect(within(header).getByText("model for agent-1")).toBeInTheDocument();
    expect(within(header).getByText("tools for agent-1")).toBeInTheDocument();
    expect(within(header).getByText("Working")).toBeInTheDocument();
  });

  it("clears the transcript through clearChatMessages", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/lab/agent/agent-1" });
    // The chat area's ⋯ menu is the agent's one menu.
    const area = screen.getByTestId("chat-header").closest("section")!;
    fireEvent.keyDown(within(area as HTMLElement).getByRole("button", { name: "Container options" }), { key: "Enter" });
    const menu = within(await screen.findByRole("menu"));
    expect(menu.getByRole("menuitem", { name: "Branch into a new agent" })).toBeInTheDocument();
    expect(menu.getByRole("menuitem", { name: "Download as Markdown" })).toBeInTheDocument();
    fireEvent.click(menu.getByRole("menuitem", { name: /Clear transcript/ }));
    // Destructive, so it asks first.
    expect(clearChatMessages).not.toHaveBeenCalled();
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Clear" }));
    await waitFor(() => expect(clearChatMessages).toHaveBeenCalledWith({ agentId: "agent-1" }));
  });

  it("shows ChatPanel's background-completion badge on the tab", async () => {
    const user = userEvent.setup();
    renderLayoutApp({ registry, url: "/lab/agent/agent-1" });
    await user.click(screen.getByRole("button", { name: "finish in background" }));
    expect(within(screen.getByRole("tab", { name: /^Code Engineer/ })).getByRole("img", { name: "Task finished — open to view" })).toBeInTheDocument();
  });

  it("says the session can't be restored when the agent is gone without checkpoints", () => {
    renderLayoutApp({ registry, url: "/lab/agent/dead-agent" });
    expect(screen.getByText("Agent is no longer running")).toBeInTheDocument();
    expect(screen.getByText("No checkpoints were saved for this session, so it can't be restored.")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Clear transcript" })).toBeNull();
    expect(screen.getByRole("tab", { name: /^Chat · dead-agent/ })).toBeInTheDocument();
  });

  it("restoring a deleted agent replaces its chat with the restored one", async () => {
    const user = userEvent.setup();
    checkpoints = [{ id: 7, name: "Before the crash", agentId: "dead-agent", createdAt: 1000 }];
    const app = renderLayoutApp({ registry, url: "/lab/agent/dead-agent" });
    expect(screen.getByText("Restore it from a checkpoint above, or close this panel.")).toBeInTheDocument();

    agents = [...agents, agent("agent-restored", "Restored")];
    await user.click(screen.getByRole("button", { name: "Restore agent from checkpoint: Before the crash" }));

    await waitFor(() => expect(app.location().pathname).toBe("/lab/agent/agent-restored"));
    expect(launchAgentFromCheckpoint).toHaveBeenCalledWith({ checkpointId: 7 });
    expect(screen.queryByRole("tab", { name: /dead-agent/ })).toBeNull();
    expect(screen.getByTestId("chat-panel:agent-restored")).toBeInTheDocument();
  });
});
