import { afterEach, describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { createRef, type RefObject } from "react";
import { useClickOutside } from "./useClickOutside.ts";

function dispatchMouse(type: "mousedown" | "click", target: EventTarget): void {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true });
  target.dispatchEvent(event);
}

describe("useClickOutside", () => {
  let inside: HTMLDivElement;
  let outside: HTMLDivElement;
  let child: HTMLSpanElement;

  afterEach(() => {
    inside?.remove();
    outside?.remove();
  });

  function setupDom(): {
    insideRef: RefObject<HTMLDivElement | null>;
    inside: HTMLDivElement;
    outside: HTMLDivElement;
    child: HTMLSpanElement;
  } {
    inside = document.createElement("div");
    child = document.createElement("span");
    outside = document.createElement("div");
    inside.appendChild(child);
    document.body.appendChild(inside);
    document.body.appendChild(outside);
    const insideRef = createRef<HTMLDivElement>();
    // Assign after mount so ref.current is set like a real attach
    (insideRef as { current: HTMLDivElement | null }).current = inside;
    return { insideRef, inside, outside, child };
  }

  it("calls onOutsideClick when mousedown is outside the ref", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick));

    act(() => {
      dispatchMouse("mousedown", outside);
    });

    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onOutsideClick when mousedown is inside the ref", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, inside } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick));

    act(() => {
      dispatchMouse("mousedown", inside);
    });

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("does not call onOutsideClick when mousedown is on a child of the ref", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, child } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick));

    act(() => {
      dispatchMouse("mousedown", child);
    });

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("does not call onOutsideClick when enabled is false", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick, { enabled: false }));

    act(() => {
      dispatchMouse("mousedown", outside);
    });

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("picks up enabled changes without rebinding (via ref)", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    const { rerender } = renderHook(({ enabled }: { enabled: boolean }) => useClickOutside(insideRef, onOutsideClick, { enabled }), {
      initialProps: { enabled: false },
    });

    act(() => {
      dispatchMouse("mousedown", outside);
    });
    expect(onOutsideClick).not.toHaveBeenCalled();

    rerender({ enabled: true });
    act(() => {
      dispatchMouse("mousedown", outside);
    });
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("uses the latest onOutsideClick without rebinding", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { insideRef, outside } = setupDom();

    const { rerender } = renderHook(({ handler }: { handler: () => void }) => useClickOutside(insideRef, handler), { initialProps: { handler: first } });

    act(() => {
      dispatchMouse("mousedown", outside);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).not.toHaveBeenCalled();

    rerender({ handler: second });
    act(() => {
      dispatchMouse("mousedown", outside);
    });
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("listens for click when event option is click", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick, { event: "click" }));

    act(() => {
      dispatchMouse("mousedown", outside);
    });
    expect(onOutsideClick).not.toHaveBeenCalled();

    act(() => {
      dispatchMouse("click", outside);
    });
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });

  it("defaults to mousedown (ignores click-only events)", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    renderHook(() => useClickOutside(insideRef, onOutsideClick));

    act(() => {
      dispatchMouse("click", outside);
    });
    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("does nothing when ref.current is null", () => {
    const onOutsideClick = jest.fn();
    const nullRef = createRef<HTMLDivElement>();
    outside = document.createElement("div");
    document.body.appendChild(outside);

    renderHook(() => useClickOutside(nullRef, onOutsideClick));

    act(() => {
      dispatchMouse("mousedown", outside);
    });

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("removes the listener on unmount", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    const { unmount } = renderHook(() => useClickOutside(insideRef, onOutsideClick));
    unmount();

    act(() => {
      dispatchMouse("mousedown", outside);
    });

    expect(onOutsideClick).not.toHaveBeenCalled();
  });

  it("switches event type when the option changes", () => {
    const onOutsideClick = jest.fn();
    const { insideRef, outside } = setupDom();

    const { rerender } = renderHook(({ event }: { event: "mousedown" | "click" }) => useClickOutside(insideRef, onOutsideClick, { event }), {
      initialProps: { event: "mousedown" as "mousedown" | "click" },
    });

    act(() => {
      dispatchMouse("click", outside);
    });
    expect(onOutsideClick).not.toHaveBeenCalled();

    rerender({ event: "click" });
    act(() => {
      dispatchMouse("click", outside);
    });
    expect(onOutsideClick).toHaveBeenCalledTimes(1);

    act(() => {
      dispatchMouse("mousedown", outside);
    });
    // Still only the one click-handler invocation
    expect(onOutsideClick).toHaveBeenCalledTimes(1);
  });
});
