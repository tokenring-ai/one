import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { usePendingAction } from "./usePendingAction.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

type TestAction = { type: "select"; id: string } | { type: "new"; name: string };

describe("usePendingAction", () => {
  afterEach(() => {
    mock.restore();
  });

  it("queueAction returns false when clean and does not store an action", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: false }));

    let queued = true;
    act(() => {
      queued = result.current.queueAction({ type: "select", id: "a" });
    });

    expect(queued).toBe(false);
    expect(result.current.pendingAction).toBeNull();
  });

  it("queueAction stores the action and returns true when dirty", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));

    let queued = false;
    act(() => {
      queued = result.current.queueAction({ type: "new", name: "draft" });
    });

    expect(queued).toBe(true);
    expect(result.current.pendingAction).toEqual({ type: "new", name: "draft" });
  });

  it("cancelPending clears the queue without executing", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));
    const execute = mock(() => {});

    act(() => {
      result.current.queueAction({ type: "select", id: "x" });
    });
    act(() => {
      result.current.cancelPending();
    });

    expect(result.current.pendingAction).toBeNull();
    act(() => {
      result.current.executePending(execute);
    });
    expect(execute).not.toHaveBeenCalled();
  });

  it("executePending runs the queued action then clears", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));
    const execute = mock(() => {});

    act(() => {
      result.current.queueAction({ type: "select", id: "item-1" });
    });
    act(() => {
      result.current.executePending(execute);
    });

    expect(execute).toHaveBeenCalledTimes(1);
    expect(execute).toHaveBeenCalledWith({ type: "select", id: "item-1" });
    expect(result.current.pendingAction).toBeNull();
  });

  it("executePending is a no-op when nothing is queued", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: false }));
    const execute = mock(() => {});

    act(() => {
      result.current.executePending(execute);
    });

    expect(execute).not.toHaveBeenCalled();
  });

  it("replaces a previously queued action", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));

    act(() => {
      result.current.queueAction({ type: "select", id: "first" });
      result.current.queueAction({ type: "new", name: "second" });
    });

    expect(result.current.pendingAction).toEqual({ type: "new", name: "second" });
  });

  it("PendingDialog renders nothing when idle", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: false }));
    const { container } = render(result.current.PendingDialog({ onConfirm: () => {} }));
    expect(container.firstChild).toBeNull();
  });

  it("PendingDialog confirms via onConfirm and clears the queue", async () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));
    const onConfirm = mock(() => {});

    act(() => {
      result.current.queueAction({ type: "select", id: "toc" });
    });

    const { rerender } = render(
      result.current.PendingDialog({
        title: "Discard unsaved changes?",
        message: "Leave this item?",
        confirmLabel: "Discard",
        onConfirm,
      }),
    );

    expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    expect(screen.getByText("Leave this item?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onConfirm).toHaveBeenCalledWith({ type: "select", id: "toc" });

    rerender(
      result.current.PendingDialog({
        title: "Discard unsaved changes?",
        message: "Leave this item?",
        confirmLabel: "Discard",
        onConfirm,
      }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(result.current.pendingAction).toBeNull();
  });

  it("PendingDialog cancel clears without calling onConfirm", async () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));
    const onConfirm = mock(() => {});

    act(() => {
      result.current.queueAction({ type: "new", name: "x" });
    });

    const { rerender } = render(result.current.PendingDialog({ onConfirm }));

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(onConfirm).not.toHaveBeenCalled();
    rerender(result.current.PendingDialog({ onConfirm }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(result.current.pendingAction).toBeNull();
  });

  it("uses default dialog copy when options omit title/message/label", () => {
    const { result } = renderHook(() => usePendingAction<TestAction>({ isDirty: true }));

    act(() => {
      result.current.queueAction({ type: "select", id: "a" });
    });

    render(result.current.PendingDialog({ onConfirm: () => {} }));

    expect(screen.getByRole("dialog", { name: "Discard unsaved changes?" })).toBeInTheDocument();
    expect(screen.getByText("You have unsaved edits. Proceed and lose those changes?")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
  });
});
