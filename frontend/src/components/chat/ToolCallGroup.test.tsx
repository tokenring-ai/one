import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChatMessage } from "../../types/agent-events.ts";
import { type DisplayItem, groupToolCalls } from "./MessageList.tsx";
import ToolCallGroup from "./ToolCallGroup.tsx";

type ToolCall = Extract<ChatMessage, { type: "toolCall" }>;
const call = (name: string, at: number, failed = false): ToolCall => ({
  type: "toolCall",
  timestamp: at,
  name,
  args: {},
  message: `ran ${name}`,
  failed,
  result: "",
});
const msg = (data: ChatMessage): DisplayItem => ({ type: "message", data });
const prose = { type: "output.chat", timestamp: 9, message: "done" } as unknown as ChatMessage;

describe("groupToolCalls", () => {
  it("folds runs of three or more tool calls, and only the run at the end is live while busy", () => {
    const items = [msg(call("a", 1)), msg(call("b", 2)), msg(call("c", 3)), msg(prose), msg(call("d", 4)), msg(call("e", 5)), msg(call("f", 6))];
    const grouped = groupToolCalls(items, true);
    expect(grouped.map(item => item.type)).toEqual(["tool-group", "message", "tool-group"]);
    expect(grouped[0]).toMatchObject({ live: false });
    expect(grouped[2]).toMatchObject({ live: true });
  });

  it("leaves short runs as they are", () => {
    const items = [msg(call("a", 1)), msg(call("b", 2)), msg(prose)];
    expect(groupToolCalls(items, false)).toEqual(items);
  });
});

describe("ToolCallGroup", () => {
  it("summarises a finished run collapsed, with failures, and expands on demand", async () => {
    const user = userEvent.setup();
    render(
      <ToolCallGroup calls={[call("read", 1), call("read", 2), call("write", 3, true)]} live={false} renderCall={c => <p key={c.timestamp}>{c.message}</p>} />,
    );
    const toggle = screen.getByRole("button", { name: /Ran 3 tools · 1 failed/ });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByText("ran write")).toBeNull();
    await user.click(toggle);
    expect(screen.getByText("ran write")).toBeInTheDocument();
  });
});
