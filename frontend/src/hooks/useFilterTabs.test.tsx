import { describe, expect, it } from "bun:test";
import { renderHook } from "@testing-library/react";
import { type FilterTabDefinition, useFilterTabs } from "./useFilterTabs.ts";

type Item = {
  id: string;
  name: string;
  enabled: boolean;
  status: "ok" | "failed" | "cancelled";
};

type StatusFilter = "all" | "enabled" | "disabled";
type ResultFilter = "all" | "ok" | "failed" | "cancelled";

const ITEMS: Item[] = [
  { id: "1", name: "Alpha", enabled: true, status: "ok" },
  { id: "2", name: "Beta", enabled: false, status: "failed" },
  { id: "3", name: "Gamma", enabled: true, status: "ok" },
  { id: "4", name: "Delta", enabled: false, status: "cancelled" },
];

const STATUS_DEFS: FilterTabDefinition<Item, StatusFilter>[] = [
  { id: "all", label: "All" },
  { id: "enabled", label: "Enabled", predicate: item => item.enabled },
  { id: "disabled", label: "Disabled", predicate: item => !item.enabled },
];

const RESULT_DEFS: FilterTabDefinition<Item, ResultFilter>[] = [
  { id: "all", label: "All" },
  { id: "ok", label: "Ok", predicate: item => item.status === "ok" },
  { id: "failed", label: "Failed", predicate: item => item.status === "failed" },
  { id: "cancelled", label: "Cancelled", predicate: item => item.status === "cancelled" },
];

describe("useFilterTabs", () => {
  it("counts all items when a definition has no predicate", () => {
    const { result } = renderHook(() => useFilterTabs(ITEMS, STATUS_DEFS));

    expect(result.current.tabs[0]).toEqual({ id: "all", label: "All", count: 4 });
  });

  it("counts items matching each predicate", () => {
    const { result } = renderHook(() => useFilterTabs(ITEMS, STATUS_DEFS));

    expect(result.current.tabs).toEqual([
      { id: "all", label: "All", count: 4 },
      { id: "enabled", label: "Enabled", count: 2 },
      { id: "disabled", label: "Disabled", count: 2 },
    ]);
  });

  it("returns zero counts for empty items", () => {
    const { result } = renderHook(() => useFilterTabs<Item, StatusFilter>([], STATUS_DEFS));

    expect(result.current.tabs.every(tab => tab.count === 0)).toBe(true);
    expect(result.current.tabs.map(tab => tab.id)).toEqual(["all", "enabled", "disabled"]);
  });

  it("supports multiple status predicates on the same list", () => {
    const { result } = renderHook(() => useFilterTabs(ITEMS, RESULT_DEFS));

    expect(result.current.tabs).toEqual([
      { id: "all", label: "All", count: 4 },
      { id: "ok", label: "Ok", count: 2 },
      { id: "failed", label: "Failed", count: 1 },
      { id: "cancelled", label: "Cancelled", count: 1 },
    ]);
  });

  it("recomputes counts when items change", () => {
    const { result, rerender } = renderHook(({ items }) => useFilterTabs(items, STATUS_DEFS), {
      initialProps: { items: ITEMS },
    });

    expect(result.current.tabs.find(tab => tab.id === "enabled")?.count).toBe(2);

    const nextItems = ITEMS.map(item => ({ ...item, enabled: true }));
    rerender({ items: nextItems });

    expect(result.current.tabs).toEqual([
      { id: "all", label: "All", count: 4 },
      { id: "enabled", label: "Enabled", count: 4 },
      { id: "disabled", label: "Disabled", count: 0 },
    ]);
  });

  it("recomputes when definitions change", () => {
    const narrowDefs: FilterTabDefinition<Item, "all" | "enabled">[] = [
      { id: "all", label: "All" },
      { id: "enabled", label: "Enabled only", predicate: item => item.enabled },
    ];

    const { result, rerender } = renderHook(({ definitions }) => useFilterTabs(ITEMS, definitions), {
      initialProps: { definitions: STATUS_DEFS as FilterTabDefinition<Item, string>[] },
    });

    expect(result.current.tabs).toHaveLength(3);

    rerender({ definitions: narrowDefs });

    expect(result.current.tabs).toEqual([
      { id: "all", label: "All", count: 4 },
      { id: "enabled", label: "Enabled only", count: 2 },
    ]);
  });

  it("preserves definition order and labels", () => {
    const { result } = renderHook(() => useFilterTabs(ITEMS, RESULT_DEFS));

    expect(result.current.tabs.map(tab => tab.label)).toEqual(["All", "Ok", "Failed", "Cancelled"]);
  });
});
