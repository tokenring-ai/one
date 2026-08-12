import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import AgentLaunchPanel from "./AgentLaunchPanel.tsx";

const createAgent = mock(async () => ({ id: "agent-42" }));

void mock.module("../../rpc.ts", () => ({
  useAgentTypes: () => ({
    data: [
      { type: "coder", displayName: "Coder" },
      { type: "research", displayName: "Research" },
    ],
    isLoading: false,
  }),
  agentRPCClient: { createAgent },
}));

const toastError = mock((_msg: string, _opts?: { duration?: number }) => {});
void mock.module("./toast.tsx", () => ({
  toastManager: { error: toastError, success: mock(), info: mock() },
}));

function renderPanel(overrides: Partial<Parameters<typeof AgentLaunchPanel>[0]> = {}) {
  const props = {
    selectedItems: new Set(["/a.ts", "/b.ts"]),
    itemLabel: "file",
    onClear: mock(() => {}),
    attachItemToAgent: mock(async (_agentId: string, _itemId: string) => {}),
    onNavigateToAgent: mock((_agentId: string) => {}),
    ...overrides,
  };
  return { ...render(<AgentLaunchPanel {...props} />), props };
}

describe("AgentLaunchPanel", () => {
  beforeEach(() => {
    createAgent.mockClear();
    toastError.mockClear();
  });

  it("renders selection count, clear, type selector, and launch button", () => {
    renderPanel();

    expect(screen.getByText("2 files selected")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /clear selection/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox", { name: /agent type/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /launch agent/i })).toBeInTheDocument();
  });

  it("uses singular item label when one item is selected", () => {
    renderPanel({ selectedItems: new Set(["/only.ts"]) });
    expect(screen.getByText("1 file selected")).toBeInTheDocument();
  });

  it("uses a custom plural label when provided", () => {
    renderPanel({
      selectedItems: new Set(["1", "2", "3"]),
      itemLabel: "research item",
      itemLabelPlural: "research items",
    });
    expect(screen.getByText("3 research items selected")).toBeInTheDocument();
  });

  it("calls onClear when Clear is clicked", async () => {
    const onClear = mock(() => {});
    renderPanel({ onClear });

    await userEvent.click(screen.getByRole("button", { name: /clear selection/i }));
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("auto-selects the first agent type and launches with attachments", async () => {
    const attachItemToAgent = mock(async (_agentId: string, _itemId: string) => {});
    const onNavigateToAgent = mock((_agentId: string) => {});
    renderPanel({ attachItemToAgent, onNavigateToAgent });

    expect(screen.getByRole("combobox")).toHaveValue("coder");

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ agentType: "coder", headless: false });
    });

    await waitFor(() => {
      expect(attachItemToAgent).toHaveBeenCalledTimes(2);
      expect(attachItemToAgent).toHaveBeenCalledWith("agent-42", "/a.ts");
      expect(attachItemToAgent).toHaveBeenCalledWith("agent-42", "/b.ts");
      expect(onNavigateToAgent).toHaveBeenCalledWith("agent-42");
    });
  });

  it("uses defaultAgentType when provided", async () => {
    renderPanel({ defaultAgentType: "research" });

    expect(screen.getByRole("combobox")).toHaveValue("research");

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false });
    });
  });

  it("allows changing the agent type before launch", async () => {
    renderPanel();

    await userEvent.selectOptions(screen.getByRole("combobox"), "research");
    expect(screen.getByRole("combobox")).toHaveValue("research");

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false });
    });
  });

  it("uses a custom launch label", () => {
    renderPanel({ launchLabel: "Open with Agent" });
    expect(screen.getByRole("button", { name: /open with agent/i })).toBeInTheDocument();
  });

  it("merges className onto the container", () => {
    const { container } = renderPanel({ className: "data-custom" });
    expect(container.firstChild).toHaveClass("data-custom");
    expect(container.firstChild).toHaveClass("border-t", "bg-secondary");
  });

  it("toasts on launch failure and does not navigate", async () => {
    createAgent.mockImplementationOnce(async () => {
      throw new Error("create failed");
    });
    const onNavigateToAgent = mock((_agentId: string) => {});
    renderPanel({ onNavigateToAgent });

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(toastError).toHaveBeenCalled();
    });
    expect(onNavigateToAgent).not.toHaveBeenCalled();
  });
});
