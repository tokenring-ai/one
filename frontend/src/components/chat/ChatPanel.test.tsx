import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { MemoryRouter } from "react-router-dom";
import { ChatInputProvider } from "../ChatInputContext.tsx";
import ChatPanel, { type ChatBadge } from "./ChatPanel.tsx";

const sendInputMock = mock();
const toastMock = { error: mock(), warning: mock(), success: mock(), info: mock() };
/** What the delivery tracker reports for a failed send: could the request have reached the server? */
let deliveryMayHaveBeenSent = false;
const connectionStatus = { isOnline: true };
let messageListProps: { onRetryInput?: (requestId: string) => Promise<void> } = {};
const useAgentEventStateMock = mock(
  (): {
    messages: unknown[];
    agentStatus: { status: string; inputExecutionQueue: string[]; currentActivity: string };
    currentExecutionState: null;
    isConnecting: boolean;
    connectionError: null;
    reconnectAttempts: number;
    agentNotFound: boolean;
    manualReconnect: () => void;
  } => ({
    messages: [],
    agentStatus: { status: "running", inputExecutionQueue: [], currentActivity: "" },
    currentExecutionState: null,
    isConnecting: false,
    connectionError: null,
    reconnectAttempts: 0,
    agentNotFound: false,
    manualReconnect: mock(),
  }),
);
const useAgentCheckpointListMock = mock(
  (): {
    data: { items: unknown[]; total: number; hasMore: boolean; limit: number; offset: number } | undefined;
    error: Error | undefined;
    isLoading: boolean;
    mutate: () => Promise<unknown>;
  } => ({ data: { items: [], total: 0, hasMore: false, limit: 200, offset: 0 }, error: undefined, isLoading: false, mutate: mock(() => Promise.resolve()) }),
);

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
  useAgentCheckpointList: useAgentCheckpointListMock,
  useAgentList: mock(() => ({ data: [], mutate: mock() })),
  checkpointRPCClient: {
    launchAgentFromCheckpoint: mock(),
  },
}));

void mock.module("./AutoScrollContainer.tsx", () => ({
  default: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
void mock.module("./MessageList.tsx", () => ({
  default: (props: typeof messageListProps) => {
    messageListProps = props;
    return null;
  },
}));
void mock.module("../../hooks/useConnectionStatus.ts", () => ({
  useConnectionStatus: () => ({ ...connectionStatus }),
}));
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
  toastManager: toastMock,
  notificationManager: { add: mock() },
}));
void mock.module("../../features/chat/trackDelivery.ts", () => ({
  trackDelivery: async (call: () => Promise<unknown>) => {
    try {
      return { ok: true, value: await call() };
    } catch (error) {
      return { ok: false, error, mayHaveBeenSent: deliveryMayHaveBeenSent };
    }
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

/** The latest badge each panel asked its host to show (the host owns the tab). */
const badges = new Map<string, ChatBadge | null>();
const getPanelBadge = (panelId: string) => badges.get(panelId) ?? null;
const badgeSinks = new Map<string, (badge: ChatBadge | null) => void>();
function badgeSink(panelId: string) {
  let sink = badgeSinks.get(panelId);
  if (!sink) {
    sink = badge => badges.set(panelId, badge);
    badgeSinks.set(panelId, sink);
  }
  return sink;
}

function panelTree(show: boolean, agentId = "test-agent", panel?: { panelId: string; isVisible: boolean; isActive: boolean }) {
  return (
    <MemoryRouter>
      <ChatInputProvider>{show && <ChatPanel agentId={agentId} {...(panel && { panel, onBadgeChange: badgeSink(panel.panelId) })} />}</ChatInputProvider>
    </MemoryRouter>
  );
}

function idleState(messages: unknown[] = []) {
  return {
    messages,
    agentStatus: { status: "running", inputExecutionQueue: [], currentActivity: "" },
    currentExecutionState: null,
    isConnecting: false,
    connectionError: null,
    reconnectAttempts: 0,
    agentNotFound: false,
    manualReconnect: mock(),
  };
}

describe("ChatPanel", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    sendInputMock.mockReset();
    sendInputMock.mockResolvedValue({ status: "success", requestId: "r1" });
    connectionStatus.isOnline = true;
    messageListProps = {};
    try {
      localStorage.clear();
    } catch {
      // storage unavailable in this environment
    }
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
    useAgentCheckpointListMock.mockReturnValue({
      data: { items: [], total: 0, hasMore: false, limit: 200, offset: 0 },
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
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

  it("sends (queues) input while the agent is busy instead of dropping it", async () => {
    const user = userEvent.setup();
    useAgentEventStateMock.mockReturnValue({
      messages: [
        {
          type: "input.received",
          timestamp: Date.now(),
          requestId: "req-busy",
          input: { from: "User", message: "original task" },
        },
      ],
      agentStatus: { status: "running", inputExecutionQueue: ["req-busy"], currentActivity: "Working" },
      currentExecutionState: null,
      isConnecting: false,
      connectionError: null,
      reconnectAttempts: 0,
      agentNotFound: false,
      manualReconnect: mock(),
    });

    renderChatPanel("queued-agent");

    const input = screen.getByRole("textbox", { name: "Command or message input" });
    expect(input).not.toBeDisabled();
    await user.type(input, "one more thing");
    await user.click(screen.getByRole("button", { name: "Queue message" }));

    await waitFor(() => {
      expect(sendInputMock).toHaveBeenCalledWith({
        agentId: "queued-agent",
        input: {
          from: "Chat webapp user",
          message: "one more thing",
        },
      });
    });
  });

  it("shows an inline not-found notice when agent is not found", () => {
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

    expect(screen.getByText(/no longer running/i)).toBeTruthy();
    expect(screen.getByText(/deleted-agent/)).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Browse Available Agents" })).toBeNull();
  });

  it("tells the truth about whether the session can be restored", () => {
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

    // Checkpoints exist: the notice points at the restore controls.
    useAgentCheckpointListMock.mockReturnValue({
      data: { items: [{ id: 3, name: "Saved", agentId: "deleted-agent", createdAt: 1000 }], total: 1, hasMore: false, limit: 200, offset: 0 },
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
    const { unmount } = renderChatPanel("deleted-agent");
    expect(screen.getByText(/Restore it from a checkpoint above\./)).toBeTruthy();
    unmount();

    // No checkpoints: the notice must not promise a restore that isn't there.
    useAgentCheckpointListMock.mockReturnValue({
      data: { items: [], total: 0, hasMore: false, limit: 200, offset: 0 },
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
    renderChatPanel("deleted-agent");
    expect(screen.getByText(/No checkpoints were saved for this session, so it can't be restored\./)).toBeTruthy();
  });
});

describe("ChatPanel send outcomes", () => {
  const oldTurn = { type: "input.received", timestamp: 1, requestId: "req-old", input: { from: "User", message: "old message" } };

  beforeEach(() => {
    mock.clearAllMocks();
    sendInputMock.mockReset();
    sendInputMock.mockResolvedValue({ status: "success", requestId: "r1" });
    connectionStatus.isOnline = true;
    deliveryMayHaveBeenSent = false;
    messageListProps = {};
    try {
      localStorage.clear();
    } catch {
      // storage unavailable in this environment
    }
    useAgentEventStateMock.mockReturnValue(idleState([oldTurn]));
  });

  it("still sends a held message on reconnect when the user typed something else meanwhile", async () => {
    const user = userEvent.setup();
    connectionStatus.isOnline = false;
    let rejectFirst: (error: Error) => void = () => {};
    sendInputMock.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)));
    const { rerender } = render(panelTree(true));
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "held message{Enter}");
    // While the send hangs, the user starts on something else.
    await user.type(input, "new draft");
    await act(async () => rejectFirst(new Error("socket closed")));
    await waitFor(() => expect(screen.getByText("Offline — will send when reconnected")).not.toBeNull());
    expect(input).toHaveValue("new draft");

    connectionStatus.isOnline = true;
    rerender(panelTree(true));

    await waitFor(() => expect(sendInputMock).toHaveBeenCalledTimes(2));
    expect(sendInputMock).toHaveBeenLastCalledWith({ agentId: "test-agent", input: { from: "Chat webapp user", message: "held message" } });
    // The newer draft is left alone.
    expect(input).toHaveValue("new draft");
  });

  it("tells the user instead of silently dropping a held draft they edited", async () => {
    const user = userEvent.setup();
    connectionStatus.isOnline = false;
    sendInputMock.mockRejectedValueOnce(new Error("socket closed"));
    const { rerender } = render(panelTree(true));
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "hello{Enter}");
    await waitFor(() => expect(input).toHaveValue("hello"));
    await user.type(input, " world");

    connectionStatus.isOnline = true;
    rerender(panelTree(true));

    await waitFor(() => expect(toastMock.info).toHaveBeenCalledWith(expect.stringContaining("wasn't sent because you edited it"), expect.anything()));
    expect(sendInputMock).toHaveBeenCalledTimes(1);
    expect(input).toHaveValue("hello world");
  });

  it("does not resend a message that may already have been delivered", async () => {
    const user = userEvent.setup();
    connectionStatus.isOnline = false;
    deliveryMayHaveBeenSent = true;
    sendInputMock.mockRejectedValueOnce(new Error("WebSocket closed"));
    const { rerender } = render(panelTree(true));
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "deploy{Enter}");

    await waitFor(() => expect(screen.getByText("May not have been sent")).not.toBeNull());
    expect(toastMock.warning).toHaveBeenCalledWith(expect.stringContaining("may or may not have been delivered"), expect.anything());
    // Handed back to the user rather than held for an automatic resend.
    expect(input).toHaveValue("deploy");

    connectionStatus.isOnline = true;
    rerender(panelTree(true));
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });
    expect(sendInputMock).toHaveBeenCalledTimes(1);
  });

  it("puts a failed message back above text typed while it was sending", async () => {
    const user = userEvent.setup();
    let rejectFirst: (error: Error) => void = () => {};
    sendInputMock.mockImplementationOnce(() => new Promise((_resolve, reject) => (rejectFirst = reject)));
    renderChatPanel();
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "first{Enter}");
    await user.type(input, "second");
    await act(async () => rejectFirst(new Error("Server error")));

    await waitFor(() => expect(input).toHaveValue("first\n\nsecond"));
  });

  it("retrying an old turn leaves the composer draft alone", async () => {
    const user = userEvent.setup();
    sendInputMock.mockResolvedValueOnce({ status: "success", requestId: "r1" });
    renderChatPanel();
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "unrelated draft");

    await act(async () => {
      await messageListProps.onRetryInput?.("req-old");
    });

    expect(sendInputMock).toHaveBeenCalledWith({ agentId: "test-agent", input: { from: "Chat webapp user", message: "old message" } });
    expect(input).toHaveValue("unrelated draft");
    expect(screen.getByText("Retried")).not.toBeNull();
  });

  it("does not claim a failed retry succeeded", async () => {
    sendInputMock.mockRejectedValueOnce(new Error("Network error"));
    renderChatPanel();

    await act(async () => {
      await messageListProps.onRetryInput?.("req-old");
    });

    expect(screen.queryByText("Retried")).toBeNull();
    expect(screen.getByText("Failed to send")).not.toBeNull();
  });

  it("does not show queued feedback when a busy-agent send fails", async () => {
    const user = userEvent.setup();
    useAgentEventStateMock.mockReturnValue({
      ...idleState([oldTurn]),
      agentStatus: { status: "running", inputExecutionQueue: ["req-old"], currentActivity: "Working" },
    });
    sendInputMock.mockRejectedValueOnce(new Error("Network error"));
    renderChatPanel();

    await user.type(screen.getByRole("textbox", { name: "Command or message input" }), "next");
    await user.click(screen.getByRole("button", { name: "Queue message" }));

    await waitFor(() => expect(screen.getByText("Failed to send")).not.toBeNull());
    expect(screen.queryByText("Queued behind current task")).toBeNull();
  });

  it("persists the restored draft so a remount keeps it", async () => {
    const user = userEvent.setup();
    sendInputMock.mockRejectedValueOnce(new Error("Network error"));
    const { rerender } = render(panelTree(true));
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "keep this");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(input).toHaveValue("keep this"));

    rerender(panelTree(false));
    rerender(panelTree(true));
    expect(screen.getByRole("textbox", { name: "Command or message input" })).toHaveValue("keep this");
  });

  it("retries an offline send on reconnect even when the draft ends in a newline", async () => {
    const user = userEvent.setup();
    connectionStatus.isOnline = false;
    sendInputMock.mockRejectedValueOnce(new Error("socket closed"));
    const { rerender } = render(panelTree(true));
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "hello{Shift>}{Enter}{/Shift}");
    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.getByText("Offline — will send when reconnected")).not.toBeNull());
    expect(input).toHaveValue("hello\n");

    sendInputMock.mockResolvedValueOnce({ status: "success", requestId: "r1" });
    connectionStatus.isOnline = true;
    rerender(panelTree(true));

    await waitFor(() => expect(sendInputMock).toHaveBeenCalledTimes(2));
    expect(sendInputMock).toHaveBeenLastCalledWith({ agentId: "test-agent", input: { from: "Chat webapp user", message: "hello" } });
    await waitFor(() => expect(screen.getByText("Sent after reconnect")).not.toBeNull());
    expect(input).toHaveValue("");
  });

  it("does not drop a quick second submit silently while the first is in flight", async () => {
    const user = userEvent.setup();
    let resolveFirst: () => void = () => {};
    sendInputMock.mockImplementationOnce(() => new Promise<void>(resolve => (resolveFirst = resolve)));
    renderChatPanel();
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    await user.type(input, "first{Enter}");
    await user.type(input, "second{Enter}");

    expect(sendInputMock).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Still sending the previous message")).not.toBeNull();
    // The second draft stays in the composer rather than vanishing.
    expect(input).toHaveValue("second");
    await act(async () => resolveFirst());
  });
});

describe("ChatPanel tab badges", () => {
  let documentHidden = false;

  beforeEach(() => {
    mock.clearAllMocks();
    documentHidden = false;
    Object.defineProperty(document, "hidden", { configurable: true, get: () => documentHidden });
    useAgentEventStateMock.mockReturnValue(idleState());
  });

  afterEach(() => {
    // Drop the instance override so the prototype getter applies again.
    delete (document as { hidden?: boolean }).hidden;
  });

  it("clears the badge when the browser tab returns while the panel is visible", () => {
    const panel = { panelId: "chat-badge-1", isVisible: true, isActive: true };
    const { rerender } = render(panelTree(true, "test-agent", panel));

    documentHidden = true;
    useAgentEventStateMock.mockReturnValue(idleState([{ type: "agent.response", requestId: "r1", timestamp: Date.now(), status: "success", message: "done" }]));
    rerender(panelTree(true, "test-agent", panel));
    expect(getPanelBadge("chat-badge-1")).not.toBeNull();

    documentHidden = false;
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(getPanelBadge("chat-badge-1")).toBeNull();
  });

  it("clears its badge on unmount", () => {
    const panel = { panelId: "chat-badge-2", isVisible: false, isActive: false };
    const { rerender } = render(panelTree(true, "test-agent", panel));
    badges.set("chat-badge-2", { label: "●" });

    rerender(panelTree(false, "test-agent", panel));
    expect(getPanelBadge("chat-badge-2")).toBeNull();
  });
});
