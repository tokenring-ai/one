import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import DeletedAgentRestorePanel from "./DeletedAgentRestorePanel.tsx";

const launchMock = mock();
const agentsMutateMock = mock(() => Promise.resolve());
const useCheckpointListMock = mock(() => ({
  data: [] as Array<{ id: number; name: string; agentId: string; createdAt: number }>,
  isLoading: false,
}));

void mock.module("../../rpc.ts", () => ({
  checkpointRPCClient: {
    launchAgentFromCheckpoint: launchMock,
  },
  useAgentList: mock(() => ({ data: [], mutate: agentsMutateMock })),
  useCheckpointList: useCheckpointListMock,
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
    useCheckpointListMock.mockReturnValue({ data: [], isLoading: false });
  });

  it("renders nothing when there are no checkpoints for the agent", () => {
    useCheckpointListMock.mockReturnValue({
      data: [{ id: 1, name: "Other", agentId: "other-agent", createdAt: 1000 }],
      isLoading: false,
    });

    const { container } = renderPanel("agent-1");
    expect(container.firstChild).toBeNull();
  });

  it("shows loading state while checkpoints are loading", () => {
    useCheckpointListMock.mockReturnValue({ data: undefined as never, isLoading: true });

    renderPanel();
    expect(screen.getByText("Looking for checkpoints…")).toBeTruthy();
  });

  it("pre-selects the most recent checkpoint for the agent", () => {
    useCheckpointListMock.mockReturnValue({
      data: [
        { id: 1, name: "Older checkpoint", agentId: "agent-1", createdAt: 1000 },
        { id: 2, name: "Newer checkpoint", agentId: "agent-1", createdAt: 2000 },
        { id: 3, name: "Other agent", agentId: "other", createdAt: 3000 },
      ],
      isLoading: false,
    });

    renderPanel("agent-1");

    expect(screen.getByText("This agent is no longer running")).toBeTruthy();
    const select = screen.getByRole("combobox", { name: "Select checkpoint to restore" }) as HTMLSelectElement;
    expect(select.value).toBe("2");
    expect(screen.getByRole("button", { name: "Restore agent from checkpoint: Newer checkpoint" })).toBeTruthy();
  });

  it("restores the selected checkpoint and navigates to the new agent", async () => {
    const user = userEvent.setup();
    useCheckpointListMock.mockReturnValue({
      data: [{ id: 10, name: "Final state", agentId: "agent-1", createdAt: 5000 }],
      isLoading: false,
    });
    launchMock.mockResolvedValueOnce({ status: "success", agentId: "restored-agent", agentName: "Restored" });

    renderPanel("agent-1");

    await user.click(screen.getByRole("button", { name: /Restore agent from checkpoint/ }));

    await waitFor(() => {
      expect(launchMock).toHaveBeenCalledWith({ checkpointId: 10, headless: false });
    });
    expect(agentsMutateMock).toHaveBeenCalled();
  });
});
