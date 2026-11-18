import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChatMessage } from "../../../types/agent-events.ts";
import MessageComponent from "./MessageComponent.tsx";

const userMessage = (from: string) =>
  ({
    type: "input.received",
    requestId: "r1",
    timestamp: Date.UTC(2026, 10, 13, 5, 39, 3),
    input: {
      from,
      message: "hi",
      attachments: [{ name: "Relevant Memories", encoding: "text", mimeType: "text/markdown", body: "- remembered" }],
    },
  }) as unknown as ChatMessage;

describe("MessageComponent: a message you sent", () => {
  it("names you rather than the web chat, with attachments as chips that open a preview", async () => {
    const user = userEvent.setup();
    render(<MessageComponent msg={userMessage("Chat webapp user")} agentId="a" />);
    expect(screen.getByRole("article", { name: "Message from You" })).toHaveTextContent("hi");
    expect(screen.queryByText(/Chat webapp user/)).toBeNull();
    expect(screen.queryByText("Attachments")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Preview attachment Relevant Memories" }));
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveTextContent("remembered");
    // Copy and download live in the preview now.
    expect(screen.getByRole("button", { name: "Download Relevant Memories" })).toBeInTheDocument();
  });

  it("names any other sender", () => {
    render(<MessageComponent msg={userMessage("Release workflow")} agentId="a" />);
    expect(screen.getByRole("article", { name: "Message from Release workflow" })).toBeInTheDocument();
  });

  it("offers edit and branch", async () => {
    const user = userEvent.setup();
    const onEdit = mock();
    const onBranch = mock();
    render(<MessageComponent msg={userMessage("Chat webapp user")} agentId="a" onEdit={onEdit} onBranch={onBranch} />);
    await user.click(screen.getByRole("button", { name: "Branch from before this message" }));
    await user.click(screen.getByRole("button", { name: "Edit and resend message" }));
    expect(onBranch).toHaveBeenCalledTimes(1);
    expect(onEdit).toHaveBeenCalledTimes(1);
  });
});

describe("MessageComponent: session events", () => {
  it("says what happened in plain words, keeping the backend wording in the tooltip", () => {
    const created = {
      type: "agent.created",
      message: "Recovered agent of type: code from checkpoint of agent every-to",
      timestamp: 1,
    } as unknown as ChatMessage;
    render(<MessageComponent msg={created} agentId="a" />);
    const band = screen.getByRole("note");
    expect(band).toHaveTextContent("Relaunched from a checkpoint");
    expect(band).not.toHaveTextContent("every-to");
    expect(band.getAttribute("title")).toContain("every-to");
  });

  it("names the agent type that started", () => {
    const created = { type: "agent.created", message: "Agent created from config: Coding Agent (code)", timestamp: 1 } as unknown as ChatMessage;
    render(<MessageComponent msg={created} agentId="a" />);
    expect(screen.getByRole("note")).toHaveTextContent("Coding Agent started");
  });
});

describe("MessageComponent: a finished reply", () => {
  it("can branch from the conversation as it stands after it", async () => {
    const user = userEvent.setup();
    const onBranch = mock();
    const reply = { type: "agent.response", requestId: "r1", status: "success", message: "Done.", timestamp: 1 } as unknown as ChatMessage;
    render(<MessageComponent msg={reply} agentId="a" onBranch={onBranch} />);
    await user.click(screen.getByRole("button", { name: "Branch from here" }));
    expect(onBranch).toHaveBeenCalledTimes(1);
  });

  it("shows the chat command's token status as a quiet end-of-turn line, not a chat message", async () => {
    const user = userEvent.setup();
    const onBranch = mock();
    const reply = {
      type: "agent.response",
      requestId: "r1",
      status: "success",
      message: "Response Complete [Tokens in: 5,790, out: 207, total: 5,997]",
      timestamp: 1,
    } as unknown as ChatMessage;
    render(<MessageComponent msg={reply} agentId="a" onBranch={onBranch} />);
    const line = screen.getByRole("note", { name: "Turn finished" });
    expect(line).toHaveTextContent("5,997 tokens");
    expect(screen.queryByText(/Response Complete/)).toBeNull();
    await user.click(screen.getByRole("button", { name: "Branch from here" }));
    expect(onBranch).toHaveBeenCalledTimes(1);
  });
});
