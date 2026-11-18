import { describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { createRef } from "react";
import { useEventListener } from "./useEventListener.ts";

describe("useEventListener", () => {
  it("listens on window by default", () => {
    const handler = jest.fn();
    renderHook(() => useEventListener("resize", handler));

    act(() => {
      window.dispatchEvent(new Event("resize"));
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("listens on document when target is document", () => {
    const handler = jest.fn();
    renderHook(() => useEventListener("keydown", handler, { target: document }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect((handler.mock.calls[0]?.[0] as KeyboardEvent | undefined)?.key).toBe("Escape");
  });

  it("does not attach when enabled is false", () => {
    const handler = jest.fn();
    renderHook(() => useEventListener("keydown", handler, { target: document, enabled: false }));

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("attaches when enabled becomes true", () => {
    const handler = jest.fn();
    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => useEventListener("keydown", handler, { target: document, enabled }), {
      initialProps: { enabled: false },
    });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(handler).not.toHaveBeenCalled();

    rerender({ enabled: true });

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "a", bubbles: true }));
    });
    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("uses the latest handler without rebinding identity churn", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(({ handler }: { handler: (e: Event) => void }) => useEventListener("visibilitychange", handler, { target: document }), {
      initialProps: { handler: first },
    });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    rerender({ handler: second });

    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useEventListener("keydown", handler, { target: document }));

    unmount();

    act(() => {
      document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("listens on an element ref target", () => {
    const el = document.createElement("div");
    document.body.appendChild(el);
    const ref = createRef<HTMLDivElement>();
    (ref as { current: HTMLDivElement | null }).current = el;

    const handler = jest.fn();
    renderHook(() => useEventListener("click", handler, { target: ref }));

    act(() => {
      el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handler).toHaveBeenCalledTimes(1);
    el.remove();
  });

  it("skips attach when ref target current is null", () => {
    const ref = createRef<HTMLDivElement>();
    const handler = jest.fn();
    renderHook(() => useEventListener("click", handler, { target: ref }));

    act(() => {
      document.body.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
