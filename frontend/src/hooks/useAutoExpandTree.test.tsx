import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useState } from "react";
import { useAutoExpandTree } from "./useAutoExpandTree.ts";

interface Node {
  name: string;
  count: number;
}

const getKey = (n: Node) => n.name;
const getCount = (n: Node) => n.count;

describe("useAutoExpandTree", () => {
  it("starts with no expanded keys", () => {
    const { result } = renderHook(() =>
      useAutoExpandTree({
        items: [{ name: "a", count: 1 }],
        getKey,
        getCount,
        agentId: null,
      }),
    );
    expect(result.current.expandedKeys.size).toBe(0);
    expect(result.current.isExpanded("a")).toBe(false);
  });

  it("does not auto-expand when agentId is null", () => {
    const items = [{ name: "a", count: 2 }];
    const { result } = renderHook(() =>
      useAutoExpandTree({
        items,
        getKey,
        getCount,
        agentId: null,
      }),
    );
    expect(result.current.isExpanded("a")).toBe(false);
  });

  it("auto-expands nodes with count > 0 when an agent is active", () => {
    const items = [
      { name: "a", count: 1 },
      { name: "b", count: 0 },
      { name: "c", count: 3 },
    ];
    const { result } = renderHook(() =>
      useAutoExpandTree({
        items,
        getKey,
        getCount,
        agentId: "agent-1",
      }),
    );
    expect(result.current.isExpanded("a")).toBe(true);
    expect(result.current.isExpanded("b")).toBe(false);
    expect(result.current.isExpanded("c")).toBe(true);
  });

  it("auto-expands newly qualifying nodes when items update while agent runs", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) => useAutoExpandTree({ items, getKey, getCount, agentId }),
      { initialProps: { items: [{ name: "a", count: 0 }], agentId: "agent-1" as string | null } },
    );

    expect(result.current.isExpanded("a")).toBe(false);

    rerender({ items: [{ name: "a", count: 1 }], agentId: "agent-1" });
    expect(result.current.isExpanded("a")).toBe(true);
  });

  it("stops auto-expanding when agentId becomes null", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) => useAutoExpandTree({ items, getKey, getCount, agentId }),
      {
        initialProps: {
          items: [{ name: "a", count: 1 }],
          agentId: "agent-1" as string | null,
        },
      },
    );
    expect(result.current.isExpanded("a")).toBe(true);

    act(() => {
      result.current.collapse("a");
    });
    expect(result.current.isExpanded("a")).toBe(false);

    // Agent gone — empty node gaining items must not re-open
    rerender({
      items: [
        { name: "a", count: 1 },
        { name: "b", count: 2 },
      ],
      agentId: null,
    });
    expect(result.current.isExpanded("a")).toBe(false);
    expect(result.current.isExpanded("b")).toBe(false);
  });

  it("toggle expands and collapses nodes", () => {
    const { result } = renderHook(() =>
      useAutoExpandTree({
        items: [],
        getKey,
        getCount,
        agentId: null,
      }),
    );

    act(() => {
      result.current.toggle("x");
    });
    expect(result.current.isExpanded("x")).toBe(true);

    act(() => {
      result.current.toggle("x");
    });
    expect(result.current.isExpanded("x")).toBe(false);
  });

  it("expand and collapse are non-toggling and idempotent", () => {
    const { result } = renderHook(() =>
      useAutoExpandTree({
        items: [],
        getKey,
        getCount,
        agentId: null,
      }),
    );

    act(() => {
      result.current.expand("a");
      result.current.expand("b");
    });
    expect(result.current.expandedKeys.size).toBe(2);

    const before = result.current.expandedKeys;
    act(() => {
      result.current.expand("a");
    });
    expect(result.current.expandedKeys).toBe(before);

    act(() => {
      result.current.collapse("a");
    });
    expect(result.current.isExpanded("a")).toBe(false);
    expect(result.current.isExpanded("b")).toBe(true);
  });

  it("respects user collapse when respectUserCollapse is true", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) =>
        useAutoExpandTree({
          items,
          getKey,
          getCount,
          agentId,
          respectUserCollapse: true,
        }),
      {
        initialProps: {
          items: [{ name: "topic", count: 1 }],
          agentId: "agent-1" as string | null,
        },
      },
    );

    expect(result.current.isExpanded("topic")).toBe(true);

    act(() => {
      result.current.toggle("topic"); // user collapses
    });
    expect(result.current.isExpanded("topic")).toBe(false);
    expect(result.current.userCollapsedKeys.has("topic")).toBe(true);

    // Agent creates more items — must not re-expand user-collapsed topic
    rerender({
      items: [{ name: "topic", count: 5 }],
      agentId: "agent-1",
    });
    expect(result.current.isExpanded("topic")).toBe(false);
  });

  it("does not track user collapse when respectUserCollapse is false", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) =>
        useAutoExpandTree({
          items,
          getKey,
          getCount,
          agentId,
          respectUserCollapse: false,
        }),
      {
        initialProps: {
          items: [{ name: "flow", count: 1 }],
          agentId: "agent-1" as string | null,
        },
      },
    );

    expect(result.current.isExpanded("flow")).toBe(true);

    act(() => {
      result.current.toggle("flow");
    });
    expect(result.current.isExpanded("flow")).toBe(false);
    expect(result.current.userCollapsedKeys.has("flow")).toBe(false);

    // Without respectUserCollapse, auto-expand re-opens when items update
    rerender({
      items: [{ name: "flow", count: 2 }],
      agentId: "agent-1",
    });
    expect(result.current.isExpanded("flow")).toBe(true);
  });

  it("expand clears a prior user-collapse mark so auto-expand can work again", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) =>
        useAutoExpandTree({
          items,
          getKey,
          getCount,
          agentId,
          respectUserCollapse: true,
        }),
      {
        initialProps: {
          items: [{ name: "t", count: 1 }],
          agentId: "agent-1" as string | null,
        },
      },
    );

    act(() => {
      result.current.collapse("t");
    });
    expect(result.current.userCollapsedKeys.has("t")).toBe(true);

    act(() => {
      result.current.expand("t");
    });
    expect(result.current.isExpanded("t")).toBe(true);
    expect(result.current.userCollapsedKeys.has("t")).toBe(false);

    act(() => {
      result.current.collapse("t");
    });
    // expand already cleared the mark; after collapse it's marked again
    expect(result.current.userCollapsedKeys.has("t")).toBe(true);

    // Explicit expand (e.g. route navigation) clears mark
    act(() => {
      result.current.expand("t");
    });
    act(() => {
      result.current.collapse("t");
    });
    act(() => {
      result.current.expand("t");
    });
    expect(result.current.userCollapsedKeys.has("t")).toBe(false);

    // After expand cleared mark, if user collapses again then expand again via route...
    act(() => {
      result.current.toggle("t"); // collapse + mark
    });
    act(() => {
      result.current.expand("t"); // route expand clears mark
    });
    act(() => {
      result.current.collapse("t");
    });
    // Now still marked from collapse; auto-expand should not re-open...
    // Wait - collapse marks it. Good.
    // Clear and verify expand clears:
    act(() => {
      result.current.expand("t");
    });
    act(() => {
      result.current.toggle("t"); // collapse + mark
    });
    expect(result.current.userCollapsedKeys.has("t")).toBe(true);
    act(() => {
      result.current.expand("t");
    });
    expect(result.current.userCollapsedKeys.has("t")).toBe(false);

    rerender({ items: [{ name: "t", count: 9 }], agentId: "agent-1" });
    // already expanded from expand(); stay expanded
    expect(result.current.isExpanded("t")).toBe(true);
  });

  it("does not collapse already-expanded nodes when auto-expand runs", () => {
    const { result, rerender } = renderHook(
      ({ items, agentId }: { items: Node[]; agentId: string | null }) => useAutoExpandTree({ items, getKey, getCount, agentId }),
      {
        initialProps: {
          items: [] as Node[],
          agentId: null as string | null,
        },
      },
    );

    act(() => {
      result.current.expand("manual");
    });
    expect(result.current.isExpanded("manual")).toBe(true);

    rerender({
      items: [
        { name: "manual", count: 0 },
        { name: "agent", count: 1 },
      ],
      agentId: "agent-1",
    });
    expect(result.current.isExpanded("manual")).toBe(true);
    expect(result.current.isExpanded("agent")).toBe(true);
  });

  it("merges into an external expanded set when provided", () => {
    function useHarness(items: Node[], agentId: string | null) {
      const [expanded, setExpanded] = useState<Set<string>>(() => new Set(["seed"]));
      const tree = useAutoExpandTree({
        items,
        getKey,
        getCount,
        agentId,
        externalExpandedSet: expanded,
        setExternalExpandedSet: setExpanded,
      });
      return tree;
    }

    const { result, rerender } = renderHook(({ items, agentId }: { items: Node[]; agentId: string | null }) => useHarness(items, agentId), {
      initialProps: {
        items: [{ name: "new", count: 1 }],
        agentId: "agent-1" as string | null,
      },
    });

    expect(result.current.isExpanded("seed")).toBe(true);
    expect(result.current.isExpanded("new")).toBe(true);

    act(() => {
      result.current.toggle("seed");
    });
    expect(result.current.isExpanded("seed")).toBe(false);

    // Rerender keeps external state; seed stays collapsed, new stays expanded
    rerender({
      items: [
        { name: "new", count: 2 },
        { name: "other", count: 1 },
      ],
      agentId: "agent-1",
    });
    expect(result.current.isExpanded("seed")).toBe(false);
    expect(result.current.isExpanded("new")).toBe(true);
    expect(result.current.isExpanded("other")).toBe(true);
  });
});
