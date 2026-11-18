import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";

const now = Date.now();

const defaultList = () => ({
  data: {
    total: 2,
    items: [
      { id: 1, name: "First checkpoint", agentId: "a", createdAt: now - 1000 },
      { id: 2, name: "Second checkpoint", agentId: "a", createdAt: now - 2000 },
    ],
  } as { total: number; items: { id: number; name: string; agentId: string; createdAt: number }[] } | undefined,
  isLoading: false,
  error: undefined,
  mutate: mock(),
});
let checkpointList = defaultList();

void mock.module("../rpc.ts", () => ({
  checkpointRPCClient: { launchAgentFromCheckpoint: mock(async () => ({ status: "success", agentId: "a" })) },
  useCheckpointList: () => checkpointList,
}));

void mock.module("../apps/chat/useOpenAgentChat.ts", () => ({ useOpenAgentChat: () => mock() }));

const { default: CheckpointBrowser } = await import("./CheckpointBrowser.tsx");

function keyDown(target: EventTarget, key: string): KeyboardEvent {
  const event = new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true });
  act(() => {
    target.dispatchEvent(event);
  });
  return event;
}

describe("CheckpointBrowser states", () => {
  afterEach(() => {
    cleanup();
    checkpointList = defaultList();
  });

  const agents = { data: [], mutate: mock() } as unknown as Parameters<typeof CheckpointBrowser>[0]["agents"];

  it("shows a loading state instead of a blank panel", () => {
    checkpointList = { ...defaultList(), data: undefined, isLoading: true };
    render(<CheckpointBrowser agents={agents} />);
    expect(screen.getByRole("status")).toHaveTextContent("Loading checkpoints");
  });

  it("explains how checkpoints are created when there are none", () => {
    checkpointList = { ...defaultList(), data: { total: 0, items: [] } };
    render(<CheckpointBrowser agents={agents} />);
    expect(screen.getByText("No checkpoints yet")).toBeInTheDocument();
    expect(screen.getByText(/\/agent checkpoint create/)).toBeInTheDocument();
  });

  it("shows 'N of total' when the list is capped below the server total", () => {
    checkpointList = { ...defaultList(), data: { ...defaultList().data!, total: 900 } };
    render(<CheckpointBrowser agents={agents} />);
    expect(screen.getByText("2 of 900 saved")).toBeInTheDocument();
  });

  it("shows the plain total when everything is listed", () => {
    render(<CheckpointBrowser agents={agents} />);
    expect(screen.getByText("2 saved")).toBeInTheDocument();
  });
});

describe("CheckpointBrowser keyboard handling", () => {
  afterEach(() => cleanup());

  const agents = { data: [], mutate: mock() } as unknown as Parameters<typeof CheckpointBrowser>[0]["agents"];

  it("does not swallow arrows / Enter / Escape typed elsewhere while open", () => {
    render(
      <>
        <CheckpointBrowser agents={agents} />
        <textarea aria-label="Chat composer" />
      </>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Select a checkpoint" }));
    expect(screen.getByRole("listbox", { name: "Available checkpoints" })).toBeInTheDocument();

    const composer = screen.getByLabelText("Chat composer");
    for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape"]) {
      expect(keyDown(composer, key).defaultPrevented).toBe(false);
    }
    // Escape in another panel must not close the selector either.
    expect(screen.getByRole("button", { name: "Select a checkpoint" })).toHaveAttribute("aria-expanded", "true");
  });

  it("navigates and selects with the keyboard from inside the selector", () => {
    render(<CheckpointBrowser agents={agents} />);
    fireEvent.click(screen.getByRole("button", { name: "Select a checkpoint" }));

    const search = screen.getByLabelText("Filter checkpoints");
    expect(keyDown(search, "ArrowDown").defaultPrevented).toBe(true);
    expect(keyDown(search, "ArrowDown").defaultPrevented).toBe(true);
    expect(keyDown(search, "Enter").defaultPrevented).toBe(true);

    expect(screen.getByRole("button", { name: "Select a checkpoint" })).toHaveAttribute("aria-expanded", "false");
    expect(screen.getByRole("button", { name: "Launch agent from checkpoint: Second checkpoint" })).toBeInTheDocument();
  });

  it("closes on Escape from inside the selector", () => {
    render(<CheckpointBrowser agents={agents} />);
    fireEvent.click(screen.getByRole("button", { name: "Select a checkpoint" }));

    expect(keyDown(screen.getByLabelText("Filter checkpoints"), "Escape").defaultPrevented).toBe(true);
    expect(screen.getByRole("button", { name: "Select a checkpoint" })).toHaveAttribute("aria-expanded", "false");
  });
});
