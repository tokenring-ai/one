import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useExpandedSet } from "./useExpandedSet.ts";

describe("useExpandedSet", () => {
  it("starts with an empty set", () => {
    const { result } = renderHook(() => useExpandedSet());
    expect(result.current.expandedIds.size).toBe(0);
    expect(result.current.isExpanded("a")).toBe(false);
  });

  it("toggles items in and out of the set", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.toggle("a");
    });
    expect(result.current.isExpanded("a")).toBe(true);
    expect(result.current.expandedIds.has("a")).toBe(true);

    act(() => {
      result.current.toggle("a");
    });
    expect(result.current.isExpanded("a")).toBe(false);
    expect(result.current.expandedIds.has("a")).toBe(false);
  });

  it("supports multiple simultaneously expanded items", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.toggle("a");
      result.current.toggle("b");
    });
    expect(result.current.isExpanded("a")).toBe(true);
    expect(result.current.isExpanded("b")).toBe(true);
    expect(result.current.expandedIds.size).toBe(2);
  });

  it("expands a single item without affecting others", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.toggle("a");
      result.current.expand("b");
    });
    expect(result.current.isExpanded("a")).toBe(true);
    expect(result.current.isExpanded("b")).toBe(true);

    // expand is a no-op when already expanded
    const before = result.current.expandedIds;
    act(() => {
      result.current.expand("b");
    });
    expect(result.current.expandedIds).toBe(before);
  });

  it("collapses a single item without affecting others", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.expandAll(["a", "b", "c"]);
      result.current.collapse("b");
    });
    expect(result.current.isExpanded("a")).toBe(true);
    expect(result.current.isExpanded("b")).toBe(false);
    expect(result.current.isExpanded("c")).toBe(true);

    // collapse is a no-op when not expanded
    const before = result.current.expandedIds;
    act(() => {
      result.current.collapse("b");
    });
    expect(result.current.expandedIds).toBe(before);
  });

  it("expandAll replaces the entire set", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.toggle("old");
      result.current.expandAll(["x", "y"]);
    });
    expect(result.current.isExpanded("old")).toBe(false);
    expect(result.current.isExpanded("x")).toBe(true);
    expect(result.current.isExpanded("y")).toBe(true);
    expect(result.current.expandedIds.size).toBe(2);
  });

  it("collapseAll clears all expanded items", () => {
    const { result } = renderHook(() => useExpandedSet());

    act(() => {
      result.current.expandAll(["a", "b"]);
      result.current.collapseAll();
    });
    expect(result.current.expandedIds.size).toBe(0);
    expect(result.current.isExpanded("a")).toBe(false);
  });

  it("resets when resetKey changes", () => {
    const { result, rerender } = renderHook(({ resetKey }) => useExpandedSet({ resetKey }), {
      initialProps: { resetKey: "queue-a" },
    });

    act(() => {
      result.current.expandAll(["item-1", "item-2"]);
    });
    expect(result.current.expandedIds.size).toBe(2);

    rerender({ resetKey: "queue-b" });
    expect(result.current.expandedIds.size).toBe(0);
    expect(result.current.isExpanded("item-1")).toBe(false);
  });

  it("does not reset when resetKey stays the same", () => {
    const { result, rerender } = renderHook(({ resetKey }) => useExpandedSet({ resetKey }), {
      initialProps: { resetKey: "same" },
    });

    act(() => {
      result.current.toggle("a");
    });
    expect(result.current.isExpanded("a")).toBe(true);

    rerender({ resetKey: "same" });
    expect(result.current.isExpanded("a")).toBe(true);
  });

  it("keeps toggle/expand/collapse/expandAll/collapseAll callback identities stable", () => {
    const { result, rerender } = renderHook(() => useExpandedSet());

    const first = {
      toggle: result.current.toggle,
      expand: result.current.expand,
      collapse: result.current.collapse,
      expandAll: result.current.expandAll,
      collapseAll: result.current.collapseAll,
    };

    act(() => {
      result.current.toggle("a");
    });
    rerender();

    expect(result.current.toggle).toBe(first.toggle);
    expect(result.current.expand).toBe(first.expand);
    expect(result.current.collapse).toBe(first.collapse);
    expect(result.current.expandAll).toBe(first.expandAll);
    expect(result.current.collapseAll).toBe(first.collapseAll);
  });

  it("updates isExpanded when the set changes", () => {
    const { result } = renderHook(() => useExpandedSet());
    const isExpandedBefore = result.current.isExpanded;

    act(() => {
      result.current.toggle("a");
    });
    // isExpanded closes over expandedIds, so identity changes with the set
    expect(result.current.isExpanded).not.toBe(isExpandedBefore);
    expect(result.current.isExpanded("a")).toBe(true);
  });
});
