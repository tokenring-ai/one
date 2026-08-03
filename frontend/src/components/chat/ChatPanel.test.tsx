import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { ChatInputProvider } from "../ChatInputContext.tsx";
import ChatPanel from "./ChatPanel.tsx";

const sendInputMock = mock();
const useAgentEventStateMock = mock(() => ({
  messages: [],
  agentStatus: { status: "running", inputExecutionQueue: [], currentActivity: "" },
  currentExecutionState: null,
  isConnecting: false,
  connectionError: null,
  reconnectAttempts: 0,
  agentNotFound: false,
  manualReconnect: mock(),
}));

void mock.module("../../hooks/useAgentEventState.ts", () => ({
  useAgentEventState: useAgentEventStateMock,
}));

void mock.module("../../rpc.ts", () => ({
  agentRPCClient: {
    sendInput: sendInputMock,
  },
  useAvailableCommands: mock(() => ({ data: [] })),
  useCommandHistory: mock(() => ({ data: [], mutate: mock() })),
  useCheckpointList: mock(() => ({ data: [], isLoading: false })),
  useAgentList: mock(() => ({ data: [], mutate: mock() })),
  checkpointRPCClient: {
    launchAgentFromCheckpoint: mock(),
  },
}));

void mock.module("./AutoScrollContainer.tsx", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
void mock.module("./MessageList.tsx", () => ({ default: () => null }));
void mock.module("./PendingQuestions.tsx", () => ({ default: () => null }));
void mock.module("./ConnectionStatusBanner.tsx", () => ({ default: () => null }));
void mock.module("./DeletedAgentRestorePanel.tsx", () => ({ default: () => null }));
void mock.module("../overlay/file-browser.tsx", () => ({ default: () => null }));
void mock.module("../HookSelector.tsx", () => ({ default: () => null }));
void mock.module("../ModelSelector.tsx", () => ({ default: () => null }));
void mock.module("../SkillSelector.tsx", () => ({ default: () => null }));
void mock.module("../ToolApprovalSelector.tsx", () => ({ default: () => null }));
void mock.module("../ToolSelector.tsx", () => ({ default: () => null }));
void mock.module("../ui/toast.tsx", () => ({
  toastManager: {
    error: mock(),
    warning: mock(),
    success: mock(),
    info: mock(),
  },
}));

function renderChatPanel(agentId = "test-agent") {
  return render(
    <MemoryRouter>
      <ChatInputProvider>
        <ChatPanel agentId={agentId} />
      </ChatInputProvider>
    </MemoryRouter>,
  );
}

describe("ChatPanel", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    useAgentEventStateMock.mockReturnValue({
      messages: [],
      agentStatus: { status: "running", inputExecutionQueue: [], currentActivity: "" },
      currentExecutionState: null,
      isConnecting: false,
      connectionError: null,
      reconnectAttempts: 0,
      agentNotFound: false,
      manualReconnect: mock(),
    });
  });

  it("restores input when send fails", async () => {
    const user = userEvent.setup();
    sendInputMock.mockRejectedValueOnce(new Error("Network error"));

    renderChatPanel();

    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "hello world");
    await user.click(screen.getByRole("button", { name: "Send message" }));

    await waitFor(() => {
      expect(input).toHaveValue("hello world");
    });
    expect(sendInputMock).toHaveBeenCalledWith({
      agentId: "test-agent",
      input: {
        from: "Chat webapp user",
        message: "hello world",
      },
    });
  });

  it("shows dock controls only when a dock mode is supplied", async () => {
    const user = userEvent.setup();
    const onDockModeChange = mock();
    const onClose = mock();

    const { rerender } = renderChatPanel();
    expect(screen.queryByRole("button", { name: "Dock to the right" })).toBeNull();

    rerender(
      <MemoryRouter>
        <ChatInputProvider>
          <ChatPanel agentId="test-agent" dockMode="bottom" onDockModeChange={onDockModeChange} onClose={onClose} />
        </ChatInputProvider>
      </MemoryRouter>,
    );

    expect(screen.getByRole("button", { name: "Dock to the bottom" }).getAttribute("aria-pressed")).toBe("true");

    await user.click(screen.getByRole("button", { name: "Dock to the right" }));
    expect(onDockModeChange).toHaveBeenCalledWith("right");

    await user.click(screen.getByRole("button", { name: "Close chat" }));
    expect(onClose).toHaveBeenCalled();
  });

  it("shows agent no longer running when agent is not found", () => {
    useAgentEventStateMock.mockReturnValue({
      messages: [],
      agentStatus: { status: "running", inputExecutionQueue: [], currentActivity: "" },
      currentExecutionState: null,
      isConnecting: false,
      connectionError: null,
      reconnectAttempts: 0,
      agentNotFound: true,
      manualReconnect: mock(),
    });

    renderChatPanel("deleted-agent");

    expect(screen.getByRole("heading", { name: "Agent No Longer Running" })).toBeTruthy();
    expect(screen.getByText(/deleted-agent/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Browse Available Agents" })).toBeTruthy();
  });
});
