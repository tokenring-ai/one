import { describe, expect, it, mock } from "bun:test";
import { cleanup, render, screen } from "@testing-library/react";
import type { QuestionInteraction } from "../../types/agent-events.ts";

void mock.module("../../rpc.ts", () => ({
  agentRPCClient: { sendInteractionResponse: mock() },
  filesystemRPCClient: { listDirectory: mock(() => Promise.resolve({ files: [] })) },
}));
void mock.module("../ui/toast.tsx", () => ({
  toastManager: { error: mock(), warning: mock(), success: mock(), info: mock() },
  notificationManager: { add: mock() },
}));

const { default: InlineQuestion } = await import("./InlineQuestion.tsx");

const text = {
  type: "question",
  interactionId: "i1",
  message: "Which **branch** should I use?",
  question: { type: "text", label: "Branch name", required: false, defaultValue: "", expectedLines: 1, masked: false },
} as unknown as QuestionInteraction;

const approvalRequest = {
  ...text,
  message: "Run `npm test`?",
  question: {
    type: "treeSelect",
    label: "Approve ?",
    tree: [
      { name: "Yes", value: "Approved" },
      { name: "No", value: "Not approved" },
    ],
    minimumSelections: 1,
    maximumSelections: 1,
    defaultValue: [],
  },
} as unknown as QuestionInteraction;

describe("InlineQuestion accessibility", () => {
  it("is a region named for the agent and the question", () => {
    render(<InlineQuestion request={text} agentId="a1" requestId="r1" agentName="Coder" autoScroll={false} />);
    expect(screen.getByRole("region", { name: "Coder: Question: Which branch should I use?" })).toBeInTheDocument();
  });

  it("takes focus when it appears (a text question focuses its own field)", () => {
    render(<InlineQuestion request={text} agentId="a1" requestId="r1" autoScroll={false} />);
    expect(screen.getByRole("textbox", { name: "Branch name" })).toHaveFocus();
    cleanup();
    render(<InlineQuestion request={approvalRequest} agentId="a1" requestId="r1" autoScroll={false} />);
    expect(screen.getByRole("region", { name: /Approval needed/ }).contains(document.activeElement)).toBe(true);
  });

  it("labels the answer field with the question's label", () => {
    render(<InlineQuestion request={text} agentId="a1" requestId="r1" autoScroll={false} />);
    expect(screen.getByRole("textbox", { name: "Branch name" })).toBeInTheDocument();
  });

  it("falls back to a name for an unlabelled text field", () => {
    const unlabeled = { ...text, question: { ...text.question, label: "" } } as unknown as QuestionInteraction;
    render(<InlineQuestion request={unlabeled} agentId="a1" requestId="r1" autoScroll={false} />);
    expect(screen.getByRole("textbox", { name: "Your answer" })).toBeInTheDocument();
  });

  it("names an approval as one", () => {
    render(<InlineQuestion request={approvalRequest} agentId="a1" requestId="r1" agentName="Coder" autoScroll={false} />);
    expect(screen.getByRole("region", { name: "Coder: Approval needed: Run npm test?" })).toBeInTheDocument();
    expect(screen.getByRole("tree", { name: "Approve ?" })).toBeInTheDocument();
  });
});
