import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { GoalSnapshot } from "@tokenring-ai/goal/schema";

const setGoal = mock(async () => ({ status: "success" as const, goal: null }));
const sendInput = mock(async () => undefined);
const mutate = mock(async () => undefined);
let goal: GoalSnapshot | null = null;

void mock.module("../../rpc.ts", () => ({
  useGoal: () => ({ data: { status: "success" as const, goal }, error: undefined, isLoading: false, mutate }),
  goalRPCClient: { setGoal },
  agentRPCClient: { sendInput },
}));

void mock.module("../ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: mock(), warning: mock(), info: mock() },
}));

const { default: GoalChip } = await import("./GoalChip.tsx");

const activeGoal: GoalSnapshot = {
  text: "Make the tests pass",
  status: "active",
  attempts: 1,
  maxTurns: 25,
  startedAt: 1,
  endedAt: null,
  lastVerdict: null,
};

describe("GoalChip", () => {
  beforeEach(() => {
    goal = activeGoal;
    setGoal.mockClear();
    sendInput.mockClear();
    mutate.mockClear();
  });

  it("shows the streamed goal and sets or clears it with setGoal", async () => {
    const user = userEvent.setup();
    render(<GoalChip agentId="agent-1" />);

    await user.click(screen.getByRole("button", { name: "Goal · 1/25 · active" }));
    const field = await screen.findByLabelText("Goal text");
    expect(field).toHaveValue("Make the tests pass");
    expect(screen.getByText("Turns 1 / 25")).toBeInTheDocument();

    await user.clear(field);
    await user.type(field, "Ship the fix");
    await user.click(screen.getByRole("button", { name: "Set goal" }));
    await waitFor(() => expect(setGoal).toHaveBeenCalledWith({ agentId: "agent-1", goal: "Ship the fix" }));

    await user.click(screen.getByRole("button", { name: "Clear goal" }));
    await waitFor(() => expect(setGoal).toHaveBeenCalledWith({ agentId: "agent-1", goal: "" }));
    expect(mutate).toHaveBeenCalled();
  });

  it("still pauses through the goal command", async () => {
    const user = userEvent.setup();
    render(<GoalChip agentId="agent-1" />);
    await user.click(screen.getByRole("button", { name: "Goal · 1/25 · active" }));
    await user.click(await screen.findByRole("button", { name: "Pause" }));
    await waitFor(() => expect(sendInput).toHaveBeenCalledWith({ agentId: "agent-1", input: { from: "Goal controls", message: "/goal pause" } }));
    expect(setGoal).not.toHaveBeenCalled();
  });
});
