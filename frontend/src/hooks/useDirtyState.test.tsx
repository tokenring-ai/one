import { afterEach, describe, expect, it, mock } from "bun:test";
import { act, render, renderHook, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { DirtyIndicator, useDirtyState } from "./useDirtyState.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

describe("useDirtyState", () => {
  afterEach(() => {
    mock.restore();
  });

  it("is clean when current equals saved", () => {
    const { result } = renderHook(() => useDirtyState({ current: "hello", saved: "hello" }));
    expect(result.current.isDirty).toBe(false);
  });

  it("is dirty when current differs from saved", () => {
    const { result } = renderHook(() => useDirtyState({ current: "edited", saved: "hello" }));
    expect(result.current.isDirty).toBe(true);
  });

  it("uses a custom compare function", () => {
    const compare = (a: { n: number }, b: { n: number }) => a.n === b.n;
    const { result } = renderHook(() => useDirtyState({ current: { n: 1 }, saved: { n: 1 }, compare }));
    expect(result.current.isDirty).toBe(false);

    const { result: dirty } = renderHook(() => useDirtyState({ current: { n: 2 }, saved: { n: 1 }, compare }));
    expect(dirty.current.isDirty).toBe(true);
  });

  it("markSaved clears dirty using the current value as baseline", () => {
    const { result, rerender } = renderHook(({ current, saved }) => useDirtyState({ current, saved }), {
      initialProps: { current: "edited", saved: "original" },
    });
    expect(result.current.isDirty).toBe(true);

    act(() => {
      result.current.markSaved();
    });
    expect(result.current.isDirty).toBe(false);

    rerender({ current: "edited again", saved: "original" });
    expect(result.current.isDirty).toBe(true);
  });

  it("clears markSaved baseline when external saved changes", () => {
    const { result, rerender } = renderHook(({ current, saved }) => useDirtyState({ current, saved }), {
      initialProps: { current: "v2", saved: "v1" },
    });

    act(() => {
      result.current.markSaved();
    });
    expect(result.current.isDirty).toBe(false);

    // External save updates `saved` to something else while current stays "v2"
    rerender({ current: "v2", saved: "v3" });
    expect(result.current.isDirty).toBe(true);
  });

  it("registers beforeunload only when dirty and warnOnUnload is true", () => {
    const add = mock(() => {});
    const remove = mock(() => {});
    const originalAdd = window.addEventListener;
    const originalRemove = window.removeEventListener;
    window.addEventListener = add as typeof window.addEventListener;
    window.removeEventListener = remove as typeof window.removeEventListener;

    try {
      const { rerender, unmount } = renderHook(({ current, warnOnUnload }) => useDirtyState({ current, saved: "a", warnOnUnload }), {
        initialProps: { current: "a", warnOnUnload: true as boolean | undefined },
      });

      expect(add.mock.calls.some((c: unknown[]) => c[0] === "beforeunload")).toBe(false);

      rerender({ current: "b", warnOnUnload: true });
      expect(add.mock.calls.some((c: unknown[]) => c[0] === "beforeunload")).toBe(true);

      unmount();
      expect(remove.mock.calls.some((c: unknown[]) => c[0] === "beforeunload")).toBe(true);
    } finally {
      window.addEventListener = originalAdd;
      window.removeEventListener = originalRemove;
    }
  });

  it("skips beforeunload when warnOnUnload is false", () => {
    const add = mock(() => {});
    const originalAdd = window.addEventListener;
    window.addEventListener = add as typeof window.addEventListener;

    try {
      renderHook(() => useDirtyState({ current: "b", saved: "a", warnOnUnload: false }));
      expect(add.mock.calls.some((c: unknown[]) => c[0] === "beforeunload")).toBe(false);
    } finally {
      window.addEventListener = originalAdd;
    }
  });

  it("confirmDiscard returns true immediately when clean", () => {
    const { result } = renderHook(() => useDirtyState({ current: "a", saved: "a" }));
    expect(result.current.confirmDiscard()).toBe(true);
  });

  it("confirmDiscard uses window.confirm when dirty", () => {
    const confirm = mock(() => true);
    const original = window.confirm;
    window.confirm = confirm;

    try {
      const onDiscard = mock(() => {});
      const { result } = renderHook(() => useDirtyState({ current: "b", saved: "a" }));
      expect(result.current.confirmDiscard({ onDiscard })).toBe(true);
      expect(confirm).toHaveBeenCalledTimes(1);
      expect(onDiscard).toHaveBeenCalledTimes(1);
    } finally {
      window.confirm = original;
    }
  });

  it("confirmDiscard returns false when window.confirm is cancelled", () => {
    const original = window.confirm;
    window.confirm = mock(() => false);

    try {
      const onDiscard = mock(() => {});
      const { result } = renderHook(() => useDirtyState({ current: "b", saved: "a" }));
      expect(result.current.confirmDiscard({ onDiscard })).toBe(false);
      expect(onDiscard).not.toHaveBeenCalled();
    } finally {
      window.confirm = original;
    }
  });

  it("confirmDiscard dialog mode resolves via DiscardDialog", async () => {
    const { result } = renderHook(() => useDirtyState({ current: "b", saved: "a" }));

    let promise!: Promise<boolean>;
    act(() => {
      promise = result.current.confirmDiscard({
        dialog: { title: "Discard edits?", message: "Lose changes?", confirmLabel: "Discard" },
      }) as Promise<boolean>;
    });

    const { rerender } = render(result.current.DiscardDialog());
    expect(screen.getByRole("dialog", { name: "Discard edits?" })).toBeInTheDocument();
    expect(screen.getByText("Lose changes?")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /discard/i }));
    await expect(promise).resolves.toBe(true);

    // Re-render after state clear
    rerender(result.current.DiscardDialog());
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("DirtyDot renders only when dirty", () => {
    const { result, rerender } = renderHook(({ current }) => useDirtyState({ current, saved: "a" }), {
      initialProps: { current: "a" },
    });

    const { container, rerender: rerenderUi } = render(result.current.DirtyDot());
    expect(container.firstChild).toBeNull();

    rerender({ current: "b" });
    rerenderUi(result.current.DirtyDot());
    expect(container.querySelector("[title='Unsaved changes']")).toBeTruthy();
  });
});

describe("DirtyIndicator", () => {
  it("renders the amber unsaved indicator", () => {
    const { container } = render(<DirtyIndicator />);
    const el = container.firstChild as HTMLElement;
    expect(el.title).toBe("Unsaved changes");
    expect(el.className).toContain("bg-amber-400");
  });
});
