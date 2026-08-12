import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ConversationRow, { type ConversationRowData, type ConversationRowProps } from "./ConversationRow.tsx";

const baseConversation: ConversationRowData = {
  key: "slack:C-eng",
  channelName: "engineering",
  conversationId: "C-eng",
  service: "slack",
  busy: false,
  lastActivityAt: Date.now() - 5 * 60_000,
  agentId: "agent-1",
  agentType: "assistant",
};

function renderRow(overrides: Partial<ConversationRowProps> = {}) {
  const onOpenAgent = mock(() => {});
  const onMessage = mock(() => {});
  const props: ConversationRowProps = {
    conversation: baseConversation,
    connected: true,
    onOpenAgent,
    onMessage,
    ...overrides,
  };
  const result = render(<ConversationRow {...props} />);
  return { ...result, onOpenAgent, onMessage, props };
}

describe("ConversationRow", () => {
  it("renders channel name, conversation id, service, and agent type", () => {
    renderRow();

    expect(screen.getByText("engineering")).toBeInTheDocument();
    expect(screen.getByText("C-eng")).toBeInTheDocument();
    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("assistant")).toBeInTheDocument();
    expect(screen.getByText(/Active/)).toBeInTheDocument();
  });

  it("shows Direct when there is no channel name", () => {
    renderRow({
      conversation: {
        ...baseConversation,
        channelName: undefined,
        conversationId: "U-user",
        key: "slack:U-user",
      },
    });

    expect(screen.getByText("U-user")).toBeInTheDocument();
    expect(screen.getByText("Direct")).toBeInTheDocument();
  });

  it("shows Working badge when busy", () => {
    renderRow({ conversation: { ...baseConversation, busy: true } });

    expect(screen.getByText("Working")).toBeInTheDocument();
  });

  it("shows bot display name when provided", () => {
    renderRow({
      conversation: { ...baseConversation, botDisplayName: "Helper" },
    });

    expect(screen.getByText("Helper")).toBeInTheDocument();
  });

  it("omits bot display name when not provided", () => {
    renderRow();

    expect(screen.queryByText("Helper")).not.toBeInTheDocument();
  });

  it("shows Started time when startedAt is provided", () => {
    renderRow({
      conversation: {
        ...baseConversation,
        startedAt: Date.now() - 2 * 3_600_000,
      },
    });

    expect(screen.getByText(/Started/)).toBeInTheDocument();
  });

  it("omits Started time when startedAt is omitted", () => {
    renderRow();

    expect(screen.queryByText(/Started/)).not.toBeInTheDocument();
  });

  it("shows Started with em dash when startedAt is null", () => {
    renderRow({
      conversation: { ...baseConversation, startedAt: null },
    });

    expect(screen.getByText(/Started/)).toBeInTheDocument();
    expect(screen.getByText(/Started —/)).toBeInTheDocument();
  });

  it("invokes onOpenAgent and onMessage", async () => {
    const { onOpenAgent, onMessage } = renderRow();

    await userEvent.click(screen.getByRole("button", { name: /agent/i }));
    await userEvent.click(screen.getByRole("button", { name: /message/i }));

    expect(onOpenAgent).toHaveBeenCalledTimes(1);
    expect(onMessage).toHaveBeenCalledTimes(1);
  });

  it("disables Message when disconnected", () => {
    renderRow({ connected: false });

    expect(screen.getByRole("button", { name: /message/i })).toBeDisabled();
  });

  it("omits Reset when onReset is not provided", () => {
    renderRow();

    expect(screen.queryByRole("button", { name: /reset/i })).not.toBeInTheDocument();
  });

  it("shows Reset and invokes onReset when provided", async () => {
    const onReset = mock(() => {});
    renderRow({ onReset });

    const reset = screen.getByRole("button", { name: /reset/i });
    await userEvent.click(reset);

    expect(onReset).toHaveBeenCalledTimes(1);
  });

  it("disables Reset while busyAction matches reset key", () => {
    renderRow({
      onReset: () => {},
      busyAction: `reset:${baseConversation.key}`,
    });

    expect(screen.getByRole("button", { name: /reset/i })).toBeDisabled();
  });
});
