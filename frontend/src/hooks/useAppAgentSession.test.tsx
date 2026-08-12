import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook, waitFor } from "@testing-library/react";
import type { RunningAgent } from "../lib/agentSessions.ts";

let agentListData: RunningAgent[] | undefined = [];
let agentListLoading = false;

const createAgent = mock(async (_args: { agentType: string; headless: boolean }) => ({
  id: "created-agent",
  displayName: "Created Agent",
  description: "",
}));
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" as const }));

void mock.module("../rpc.ts", () => ({
  useAgentList: () => ({ data: agentListData, isLoading: agentListLoading, error: undefined, mutate: mock(async () => undefined) }),
  agentRPCClient: { createAgent, deleteAgent },
}));

let confirmResult = true;
const openConfirm = mock(async (_options: unknown) => confirmResult);

void mock.module("./useConfirmDialog.tsx", () => ({
  useConfirmDialog: () => ({ isOpen: false, options: null, openConfirm, close: mock(), confirm: mock(), Dialog: () => null }),
}));

const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: toastError, warning: mock(), info: mock(), remove: mock() },
}));

const { useAppAgentSession } = await import("./useAppAgentSession.tsx");

function agent(overrides: Partial<RunningAgent> & { id: string }): RunningAgent {
  return {
    createdAt: 0,
    agentType: "memory",
    displayName: overrides.id,
    description: "",
    idle: true,
    currentActivity: "",
    ...overrides,
  };
}

const options = { appName: "Memories app", storageKey: "test", agentTypes: ["memory", "memory-curator"] };

function render() {
  return renderHook(() => useAppAgentSession(options));
}

describe("useAppAgentSession", () => {
  beforeEach(() => {
    localStorage.clear();
    agentListData = [];
    agentListLoading = false;
    confirmResult = true;
    createAgent.mockClear();
    deleteAgent.mockClear();
    openConfirm.mockClear();
    toastError.mockClear();
  });

  it("lists only agents of the configured types, wherever they were spawned", async () => {
    agentListData = [agent({ id: "a" }), agent({ id: "b", agentType: "code" }), agent({ id: "c", agentType: "memory-curator" })];

    const { result } = render();

    await waitFor(() => expect(result.current.agents.map(a => a.id)).toEqual(["a", "c"]));
  });

  it("attaches to the first matching agent when nothing is selected", async () => {
    agentListData = [agent({ id: "idle-agent", createdAt: 5 }), agent({ id: "busy-agent", idle: false, createdAt: 1 })];

    const { result } = render();

    await waitFor(() => expect(result.current.agentId).toBe("busy-agent"));
    expect(result.current.agent?.displayName).toBe("busy-agent");
  });

  it("keeps the selection across a remount without deleting the agent", async () => {
    agentListData = [agent({ id: "a", createdAt: 2 }), agent({ id: "b", createdAt: 1 })];

    const first = render();
    await waitFor(() => expect(first.result.current.agentId).toBe("a"));
    act(() => first.result.current.selectAgent("b"));
    await waitFor(() => expect(first.result.current.agentId).toBe("b"));
    first.unmount();

    expect(deleteAgent).not.toHaveBeenCalled();

    const second = render();
    await waitFor(() => expect(second.result.current.agentId).toBe("b"));
  });

  it("drops a stored selection for an agent that is no longer running", async () => {
    localStorage.setItem("agentSession:test", JSON.stringify("gone-agent"));
    agentListData = [];

    const { result } = render();

    await waitFor(() => expect(result.current.agentId).toBeNull());
    expect(localStorage.getItem("agentSession:test")).toBe("null");
  });

  it("creates the default agent type and attaches before the stream catches up", async () => {
    const { result } = render();

    await act(async () => {
      await result.current.createAgent();
    });

    expect(createAgent).toHaveBeenCalledWith({ agentType: "memory", headless: false });
    await waitFor(() => expect(result.current.agentId).toBe("created-agent"));
  });

  it("creates a non-default agent type when one is named", async () => {
    const { result } = render();

    await act(async () => {
      await result.current.createAgent("memory-curator");
    });

    expect(createAgent).toHaveBeenCalledWith({ agentType: "memory-curator", headless: false });
  });

  it("confirms before deleting the attached agent and clears the selection", async () => {
    agentListData = [agent({ id: "a" })];
    const { result } = render();
    await waitFor(() => expect(result.current.agentId).toBe("a"));

    await act(async () => {
      await result.current.terminateAgent();
    });

    expect(openConfirm).toHaveBeenCalled();
    expect(deleteAgent).toHaveBeenCalledWith({ agentId: "a", reason: "Stopped from the Memories app" });
    await waitFor(() => expect(result.current.agentId).toBeNull());
    // Hidden immediately rather than waiting for the stream, so nothing reattaches to it.
    expect(result.current.agents).toEqual([]);
  });

  it("leaves the agent running when the confirmation is declined", async () => {
    confirmResult = false;
    agentListData = [agent({ id: "a" })];
    const { result } = render();
    await waitFor(() => expect(result.current.agentId).toBe("a"));

    await act(async () => {
      await result.current.terminateAgent();
    });

    expect(deleteAgent).not.toHaveBeenCalled();
    expect(result.current.agentId).toBe("a");
  });
});
