import { describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useKeyboardShortcuts } from "./useKeyboardShortcuts.ts";

function dispatchKey(key: string, mods: { ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } = {}): KeyboardEvent {
  const event = new KeyboardEvent("keydown", {
    key,
    bubbles: true,
    cancelable: true,
    ctrlKey: mods.ctrlKey ?? false,
    metaKey: mods.metaKey ?? false,
    shiftKey: mods.shiftKey ?? false,
  });
  window.dispatchEvent(event);
  return event;
}

describe("useKeyboardShortcuts", () => {
  it("fires handler for Ctrl+key", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("fires handler for Meta+key (Cmd on macOS)", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    act(() => {
      dispatchKey("s", { metaKey: true });
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("does not fire without Ctrl or Meta", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    act(() => {
      dispatchKey("s");
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("prevents default browser behavior", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    let event!: KeyboardEvent;
    act(() => {
      event = dispatchKey("s", { ctrlKey: true });
    });

    expect(event.defaultPrevented).toBe(true);
  });

  it("matches keys case-insensitively", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    act(() => {
      dispatchKey("S", { ctrlKey: true });
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("skips disabled shortcuts", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler, enabled: false }]));

    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("defaults enabled to true", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "o", handler }]));

    act(() => {
      dispatchKey("o", { ctrlKey: true });
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("routes multiple shortcuts by key", () => {
    const save = jest.fn();
    const open = jest.fn();
    const create = jest.fn();
    renderHook(() =>
      useKeyboardShortcuts([
        { key: "s", handler: save },
        { key: "o", handler: open },
        { key: "n", handler: create },
      ]),
    );

    act(() => {
      dispatchKey("o", { metaKey: true });
    });

    expect(open).toHaveBeenCalledTimes(1);
    expect(save).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("uses the latest handler and enabled flag without re-registering", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { rerender } = renderHook(
      ({ handler, enabled }: { handler: (e: KeyboardEvent) => void; enabled: boolean }) => useKeyboardShortcuts([{ key: "s", handler, enabled }]),
      { initialProps: { handler: first, enabled: true } },
    );

    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });
    expect(first).toHaveBeenCalledTimes(1);

    rerender({ handler: second, enabled: true });
    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);

    rerender({ handler: second, enabled: false });
    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("removes the listener on unmount", () => {
    const handler = jest.fn();
    const { unmount } = renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    unmount();
    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });

    expect(handler).not.toHaveBeenCalled();
  });

  it("passes the KeyboardEvent to the handler", () => {
    const handler = jest.fn();
    renderHook(() => useKeyboardShortcuts([{ key: "s", handler }]));

    act(() => {
      dispatchKey("s", { ctrlKey: true });
    });

    expect(handler.mock.calls[0]?.[0]).toBeInstanceOf(KeyboardEvent);
  });
});
