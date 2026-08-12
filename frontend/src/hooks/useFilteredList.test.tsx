import { describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { type ListFieldConfig, useFilteredList } from "./useFilteredList.ts";

type Item = {
  id: string;
  name: string;
  category: string;
  score: number;
};

const ITEMS: Item[] = [
  { id: "1", name: "Alpha", category: "a", score: 3 },
  { id: "2", name: "Beta", category: "b", score: 1 },
  { id: "3", name: "Gamma", category: "a", score: 2 },
  { id: "4", name: "Delta", category: "b", score: 4 },
];

const sortFields: ListFieldConfig<Item>[] = [
  { key: "name", label: "Name", compare: (a, b) => a.name.localeCompare(b.name) },
  { key: "score", label: "Score", compare: (a, b) => a.score - b.score },
];

function matchesSearch(item: Item, query: string): boolean {
  return item.name.toLowerCase().includes(query) || item.category.toLowerCase().includes(query);
}

function filterPredicate(item: Item, filterValue: string): boolean {
  return filterValue === "all" || item.category === filterValue;
}

function createOptions(overrides: Partial<Parameters<typeof useFilteredList<Item>>[0]> = {}) {
  return {
    items: ITEMS,
    matchesSearch,
    filterPredicate,
    sortFields,
    defaultSort: "name",
    defaultFilter: "all",
    ...overrides,
  };
}

describe("useFilteredList", () => {
  it("returns all items sorted by the default sort field", () => {
    const { result } = renderHook(() => useFilteredList(createOptions()));

    expect(result.current.items.map(i => i.name)).toEqual(["Alpha", "Beta", "Delta", "Gamma"]);
    expect(result.current.sort).toBe("name");
    expect(result.current.filter).toBe("all");
    expect(result.current.search).toBe("");
    expect(result.current.matchedCount).toBe(4);
    expect(result.current.filterCount).toBe(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("defaults sort to the first sort field when defaultSort is omitted", () => {
    const { result } = renderHook(() =>
      useFilteredList({
        items: ITEMS,
        matchesSearch,
        filterPredicate,
        sortFields,
        defaultFilter: "all",
      }),
    );

    expect(result.current.sort).toBe("name");
  });

  it("defaults sort to empty string when sortFields is empty", () => {
    const { result } = renderHook(() =>
      useFilteredList({
        items: ITEMS,
        matchesSearch,
        filterPredicate,
        sortFields: [],
        defaultFilter: "all",
      }),
    );

    expect(result.current.sort).toBe("");
    expect(result.current.items.map(i => i.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("filters by search query (case-insensitive, trimmed)", () => {
    const { result } = renderHook(() => useFilteredList(createOptions()));

    act(() => {
      result.current.setSearch("  GAM  ");
    });

    expect(result.current.items.map(i => i.name)).toEqual(["Gamma"]);
    expect(result.current.matchedCount).toBe(1);
    expect(result.current.hasActiveFilters).toBe(true);
    // filterCount is before search
    expect(result.current.filterCount).toBe(4);
  });

  it("does not call matchesSearch when query is empty after trim", () => {
    let matchCalls = 0;
    const { result } = renderHook(() =>
      useFilteredList(
        createOptions({
          matchesSearch: (item, query) => {
            matchCalls += 1;
            return matchesSearch(item, query);
          },
        }),
      ),
    );

    act(() => {
      result.current.setSearch("   ");
    });

    expect(matchCalls).toBe(0);
    expect(result.current.matchedCount).toBe(4);
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("applies filterPredicate before search", () => {
    const { result } = renderHook(() => useFilteredList(createOptions()));

    act(() => {
      result.current.setFilter("a");
      result.current.setSearch("a"); // matches Alpha, Gamma, and Delta (category b) by name
    });

    // Only category "a" items that match "a": Alpha and Gamma (Delta filtered out by category)
    expect(result.current.items.map(i => i.name)).toEqual(["Alpha", "Gamma"]);
    expect(result.current.filterCount).toBe(2);
    expect(result.current.matchedCount).toBe(2);
  });

  it("skips filter when filterPredicate is omitted", () => {
    const { result } = renderHook(() =>
      useFilteredList({
        items: ITEMS,
        matchesSearch,
        sortFields,
        defaultSort: "name",
        defaultFilter: "all",
      }),
    );

    act(() => {
      result.current.setFilter("ignored");
    });

    expect(result.current.filterCount).toBe(4);
    expect(result.current.matchedCount).toBe(4);
    // Non-default filter still counts as active even without a predicate
    expect(result.current.hasActiveFilters).toBe(true);
  });

  it("sorts by the selected sort field", () => {
    const { result } = renderHook(() => useFilteredList(createOptions()));

    act(() => {
      result.current.setSort("score");
    });

    expect(result.current.items.map(i => i.name)).toEqual(["Beta", "Gamma", "Alpha", "Delta"]);
  });

  it("leaves order unchanged when sort key is unknown", () => {
    const { result } = renderHook(() =>
      useFilteredList(
        createOptions({
          defaultSort: "missing",
        }),
      ),
    );

    // No sort applied — source order preserved
    expect(result.current.items.map(i => i.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("clearFilters resets search and filter to defaults", () => {
    const { result } = renderHook(() => useFilteredList(createOptions({ defaultFilter: "all" })));

    act(() => {
      result.current.setSearch("alpha");
      result.current.setFilter("a");
      result.current.setSort("score");
    });

    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });

    expect(result.current.search).toBe("");
    expect(result.current.filter).toBe("all");
    // Sort is intentionally preserved
    expect(result.current.sort).toBe("score");
    expect(result.current.hasActiveFilters).toBe(false);
    expect(result.current.items.map(i => i.name)).toEqual(["Beta", "Gamma", "Alpha", "Delta"]);
  });

  it("uses custom defaultFilter for hasActiveFilters and clearFilters", () => {
    const { result } = renderHook(() =>
      useFilteredList(
        createOptions({
          defaultFilter: "a",
        }),
      ),
    );

    expect(result.current.filter).toBe("a");
    expect(result.current.filterCount).toBe(2);
    expect(result.current.hasActiveFilters).toBe(false);

    act(() => {
      result.current.setFilter("b");
    });
    expect(result.current.hasActiveFilters).toBe(true);

    act(() => {
      result.current.clearFilters();
    });
    expect(result.current.filter).toBe("a");
    expect(result.current.hasActiveFilters).toBe(false);
  });

  it("recomputes when the source items change", () => {
    const { result, rerender } = renderHook(({ items }) => useFilteredList(createOptions({ items })), { initialProps: { items: ITEMS } });

    act(() => {
      result.current.setSearch("alpha");
    });
    expect(result.current.matchedCount).toBe(1);

    const nextItems = ITEMS.filter(i => i.id !== "1");
    rerender({ items: nextItems });
    expect(result.current.matchedCount).toBe(0);
    expect(result.current.filterCount).toBe(3);
  });

  it("does not mutate the source items array when sorting", () => {
    const source = [...ITEMS];
    const originalOrder = source.map(i => i.id);
    const { result } = renderHook(() => useFilteredList(createOptions({ items: source })));

    act(() => {
      result.current.setSort("score");
    });

    expect(source.map(i => i.id)).toEqual(originalOrder);
    expect(result.current.items.map(i => i.id)).not.toEqual(originalOrder);
  });
});
