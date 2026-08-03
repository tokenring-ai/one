import { describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ParsedTreeSelectQuestion } from "@tokenring-ai/agent/question";
import TreeInlineQuestion from "./tree-inline.tsx";

describe("TreeInlineQuestion", () => {
  it("submits pre-selected defaultValue without requiring a re-click", async () => {
    const onSubmitValue = mock((_arg: string[] | null) => {});
    const question = {
      type: "treeSelect",
      label: "Pick tools",
      defaultValue: ["tool-a", "tool-c"],
      minimumSelections: 0,
      tree: [
        {
          name: "Category A",
          children: [
            { name: "Tool A", value: "tool-a" },
            { name: "Tool B", value: "tool-b" },
          ],
        },
        {
          name: "Category B",
          children: [{ name: "Tool C", value: "tool-c" }],
        },
      ],
    } as ParsedTreeSelectQuestion;

    render(<TreeInlineQuestion question={question} agentId="agent-1" requestId="req-1" onSubmitValue={onSubmitValue} onClose={() => {}} autoFocus={false} />);

    // Defaults should be reflected in the selection count immediately
    expect(screen.getByText("2 selected")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmitValue).toHaveBeenCalledTimes(1);
    });

    const submitted = onSubmitValue.mock.calls[0]?.[0] as string[] | null;
    expect(submitted?.sort()).toEqual(["tool-a", "tool-c"]);
  });

  it("submits single-select default without requiring a re-click", async () => {
    const onSubmitValue = mock((_: string[] | null) => {});
    const question = {
      type: "treeSelect",
      label: "Provider",
      defaultValue: ["local"],
      minimumSelections: 1,
      maximumSelections: 1,
      tree: [
        { name: "local (current)", value: "local" },
        { name: "remote", value: "remote" },
      ],
    } as ParsedTreeSelectQuestion;

    render(<TreeInlineQuestion question={question} agentId="agent-1" requestId="req-1" onSubmitValue={onSubmitValue} onClose={() => {}} autoFocus={false} />);

    expect(screen.getByText("1 selected")).toBeTruthy();

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmitValue).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitValue.mock.calls[0]?.[0]).toEqual(["local"]);
  });

  it("auto-selects the initially focused leaf in single-select so submit works immediately", async () => {
    const onSubmitValue = mock((_: string[] | null) => {});
    const question = {
      type: "treeSelect",
      label: "Provider",
      defaultValue: [],
      minimumSelections: 1,
      maximumSelections: 1,
      allowFreeform: false,
      tree: [
        { name: "local", value: "local" },
        { name: "remote", value: "remote" },
      ],
    } as ParsedTreeSelectQuestion;

    render(<TreeInlineQuestion question={question} agentId="agent-1" requestId="req-1" onSubmitValue={onSubmitValue} onClose={() => {}} autoFocus={true} />);

    await waitFor(() => {
      expect(screen.getByText("1 selected")).toBeTruthy();
    });

    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await waitFor(() => {
      expect(onSubmitValue).toHaveBeenCalledTimes(1);
    });

    expect(onSubmitValue.mock.calls[0]?.[0]).toEqual(["local"]);
  });
});
