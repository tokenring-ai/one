import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import type { QuestionPromptMessage } from "../../types/agent-events.ts";
import { formatCountdown } from "../question/InlineQuestion.tsx";
import PendingQuestions from "./PendingQuestions.tsx";

function approval(extra: Partial<QuestionPromptMessage> = {}): QuestionPromptMessage {
  return {
    type: "question",
    requestId: "req-1",
    interactionId: "int-1",
    timestamp: Date.now(),
    message: "Delete the build folder?",
    optional: false,
    question: {
      type: "treeSelect",
      label: "Approve ?",
      defaultValue: [],
      allowFreeform: false,
      tree: [
        { name: "Yes", value: "Approved" },
        { name: "No", value: "Not approved" },
      ],
    },
    ...extra,
  } as QuestionPromptMessage;
}

describe("PendingQuestions deadline", () => {
  it("shows a countdown for a question with a deadline", () => {
    render(<PendingQuestions agentId="agent-1" questions={[approval({ autoSubmitAt: Date.now() + 10 * 60_000 })]} />);
    expect(screen.getByText(/^Default answer in (10:00|9:59)$/)).toBeTruthy();
    expect(screen.getByText(/^(10:00|9:59)$/)).toBeTruthy();
  });

  it("shows no countdown for a question that waits for an answer", () => {
    render(<PendingQuestions agentId="agent-1" questions={[approval()]} />);
    expect(screen.queryByText(/Default answer/)).toBeNull();
  });
});

describe("formatCountdown", () => {
  it("formats seconds, minutes and hours", () => {
    expect(formatCountdown(45)).toBe("45s");
    expect(formatCountdown(245)).toBe("4:05");
    expect(formatCountdown(3725)).toBe("1:02:05");
  });
});
