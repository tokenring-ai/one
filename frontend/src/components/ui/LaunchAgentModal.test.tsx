import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import LaunchAgentModal from "./LaunchAgentModal.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const navigate = mock((_path: string) => {});
void mock.module("react-router-dom", () => ({
  useNavigate: () => navigate,
}));

const createAgent = mock(async () => ({ id: "agent-42" }));
const sendInput = mock(async (_args: { agentId: string; input: { from: string; message: string } }) => ({}));
const getFilesystemState = mock(async () => ({ status: "success" as const, provider: "local" }));
const writeFile = mock(async (_args: { path: string; content: string; provider: string }) => ({}));
const addFileToChat = mock(async () => ({}));
const deleteFile = mock(async () => ({}));

void mock.module("../../rpc.ts", () => ({
  useAgentTypes: () => ({
    data: [
      { type: "research", displayName: "Research" },
      { type: "code", displayName: "Code" },
    ],
    isLoading: false,
  }),
  agentRPCClient: { createAgent, sendInput },
  filesystemRPCClient: { getFilesystemState, writeFile, addFileToChat, deleteFile },
}));

const toastError = mock((_msg: string, _opts?: { duration?: number }) => {});
void mock.module("./toast.tsx", () => ({
  toastManager: { error: toastError, success: mock(), info: mock() },
}));

function renderModal(overrides: Partial<Parameters<typeof LaunchAgentModal>[0]> = {}) {
  const props = {
    title: "Ask AI about AAPL",
    description: "Launches a new agent with context",
    defaultQuestion: "What do you think?",
    contextData: { symbol: "AAPL" },
    contextFileName: `tokenring-stock-AAPL-\${timestamp}.json`,
    messagePrefix: "You are analyzing stock AAPL.",
    messageSource: "Stocks app",
    onClose: mock(() => {}),
    ...overrides,
  };
  return { ...render(<LaunchAgentModal {...props} />), props };
}

describe("LaunchAgentModal", () => {
  beforeEach(() => {
    createAgent.mockClear();
    sendInput.mockClear();
    getFilesystemState.mockClear();
    writeFile.mockClear();
    addFileToChat.mockClear();
    deleteFile.mockClear();
    navigate.mockClear();
    toastError.mockClear();
  });

  it("renders title, description, question, agent type, and actions", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Ask AI about AAPL" })).toBeInTheDocument();
    expect(screen.getByText("Launches a new agent with context")).toBeInTheDocument();
    expect(screen.getByDisplayValue("What do you think?")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /launch agent/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables Launch when question is empty", async () => {
    renderModal({ defaultQuestion: "" });

    const launchBtn = screen.getByRole("button", { name: /launch agent/i });
    expect(launchBtn).toBeDisabled();

    await userEvent.type(screen.getByRole("textbox"), "Analyze this");
    expect(launchBtn).not.toBeDisabled();
  });

  it("invokes onClose when Cancel is clicked", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape when not launching", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("launches an agent with context file and navigates on success", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ agentType: "research", headless: false });
    });

    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledTimes(1);
      expect(addFileToChat).toHaveBeenCalledTimes(1);
      expect(sendInput).toHaveBeenCalledTimes(1);
      expect(onClose).toHaveBeenCalledTimes(1);
      expect(navigate).toHaveBeenCalledWith("/agent/agent-42");
    });

    const writeArgs = writeFile.mock.calls[0]![0];
    expect(writeArgs.path).toMatch(/^\/tmp\/tokenring-stock-AAPL-\d+\.json$/);
    expect(writeArgs.provider).toBe("local");
    const written = JSON.parse(writeArgs.content) as { symbol: string; question: string; fetchedAt: string };
    expect(written.symbol).toBe("AAPL");
    expect(written.question).toBe("What do you think?");
    expect(written.fetchedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);

    const sendArgs = sendInput.mock.calls[0]![0];
    expect(sendArgs.agentId).toBe("agent-42");
    expect(sendArgs.input.from).toBe("Stocks app");
    expect(sendArgs.input.message).toContain("You are analyzing stock AAPL.");
    expect(sendArgs.input.message).toContain("User question: What do you think?");
    expect(sendArgs.input.message).toContain("Context is attached as");
  });

  it("calls onLaunch instead of navigate when provided", async () => {
    const onLaunch = mock((_id: string) => {});
    renderModal({ onLaunch, contextData: undefined });

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(onLaunch).toHaveBeenCalledWith("agent-42");
    });
    expect(navigate).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("uses a custom default agent type", async () => {
    renderModal({ defaultAgentType: "code", contextData: undefined });

    expect(screen.getByRole("combobox")).toHaveValue("code");

    await userEvent.click(screen.getByRole("button", { name: /launch agent/i }));

    await waitFor(() => {
      expect(createAgent).toHaveBeenCalledWith({ agentType: "code", headless: false });
    });
  });
});
