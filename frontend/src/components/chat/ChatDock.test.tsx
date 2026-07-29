import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatDock from "./ChatDock.tsx";

void mock.module("./ChatPanel.tsx", () => ({
  default: ({
    agentId,
    dockMode,
    onDockModeChange,
    onClose,
  }: {
    agentId: string;
    dockMode?: string;
    onDockModeChange?: (mode: string) => void;
    onClose?: () => void;
  }) => (
    <div data-testid="chat-panel" data-agent={agentId} data-mode={dockMode}>
      <button type="button" onClick={() => onDockModeChange?.("right")}>
        Dock to the right
      </button>
      <button type="button" onClick={() => onDockModeChange?.("float")}>
        Float above content
      </button>
      <button type="button" onClick={() => onClose?.()}>
        Close chat
      </button>
    </div>
  ),
}));

function renderDock(agentId: string | null = "agent-1", storageKey = "test-app") {
  return render(
    <ChatDock agentId={agentId} storageKey={storageKey}>
      <div data-testid="app-body">App content</div>
    </ChatDock>,
  );
}

describe("ChatDock", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("renders only the content when there is no agent", () => {
    renderDock(null);

    expect(screen.getByTestId("app-body")).toBeTruthy();
    expect(screen.queryByTestId("chat-panel")).toBeNull();
  });

  it("docks to the bottom by default and switches placement", async () => {
    const user = userEvent.setup();
    renderDock();

    expect(screen.getByTestId("chat-panel").getAttribute("data-mode")).toBe("bottom");

    await user.click(screen.getByRole("button", { name: "Dock to the right" }));
    expect(screen.getByTestId("chat-panel").getAttribute("data-mode")).toBe("right");

    await user.click(screen.getByRole("button", { name: "Float above content" }));
    expect(screen.getByTestId("chat-panel").getAttribute("data-mode")).toBe("float");
  });

  it("hides the panel on close and reopens it in the last placement", async () => {
    const user = userEvent.setup();
    renderDock();

    await user.click(screen.getByRole("button", { name: "Dock to the right" }));
    await user.click(screen.getByRole("button", { name: "Close chat" }));

    expect(screen.queryByTestId("chat-panel")).toBeNull();
    expect(screen.getByTestId("app-body")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Reopen chat" }));
    expect(screen.getByTestId("chat-panel").getAttribute("data-mode")).toBe("right");
  });

  it("restores the persisted placement for the same app", async () => {
    const user = userEvent.setup();
    const { unmount } = renderDock();

    await user.click(screen.getByRole("button", { name: "Dock to the right" }));
    unmount();

    renderDock();
    expect(screen.getByTestId("chat-panel").getAttribute("data-mode")).toBe("right");
  });
});
