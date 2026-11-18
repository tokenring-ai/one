import { afterEach, beforeEach, describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useSearchFilter } from "./useSearchFilter.ts";

type Item = {
  id: string;
  name: string;
  tags?: string[];
  busy?: boolean;
};

const ITEMS: Item[] = [
  { id: "1", name: "Alpha", tags: ["red"], busy: true },
  { id: "2", name: "Beta", tags: ["blue"], busy: false },
  { id: "3", name: "Gamma", tags: ["red", "green"], busy: true },
  { id: "4", name: "Delta", tags: [], busy: false },
];

function searchFields(item: Item): string {
  return `${item.name} ${(item.tags ?? []).join(" ")}`;
}

describe("useSearchFilter", () => {
  it("returns all items when the query is empty", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    expect(result.current.filtered).toEqual(ITEMS);
    expect(result.current.query).toBe("");
    expect(result.current.isActive).toBe(false);
    expect(result.current.matchCount).toBe(4);
  });

  it("filters by searchFields case-insensitively", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    act(() => {
      result.current.setQuery("alp");
    });

    expect(result.current.filtered.map(i => i.name)).toEqual(["Alpha"]);
    expect(result.current.isActive).toBe(true);
    expect(result.current.matchCount).toBe(1);
  });

  it("matches across joined fields", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    act(() => {
      result.current.setQuery("green");
    });

    expect(result.current.filtered.map(i => i.name)).toEqual(["Gamma"]);
  });

  it("trims the query before matching", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    act(() => {
      result.current.setQuery("  beta  ");
    });

    expect(result.current.filtered.map(i => i.name)).toEqual(["Beta"]);
    expect(result.current.isActive).toBe(true);
  });

  it("applies an optional predicate alongside search", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
        predicate: item => item.busy === true,
      }),
    );

    expect(result.current.filtered.map(i => i.name)).toEqual(["Alpha", "Gamma"]);
    expect(result.current.matchCount).toBe(2);

    act(() => {
      result.current.setQuery("a");
    });

    // Alpha and Gamma both contain "a" and are busy; Delta/Beta excluded by predicate
    expect(result.current.filtered.map(i => i.name)).toEqual(["Alpha", "Gamma"]);
  });

  it("predicate can exclude all items even with empty query", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
        predicate: () => false,
      }),
    );

    expect(result.current.filtered).toEqual([]);
    expect(result.current.matchCount).toBe(0);
    expect(result.current.isActive).toBe(false);
  });

  it("clear resets the query and restores the full list", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    act(() => {
      result.current.setQuery("beta");
    });
    expect(result.current.filtered).toHaveLength(1);

    act(() => {
      result.current.clear();
    });

    expect(result.current.query).toBe("");
    expect(result.current.isActive).toBe(false);
    expect(result.current.filtered).toEqual(ITEMS);
  });

  it("recomputes when items change", () => {
    const { result, rerender } = renderHook(({ items }) => useSearchFilter({ items, searchFields }), {
      initialProps: { items: ITEMS },
    });

    act(() => {
      result.current.setQuery("alpha");
    });
    expect(result.current.filtered).toHaveLength(1);

    rerender({ items: ITEMS.slice(1) });
    expect(result.current.filtered).toHaveLength(0);
    expect(result.current.query).toBe("alpha");
  });

  it("isActive is false for whitespace-only query", () => {
    const { result } = renderHook(() =>
      useSearchFilter({
        items: ITEMS,
        searchFields,
      }),
    );

    act(() => {
      result.current.setQuery("   ");
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.filtered).toEqual(ITEMS);
  });

  describe("debounce", () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it("filters immediately when debounceMs is 0 (default)", () => {
      const { result } = renderHook(() =>
        useSearchFilter({
          items: ITEMS,
          searchFields,
        }),
      );

      act(() => {
        result.current.setQuery("beta");
      });

      // No timer advance needed — instant path
      expect(result.current.filtered.map(i => i.name)).toEqual(["Beta"]);
      expect(result.current.query).toBe("beta");
    });

    it("delays filtering when debounceMs > 0 while query updates immediately", () => {
      const { result } = renderHook(() =>
        useSearchFilter({
          items: ITEMS,
          searchFields,
          debounceMs: 300,
        }),
      );

      act(() => {
        result.current.setQuery("beta");
      });

      expect(result.current.query).toBe("beta");
      expect(result.current.isActive).toBe(true);
      // Still showing unfiltered until debounce elapses
      expect(result.current.filtered).toEqual(ITEMS);

      act(() => {
        jest.advanceTimersByTime(299);
      });
      expect(result.current.filtered).toEqual(ITEMS);

      act(() => {
        jest.advanceTimersByTime(1);
      });
      expect(result.current.filtered.map(i => i.name)).toEqual(["Beta"]);
    });

    it("resets the debounce timer on rapid typing", () => {
      const { result } = renderHook(() =>
        useSearchFilter({
          items: ITEMS,
          searchFields,
          debounceMs: 200,
        }),
      );

      act(() => {
        result.current.setQuery("b");
      });
      act(() => {
        jest.advanceTimersByTime(150);
      });
      act(() => {
        result.current.setQuery("be");
      });
      act(() => {
        jest.advanceTimersByTime(150);
      });
      expect(result.current.filtered).toEqual(ITEMS);

      act(() => {
        jest.advanceTimersByTime(50);
      });
      expect(result.current.filtered.map(i => i.name)).toEqual(["Beta"]);
    });
  });
});
