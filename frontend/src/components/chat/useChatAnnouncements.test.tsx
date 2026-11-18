import { describe, expect, it } from "bun:test";
import { act, render, screen } from "@testing-library/react";
import { useAnnouncer } from "../../hooks/useAnnouncer.tsx";
import type { ChatMessage, QuestionPromptMessage } from "../../types/agent-events.ts";
import { useChatAnnouncements } from "./useChatAnnouncements.ts";

interface State {
  messages: ChatMessage[];
  busy: boolean;
  questions: QuestionPromptMessage[];
  attending: boolean;
  known: boolean;
}

const spoken: string[] = [];

function Harness(props: State) {
  const { announce, region } = useAnnouncer();
  useChatAnnouncements({
    announce: message => {
      spoken.push(message);
      announce(message);
    },
    agentName: "Coder",
    ...props,
  });
  return region;
}

const idle: State = { messages: [], busy: false, questions: [], attending: true, known: true };
let NOW = Date.now();
const msg = (partial: Record<string, unknown>) => ({ timestamp: NOW, ...partial }) as unknown as ChatMessage;
const wait = (ms: number) => act(() => new Promise<void>(resolve => setTimeout(resolve, ms)));

function setup(initial: Partial<State> = {}) {
  spoken.length = 0;
  NOW = Date.now();
  const view = render(<Harness {...idle} {...initial} />);
  return { update: (next: Partial<State>) => view.rerender(<Harness {...idle} {...initial} {...next} />) };
}

const approval = (id: string, text = "Run `rm -rf build`?") =>
  ({
    type: "question",
    requestId: "r1",
    interactionId: id,
    timestamp: Date.now(),
    message: text,
    question: {
      type: "treeSelect",
      label: "Approve ?",
      tree: [
        { name: "Yes", value: "Approved" },
        { name: "No", value: "Not approved" },
      ],
    },
  }) as unknown as QuestionPromptMessage;

describe("chat announcements", () => {
  it("says a turn is working once, after a short delay", async () => {
    const { update } = setup();
    update({ busy: true });
    expect(spoken).toEqual([]);
    await wait(800);
    expect(spoken).toEqual(["Coder is working"]);
    update({ busy: true, messages: [msg({ type: "output.chat", message: "hi" })] });
    await wait(800);
    expect(spoken).toEqual(["Coder is working"]);
  });

  it("does not announce a turn that was already running when the chat opened", async () => {
    const { update } = setup({ busy: true });
    update({ busy: true });
    await wait(800);
    expect(spoken).toEqual([]);
  });

  it("stays silent while output streams", async () => {
    const { update } = setup({ busy: true });
    for (const text of ["He", "Hello", "Hello wor", "Hello world"])
      update({ busy: true, messages: [msg({ type: "output.chat", message: text, timestamp: 5 })] });
    await wait(50);
    expect(spoken).toEqual([]);
    expect(screen.getByRole("status")).toHaveTextContent("");
  });

  it("announces the turn finishing exactly once, even across re-renders", () => {
    const { update } = setup({ busy: true });
    const done = [msg({ type: "agent.response", requestId: "r1", status: "success", message: "All done" })];
    update({ busy: false, messages: done });
    update({ busy: false, messages: [...done] });
    update({ busy: false, messages: [...done, msg({ type: "output.info", message: "x" })] });
    expect(spoken).toEqual(["Coder finished"]);
    expect(screen.getByRole("status")).toHaveTextContent("Coder finished");
  });

  it("does not announce 'working' for a turn that ends inside the delay", async () => {
    const { update } = setup();
    update({ busy: true });
    update({ busy: false, messages: [msg({ type: "agent.response", requestId: "r1", status: "success", message: "ok" })] });
    await wait(800);
    expect(spoken).toEqual(["Coder finished"]);
  });

  it("announces failures and cancellations", () => {
    const { update } = setup();
    update({ messages: [msg({ type: "agent.response", requestId: "r1", status: "error", message: "Rate limited" })] });
    update({
      messages: [
        msg({ type: "agent.response", requestId: "r1", status: "error", message: "Rate limited" }),
        msg({ type: "agent.response", requestId: "r2", status: "cancelled" }),
      ],
    });
    expect(spoken).toEqual(["Coder failed: Rate limited", "Coder was cancelled"]);
  });

  it("announces a batch of tool calls once, when something other than a tool call follows", () => {
    const { update } = setup({ busy: true });
    const tool = (n: number) => msg({ type: "toolCall", name: "read", timestamp: NOW + n, message: "**File** read" });
    update({ busy: true, messages: [tool(1)] });
    update({ busy: true, messages: [tool(1), tool(2)] });
    expect(spoken).toEqual([]);
    update({ busy: true, messages: [tool(1), tool(2), msg({ type: "output.chat", message: "Found it", timestamp: NOW + 3 })] });
    update({ busy: true, messages: [tool(1), tool(2), msg({ type: "output.chat", message: "Found it, here", timestamp: NOW + 3 })] });
    expect(spoken).toEqual(["2 tool calls finished"]);
  });

  it("folds tool calls into 'finished' when the turn ends right after them", () => {
    const { update } = setup({ busy: true });
    const tool = msg({ type: "toolCall", name: "read", message: "**File** read" });
    update({ busy: true, messages: [tool] });
    update({ busy: false, messages: [tool, msg({ type: "agent.response", requestId: "r1", status: "success", message: "ok", timestamp: NOW + 1 })] });
    expect(spoken).toEqual(["Coder finished"]);
  });

  it("announces an arriving question once, with the agent and the question", () => {
    const { update } = setup();
    const question = approval("i1");
    update({ questions: [question] });
    update({ questions: [{ ...question }] });
    expect(spoken).toEqual(["Approval needed from Coder: Run rm -rf build?"]);
    update({ questions: [question, { ...approval("i2", "Which **branch**?"), question: { type: "text" } } as unknown as QuestionPromptMessage] });
    expect(spoken[1]).toBe("Coder is asking a question: Which branch?");
  });

  it("says nothing about a chat that is not being looked at, except a blocking question", async () => {
    const { update } = setup({ attending: false });
    update({ attending: false, busy: true });
    await wait(800);
    update({ attending: false, busy: false, messages: [msg({ type: "agent.response", requestId: "r1", status: "success", message: "ok" })] });
    expect(spoken).toEqual([]);
    update({ attending: false, busy: false, questions: [approval("i1")] });
    expect(spoken).toHaveLength(1);
    expect(spoken[0]).toContain("Approval needed");
  });

  it("re-announces an identical message in the live region", () => {
    const { update } = setup();
    update({ messages: [msg({ type: "agent.response", requestId: "r1", status: "success", message: "ok" })] });
    const first = screen.getByRole("status").firstElementChild;
    update({
      messages: [
        msg({ type: "agent.response", requestId: "r1", status: "success", message: "ok" }),
        msg({ type: "agent.response", requestId: "r2", status: "success", message: "ok" }),
      ],
    });
    expect(spoken).toEqual(["Coder finished", "Coder finished"]);
    expect(screen.getByRole("status").firstElementChild).not.toBe(first);
  });

  it("ignores history streamed in when the chat opens", () => {
    const old = msg({ type: "agent.response", requestId: "r0", status: "success", message: "old", timestamp: Date.now() - 60_000 });
    setup({ messages: [old] });
    expect(spoken).toEqual([]);
  });
});
