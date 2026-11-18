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
    const onSubmitValue = mock<(value: string[] | null) => void>(() => {});
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
    const onSubmitValue = mock<(value: string[] | null) => void>(() => {});
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

  describe("approval with a standing-permission answer", () => {
    const approval = (defaultValue: string[]) =>
      ({
        type: "treeSelect",
        label: "Approve?",
        defaultValue,
        minimumSelections: 1,
        maximumSelections: 1,
        tree: [
          { name: "Approve", value: "Approved" },
          { name: "Not now", value: "Not approved" },
          { name: "Always allow: Publish posts on mysite", value: "Always" },
        ],
      }) as ParsedTreeSelectQuestion;

    it("shows all three answers and the caption, and submits the default without picking Always", async () => {
      const onSubmitValue = mock<(value: string[] | null) => void>(() => {});
      render(<TreeInlineQuestion question={approval([])} agentId="a" requestId="r" onSubmitValue={onSubmitValue} onClose={() => {}} autoFocus />);
      expect(screen.getAllByRole("treeitem").map(item => item.textContent)).toEqual(["Approve", "Not now", "Always allow: Publish posts on mysite"]);
      expect(screen.getByTestId("always-allow-caption")).toHaveTextContent("Configuration → Permissions");
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      await waitFor(() => expect(onSubmitValue).toHaveBeenCalledTimes(1));
      expect(onSubmitValue.mock.calls[0]?.[0]).toEqual(["Approved"]);
    });

    it("keeps a No default and submits Always only when chosen", async () => {
      const onSubmitValue = mock<(value: string[] | null) => void>(() => {});
      render(
        <TreeInlineQuestion
          question={approval(["Not approved"])}
          agentId="a"
          requestId="r"
          onSubmitValue={onSubmitValue}
          onClose={() => {}}
          autoFocus={false}
        />,
      );
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      await waitFor(() => expect(onSubmitValue).toHaveBeenLastCalledWith(["Not approved"]));
      await userEvent.click(screen.getByText("Always allow: Publish posts on mysite"));
      await userEvent.click(screen.getByRole("button", { name: /submit/i }));
      await waitFor(() => expect(onSubmitValue).toHaveBeenLastCalledWith(["Always"]));
    });

    it("shows no caption for a plain Yes/No approval", () => {
      const question = approval([]);
      question.tree = question.tree.slice(0, 2);
      render(<TreeInlineQuestion question={question} agentId="a" requestId="r" onSubmitValue={() => {}} onClose={() => {}} autoFocus={false} />);
      expect(screen.queryByTestId("always-allow-caption")).toBeNull();
    });
  });
});
