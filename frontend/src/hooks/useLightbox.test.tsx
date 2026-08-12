import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useLightbox } from "./useLightbox.ts";

function dispatchEscape() {
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
}

describe("useLightbox", () => {
  it("starts closed", () => {
    const { result } = renderHook(() => useLightbox());
    expect(result.current.isOpen).toBe(false);
  });

  it("open, close, and toggle control isOpen", () => {
    const { result } = renderHook(() => useLightbox());

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.close();
    });
    expect(result.current.isOpen).toBe(false);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.toggle();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("closes on Escape when open", () => {
    const { result } = renderHook(() => useLightbox());

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      dispatchEscape();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("does not listen for Escape when closed", () => {
    const { result } = renderHook(() => useLightbox());
    expect(result.current.isOpen).toBe(false);

    act(() => {
      dispatchEscape();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("ignores Escape when blocked", () => {
    const { result, rerender } = renderHook(({ blocked }: { blocked: boolean }) => useLightbox({ blocked }), {
      initialProps: { blocked: true },
    });

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      dispatchEscape();
    });
    expect(result.current.isOpen).toBe(true);

    rerender({ blocked: false });
    act(() => {
      dispatchEscape();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("auto-closes when itemKey changes while open", () => {
    const { result, rerender } = renderHook(({ itemKey }: { itemKey: string }) => useLightbox({ itemKey }), {
      initialProps: { itemKey: "a.png" },
    });

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    rerender({ itemKey: "b.png" });
    expect(result.current.isOpen).toBe(false);
  });

  it("does not open when itemKey changes while closed", () => {
    const { result, rerender } = renderHook(({ itemKey }: { itemKey: string }) => useLightbox({ itemKey }), {
      initialProps: { itemKey: "a.png" },
    });

    expect(result.current.isOpen).toBe(false);
    rerender({ itemKey: "b.png" });
    expect(result.current.isOpen).toBe(false);
  });

  it("does not auto-close when itemKey is undefined", () => {
    // exactOptionalPropertyTypes: omit itemKey rather than passing undefined
    type Props = { itemKey?: string };
    const { result, rerender } = renderHook(({ itemKey }: Props) => useLightbox(itemKey !== undefined ? { itemKey } : {}), {
      initialProps: {} satisfies Props,
    });

    act(() => {
      result.current.open();
    });
    expect(result.current.isOpen).toBe(true);

    // Still no key — no key tracking
    rerender({});
    expect(result.current.isOpen).toBe(true);

    // First time a key appears should not force-close (prev was undefined)
    // Spec: only close when prevKey !== itemKey AND itemKey is defined and isOpen.
    // undefined -> "a.png" means prev !== itemKey and isOpen, so it WILL close.
    // That matches "item changed" semantics.
    rerender({ itemKey: "a.png" });
    expect(result.current.isOpen).toBe(false);
  });

  it("removes Escape listener on unmount", () => {
    const { result, unmount } = renderHook(() => useLightbox());

    act(() => {
      result.current.open();
    });
    unmount();

    // Should not throw after unmount
    act(() => {
      dispatchEscape();
    });
  });

  it("stable open/close/toggle identity across re-renders", () => {
    const { result, rerender } = renderHook(() => useLightbox({ itemKey: "x" }));
    const { open, close, toggle } = result.current;

    rerender();
    expect(result.current.open).toBe(open);
    expect(result.current.close).toBe(close);
    expect(result.current.toggle).toBe(toggle);
  });
});
