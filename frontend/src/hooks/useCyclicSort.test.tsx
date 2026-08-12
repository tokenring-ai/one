import { describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useCyclicSort } from "./useCyclicSort.ts";

describe("useCyclicSort", () => {
  it("starts with no sort", () => {
    const { result } = renderHook(() => useCyclicSort());
    expect(result.current.orderBy).toEqual([]);
    expect(result.current.sortedColumn).toBeNull();
    expect(result.current.sortedDirection).toBeNull();
    expect(result.current.getDirection("name")).toBeNull();
  });

  it("cycles no sort → asc → desc → no sort for the same column", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.orderBy).toEqual([{ column: "name", direction: "asc" }]);
    expect(result.current.sortedColumn).toBe("name");
    expect(result.current.sortedDirection).toBe("asc");
    expect(result.current.getDirection("name")).toBe("asc");

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.orderBy).toEqual([{ column: "name", direction: "desc" }]);
    expect(result.current.sortedColumn).toBe("name");
    expect(result.current.sortedDirection).toBe("desc");
    expect(result.current.getDirection("name")).toBe("desc");

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.orderBy).toEqual([]);
    expect(result.current.sortedColumn).toBeNull();
    expect(result.current.sortedDirection).toBeNull();
    expect(result.current.getDirection("name")).toBeNull();
  });

  it("replaces the current sort when a different column is clicked", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.orderBy).toEqual([{ column: "name", direction: "asc" }]);

    act(() => {
      result.current.handleSort("id");
    });
    expect(result.current.orderBy).toEqual([{ column: "id", direction: "asc" }]);
    expect(result.current.sortedColumn).toBe("id");
    expect(result.current.getDirection("name")).toBeNull();
    expect(result.current.getDirection("id")).toBe("asc");
  });

  it("replaces desc sort on a different column with asc on the new column", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
      result.current.handleSort("name");
    });
    expect(result.current.orderBy).toEqual([{ column: "name", direction: "desc" }]);

    act(() => {
      result.current.handleSort("email");
    });
    expect(result.current.orderBy).toEqual([{ column: "email", direction: "asc" }]);
  });

  it("clearSort removes the active sort", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
      result.current.clearSort();
    });
    expect(result.current.orderBy).toEqual([]);
    expect(result.current.sortedColumn).toBeNull();
    expect(result.current.sortedDirection).toBeNull();
  });

  it("invokes onSortChange when sort cycles", () => {
    const onSortChange = mock(() => {});
    const { result } = renderHook(() => useCyclicSort({ onSortChange }));

    act(() => {
      result.current.handleSort("name");
    });
    expect(onSortChange).toHaveBeenCalledTimes(1);

    act(() => {
      result.current.handleSort("name");
    });
    expect(onSortChange).toHaveBeenCalledTimes(2);

    act(() => {
      result.current.handleSort("name");
    });
    expect(onSortChange).toHaveBeenCalledTimes(3);
  });

  it("invokes onSortChange when clearSort is called", () => {
    const onSortChange = mock(() => {});
    const { result } = renderHook(() => useCyclicSort({ onSortChange }));

    act(() => {
      result.current.handleSort("name");
    });
    onSortChange.mockClear();

    act(() => {
      result.current.clearSort();
    });
    expect(onSortChange).toHaveBeenCalledTimes(1);
  });

  it("works without onSortChange", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
      result.current.clearSort();
    });
    expect(result.current.orderBy).toEqual([]);
  });

  it("getDirection only reflects the sorted column", () => {
    const { result } = renderHook(() => useCyclicSort());

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.getDirection("name")).toBe("asc");
    expect(result.current.getDirection("id")).toBeNull();
    expect(result.current.getDirection("other")).toBeNull();
  });

  it("keeps handleSort and clearSort identities stable even when onSortChange changes", () => {
    const { result, rerender } = renderHook(({ onSortChange }: { onSortChange: () => void }) => useCyclicSort({ onSortChange }), {
      initialProps: { onSortChange: () => {} },
    });

    const firstHandleSort = result.current.handleSort;
    const firstClearSort = result.current.clearSort;

    act(() => {
      result.current.handleSort("name");
    });
    rerender({ onSortChange: () => {} });

    expect(result.current.handleSort).toBe(firstHandleSort);
    expect(result.current.clearSort).toBe(firstClearSort);
  });

  it("calls the latest onSortChange after the option is replaced", () => {
    const first = mock(() => {});
    const second = mock(() => {});
    const { result, rerender } = renderHook(({ onSortChange }: { onSortChange: () => void }) => useCyclicSort({ onSortChange }), {
      initialProps: { onSortChange: first },
    });

    rerender({ onSortChange: second });
    act(() => {
      result.current.handleSort("name");
    });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it("updates getDirection identity when orderBy changes", () => {
    const { result } = renderHook(() => useCyclicSort());
    const getDirectionBefore = result.current.getDirection;

    act(() => {
      result.current.handleSort("name");
    });
    expect(result.current.getDirection).not.toBe(getDirectionBefore);
    expect(result.current.getDirection("name")).toBe("asc");
  });
});
