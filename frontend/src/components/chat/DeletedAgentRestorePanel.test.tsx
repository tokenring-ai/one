import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, useLocation } from "react-router-dom";
import DeletedAgentRestorePanel from "./DeletedAgentRestorePanel.tsx";

function Pathname() {
  return <p data-testid="pathname">{useLocation().pathname}</p>;
}

const launchMock = mock();
const agentsMutateMock = mock(() => Promise.resolve());
type CheckpointListData = {
  items: Array<{ id: number; name: string; agentId: string; createdAt: number }>;
  total: number;
  hasMore: boolean;
  limit: number;
  offset: number;
};

function paginated(items: CheckpointListData["items"]): CheckpointListData {
  return { items, total: items.length, hasMore: false, limit: 500, offset: 0 };
}

const useAgentCheckpointListMock = mock(
  (): {
    data: CheckpointListData | undefined;
    error: Error | undefined;
    isLoading: boolean;
    mutate: () => Promise<unknown>;
  } => ({ data: paginated([]), error: undefined, isLoading: false, mutate: mock(() => Promise.resolve()) }),
);

void mock.module("../../rpc.ts", () => ({
  checkpointRPCClient: {
    launchAgentFromCheckpoint: launchMock,
  },
  useAgentList: mock(() => ({ data: [], mutate: agentsMutateMock })),
  useAgentCheckpointList: useAgentCheckpointListMock,
}));

void mock.module("../ui/toast.tsx", () => ({
  toastManager: {
    error: mock(),
    warning: mock(),
    success: mock(),
    info: mock(),
  },
}));

function renderPanel(agentId = "agent-1") {
  return render(
    <MemoryRouter>
      <DeletedAgentRestorePanel agentId={agentId} />
    </MemoryRouter>,
  );
}

describe("DeletedAgentRestorePanel", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
  });

  it("renders nothing when there are no checkpoints for the agent", () => {
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([{ id: 1, name: "Other", agentId: "other-agent", createdAt: 1000 }]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });

    const { container } = renderPanel("agent-1");
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state while checkpoints are loading", () => {
    useAgentCheckpointListMock.mockReturnValue({ data: undefined, error: undefined, isLoading: true, mutate: mock(() => Promise.resolve()) });

    renderPanel();
    expect(screen.getByText("Looking for checkpoints…")).toBeTruthy();
  });

  it("shows a retryable error instead of a bare empty state when loading fails", () => {
    const mutate = mock(() => Promise.resolve());
    useAgentCheckpointListMock.mockReturnValue({ data: undefined, error: new Error("Socket closed"), isLoading: false, mutate });

    renderPanel();
    expect(screen.getByText(/Couldn't load checkpoints:/)).toBeTruthy();
    expect(screen.getByText(/Socket closed/)).toBeTruthy();
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
  });

  it("pre-selects the most recent checkpoint for the agent", () => {
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([
        { id: 1, name: "Older checkpoint", agentId: "agent-1", createdAt: 1000 },
        { id: 2, name: "Newer checkpoint", agentId: "agent-1", createdAt: 2000 },
        { id: 3, name: "Other agent", agentId: "other", createdAt: 3000 },
      ]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });

    renderPanel("agent-1");

    expect(screen.getByText("This agent is no longer running")).toBeTruthy();
    const select = screen.getByRole("combobox", { name: "Select checkpoint to restore" }) as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(screen.getByRole("button", { name: "Restore agent from checkpoint: Newer checkpoint" })).toBeTruthy();
  });

  it("restores the selected checkpoint and navigates to the new agent", async () => {
    const user = userEvent.setup();
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([{ id: 10, name: "Final state", agentId: "agent-1", createdAt: 5000 }]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
    launchMock.mockResolvedValueOnce({ status: "success", agentId: "restored-agent", agentName: "Restored" });

    renderPanel("agent-1");

    await user.click(screen.getByRole("button", { name: /Restore agent from checkpoint/ }));

    await waitFor(() => {
      expect(launchMock).toHaveBeenCalledWith({ checkpointId: 10 });
    });
    expect(agentsMutateMock).toHaveBeenCalled();
  });

  it("hands the restored agent to the hosting chat, which replaces itself", async () => {
    const user = userEvent.setup();
    const onRestored = mock((_agentId: string) => {});
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([{ id: 10, name: "Final state", agentId: "agent-1", createdAt: 5000 }]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
    launchMock.mockResolvedValueOnce({ status: "success", agentId: "restored-agent", agentName: "Restored" });

    render(
      <MemoryRouter>
        <DeletedAgentRestorePanel agentId="agent-1" onRestored={onRestored} />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Restore agent from checkpoint/ }));

    await waitFor(() => expect(onRestored).toHaveBeenCalledWith("restored-agent"));
    expect(agentsMutateMock).toHaveBeenCalled();
  });

  it("without a hosting chat, opens the restored agent's chat", async () => {
    const user = userEvent.setup();
    useAgentCheckpointListMock.mockReturnValue({
      data: paginated([{ id: 10, name: "Final state", agentId: "agent-1", createdAt: 5000 }]),
      error: undefined,
      isLoading: false,
      mutate: mock(() => Promise.resolve()),
    });
    launchMock.mockResolvedValueOnce({ status: "success", agentId: "restored-agent", agentName: "Restored" });

    render(
      <MemoryRouter initialEntries={["/somewhere"]}>
        <DeletedAgentRestorePanel agentId="agent-1" />
        <Pathname />
      </MemoryRouter>,
    );
    await user.click(screen.getByRole("button", { name: /Restore agent from checkpoint/ }));

    await waitFor(() => expect(screen.getByTestId("pathname").textContent).toBe("/agent/restored-agent"));
  });
});
