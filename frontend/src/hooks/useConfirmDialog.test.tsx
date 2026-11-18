import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { CONFIRM_SKIPS_KEY, setConfirmSkipped } from "../lib/uiPreferences.ts";
import { useConfirmDialog, useConfirmSkipPreferences } from "./useConfirmDialog.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

describe("useConfirmDialog", () => {
  afterEach(() => {
    mock.restore();
    localStorage.clear();
  });

  it("starts closed with no options", () => {
    const { result } = renderHook(() => useConfirmDialog());
    expect(result.current.isOpen).toBe(false);
    expect(result.current.options).toBeNull();
    expect(result.current.Dialog()).toBeNull();
  });

  it("openConfirm opens the dialog and freezes options", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Delete item?",
        message: "This cannot be undone.",
        confirmText: "Delete",
        variant: "danger",
      });
    });

    expect(result.current.isOpen).toBe(true);
    expect(result.current.options).toEqual({
      title: "Delete item?",
      message: "This cannot be undone.",
      confirmText: "Delete",
      variant: "danger",
    });

    // Clean up so the promise does not hang the suite
    act(() => {
      result.current.close();
    });
    await expect(promise).resolves.toBe(false);
  });

  it("confirm resolves true and closes", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Reset?",
        message: "Clear counters.",
        confirmText: "Reset",
      });
    });

    act(() => {
      result.current.confirm();
    });

    await expect(promise).resolves.toBe(true);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.options).toBeNull();
  });

  it("close resolves false and closes", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Cancel item?",
        message: "Abort the run.",
      });
    });

    act(() => {
      result.current.close();
    });

    await expect(promise).resolves.toBe(false);
    expect(result.current.isOpen).toBe(false);
  });

  it("replaces an open dialog and resolves the previous promise as false", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = result.current.openConfirm({
        title: "First",
        message: "One",
      });
    });
    act(() => {
      second = result.current.openConfirm({
        title: "Second",
        message: "Two",
        confirmText: "Go",
      });
    });

    await expect(first).resolves.toBe(false);
    expect(result.current.isOpen).toBe(true);
    expect(result.current.options?.title).toBe("Second");

    act(() => {
      result.current.confirm();
    });
    await expect(second).resolves.toBe(true);
  });

  it("Dialog renders ConfirmModal and confirm button resolves true", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Delete skill",
        message: 'Remove "demo"?',
        confirmText: "Delete",
        variant: "danger",
      });
    });

    const { rerender } = render(result.current.Dialog());
    expect(screen.getByRole("dialog", { name: "Delete skill" })).toBeInTheDocument();
    expect(screen.getByText('Remove "demo"?')).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    await expect(promise).resolves.toBe(true);
    rerender(result.current.Dialog());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("Dialog cancel button resolves false", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Leave channel?",
        message: "Stop listening.",
        confirmText: "Leave",
        cancelText: "Stay",
        variant: "warning",
      });
    });

    const { rerender } = render(result.current.Dialog());
    await userEvent.click(screen.getByRole("button", { name: /^stay$/i }));

    await expect(promise).resolves.toBe(false);
    rerender(result.current.Dialog());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("close is a no-op when nothing is open", () => {
    const { result } = renderHook(() => useConfirmDialog());
    act(() => {
      result.current.close();
      result.current.confirm();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("resolves true immediately when the prompt is skipped", async () => {
    setConfirmSkipped("Delete item?", true);
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Delete item?",
        message: "This cannot be undone.",
      });
    });

    await expect(promise).resolves.toBe(true);
    expect(result.current.isOpen).toBe(false);
    expect(result.current.Dialog()).toBeNull();
  });

  it("uses a custom id as the skip key", async () => {
    setConfirmSkipped("agent-delete", true);
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        id: "agent-delete",
        title: "Delete Agent",
        message: "Gone.",
      });
    });

    await expect(promise).resolves.toBe(true);
    expect(result.current.isOpen).toBe(false);
  });

  it("does not skip when dontAskAgain is false even if stored", async () => {
    setConfirmSkipped("Clear local preferences?", true);
    const { result } = renderHook(() => useConfirmDialog());

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.openConfirm({
        title: "Clear local preferences?",
        message: "Wipe this browser.",
        dontAskAgain: false,
      });
    });

    expect(result.current.isOpen).toBe(true);
    act(() => {
      result.current.close();
    });
    await expect(promise).resolves.toBe(false);
  });

  it("Dialog persist of Don't ask again skips the next openConfirm", async () => {
    const { result } = renderHook(() => useConfirmDialog());

    let first!: Promise<boolean>;
    act(() => {
      first = result.current.openConfirm({
        title: "Delete skill",
        message: 'Remove "demo"?',
        confirmText: "Delete",
      });
    });

    const { rerender } = render(result.current.Dialog());
    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await expect(first).resolves.toBe(true);

    rerender(result.current.Dialog());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({ "Delete skill": true });

    let second!: Promise<boolean>;
    act(() => {
      second = result.current.openConfirm({
        title: "Delete skill",
        message: 'Remove "other"?',
        confirmText: "Delete",
      });
    });
    await expect(second).resolves.toBe(true);
    expect(result.current.isOpen).toBe(false);
  });
});

describe("useConfirmSkipPreferences", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("lists skipped ids and restores them", async () => {
    setConfirmSkipped("Delete Agent", true);
    setConfirmSkipped("Close Terminal", true);

    const { result } = renderHook(() => useConfirmSkipPreferences());
    expect(result.current.skippedIds).toEqual(["Close Terminal", "Delete Agent"]);

    act(() => {
      result.current.restore("Delete Agent");
    });
    expect(result.current.skippedIds).toEqual(["Close Terminal"]);

    act(() => {
      result.current.restoreAll();
    });
    expect(result.current.skippedIds).toEqual([]);
    expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({});
  });
});
