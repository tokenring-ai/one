import { describe, expect, it } from "bun:test";
import { fireEvent, render, screen } from "@testing-library/react";
import type { AgentEventEnvelope } from "@tokenring-ai/agent/AgentEvents";
import ToolCallDisplay from "./ToolCallDisplay.tsx";

function makeToolCall(overrides: Partial<Extract<AgentEventEnvelope, { type: "toolCall" }>> = {}): Extract<AgentEventEnvelope, { type: "toolCall" }> {
  return {
    type: "toolCall",
    timestamp: Date.now(),
    name: "ReadFile",
    args: { path: "/tmp/a.txt", limit: 5 },
    message: "**File** Read a.txt",
    failed: false,
    result: "file contents here",
    ...overrides,
  };
}

describe("ToolCallDisplay", () => {
  it("shows the summary and reveals arguments on expand", () => {
    const { container } = render(<ToolCallDisplay msg={makeToolCall()} />);
    expect(screen.getByText("Read a.txt")).not.toBeNull();

    // Args are hidden until expanded.
    expect(screen.queryByText("ReadFile arguments")).toBeNull();
    fireEvent.click(container.querySelector("button")!);

    expect(screen.getByText("ReadFile arguments")).not.toBeNull();
    expect(screen.getByText("Path")).not.toBeNull();
    expect(screen.getByText("/tmp/a.txt")).not.toBeNull();
    expect(screen.getByText("Limit")).not.toBeNull();
    expect(screen.getByText("5")).not.toBeNull();
  });

  it("marks failed tool calls with a badge", () => {
    render(<ToolCallDisplay msg={makeToolCall({ failed: true })} />);
    expect(screen.getByText("Failed")).not.toBeNull();
  });

  it("does not mark successful tool calls as failed", () => {
    render(<ToolCallDisplay msg={makeToolCall()} />);
    expect(screen.queryByText("Failed")).toBeNull();
  });

  it("lists tool-call attachments", () => {
    render(
      <ToolCallDisplay
        msg={makeToolCall({
          attachments: [{ name: "output.txt", encoding: "text", mimeType: "text/plain", body: "data", sendToLLM: true }],
        })}
      />,
    );
    expect(screen.getByText(/1 attachment/)).not.toBeNull();
  });

  it("collapses long argument values behind a toggle", () => {
    const long = "x".repeat(300);
    const { container } = render(<ToolCallDisplay msg={makeToolCall({ args: { body: long } })} />);
    fireEvent.click(container.querySelector("button")!);
    expect(screen.getByText("Show 300 chars")).not.toBeNull();
    expect(screen.queryByText(long)).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Show 300 chars" }));
    expect(screen.getByText(long)).not.toBeNull();
  });
});
