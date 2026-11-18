import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";

const toastSuccess = mock((_message: string, _opts?: { duration?: number }) => "id");
const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: {
    success: toastSuccess,
    error: toastError,
    warning: mock(),
    info: mock(),
    remove: mock(),
  },
}));

void mock.module("@tokenring-ai/utility/error/formatError", () => ({
  default: (error: unknown) => (error instanceof Error ? error.message : String(error)),
}));

const { useEntityDelete } = await import("./useEntityDelete.ts");

describe("useEntityDelete", () => {
  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  afterEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
  });

  function setup(overrides?: Partial<Parameters<typeof useEntityDelete<string>>[0]>) {
    const navigateToOverview = mock(() => {});
    const refreshList = mock(() => {});
    const clearLocalState = mock((_id: string) => {});

    const { result } = renderHook(() =>
      useEntityDelete({
        currentRouteId: "entity-1",
        navigateToOverview,
        refreshList,
        clearLocalState,
        ...overrides,
      }),
    );

    return { result, navigateToOverview, refreshList, clearLocalState };
  }

  it("starts idle with no deleting id", () => {
    const { result } = setup();
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.deletingId).toBeNull();
  });

  it("deletes the current route entity: clear → navigate → toast → refresh", async () => {
    const { result, navigateToOverview, refreshList, clearLocalState } = setup();
    const deleteFn = mock(async () => {});
    const order: string[] = [];

    clearLocalState.mockImplementation(() => {
      order.push("clear");
    });
    navigateToOverview.mockImplementation(() => {
      order.push("navigate");
    });
    toastSuccess.mockImplementation(() => {
      order.push("toast");
      return "id";
    });
    refreshList.mockImplementation(() => {
      order.push("refresh");
    });

    await act(async () => {
      await result.current.deleteEntity("entity-1", "My Entity", deleteFn);
    });

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(order).toEqual(["clear", "navigate", "toast", "refresh"]);
    expect(toastSuccess).toHaveBeenCalledWith('Deleted "My Entity"', { duration: 3000 });
    expect(toastError).not.toHaveBeenCalled();
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.deletingId).toBeNull();
  });

  it("does not navigate when deleting a non-current entity", async () => {
    const { result, navigateToOverview, refreshList, clearLocalState } = setup({
      currentRouteId: "other",
    });

    await act(async () => {
      await result.current.deleteEntity("entity-1", "My Entity", async () => {});
    });

    expect(clearLocalState).toHaveBeenCalledWith("entity-1");
    expect(navigateToOverview).not.toHaveBeenCalled();
    expect(refreshList).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("does not navigate when currentRouteId is null", async () => {
    const { result, navigateToOverview } = setup({ currentRouteId: null });

    await act(async () => {
      await result.current.deleteEntity("entity-1", "My Entity", async () => {});
    });

    expect(navigateToOverview).not.toHaveBeenCalled();
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("shows error toast and skips navigate/refresh/clear on failure", async () => {
    const { result, navigateToOverview, refreshList, clearLocalState } = setup();

    await act(async () => {
      await result.current.deleteEntity("entity-1", "My Entity", async () => {
        throw new Error("boom");
      });
    });

    expect(toastError).toHaveBeenCalledWith("boom", { duration: 5000 });
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(clearLocalState).not.toHaveBeenCalled();
    expect(navigateToOverview).not.toHaveBeenCalled();
    expect(refreshList).not.toHaveBeenCalled();
    expect(result.current.deletingId).toBeNull();
    expect(result.current.isDeleting).toBe(false);
  });

  it("respects custom messages and durations", async () => {
    const { result } = setup({
      successMessage: name => `Workflow "${name}" deleted`,
      errorMessage: err => `Delete failed: ${err instanceof Error ? err.message : String(err)}`,
      successDuration: 2000,
      errorDuration: 4000,
    });

    await act(async () => {
      await result.current.deleteEntity("wf", "wf", async () => {});
    });
    expect(toastSuccess).toHaveBeenCalledWith('Workflow "wf" deleted', { duration: 2000 });

    await act(async () => {
      await result.current.deleteEntity("wf2", "wf2", async () => {
        throw new Error("nope");
      });
    });
    expect(toastError).toHaveBeenCalledWith("Delete failed: nope", { duration: 4000 });
  });

  it("sets deletingId while the delete is in flight", async () => {
    const { result } = setup();
    let resolveDelete!: () => void;
    const deletePromise = new Promise<void>(resolve => {
      resolveDelete = resolve;
    });

    let pending!: Promise<void>;
    act(() => {
      pending = result.current.deleteEntity("entity-1", "My Entity", () => deletePromise);
    });

    expect(result.current.isDeleting).toBe(true);
    expect(result.current.deletingId).toBe("entity-1");

    await act(async () => {
      resolveDelete();
      await pending;
    });

    expect(result.current.isDeleting).toBe(false);
    expect(result.current.deletingId).toBeNull();
  });

  it("guards concurrent deletes of the same id", async () => {
    const { result } = setup();
    let resolveDelete!: () => void;
    const deletePromise = new Promise<void>(resolve => {
      resolveDelete = resolve;
    });
    const deleteFn = mock(() => deletePromise);

    let first!: Promise<void>;
    let second!: Promise<void>;
    act(() => {
      first = result.current.deleteEntity("entity-1", "A", deleteFn);
      second = result.current.deleteEntity("entity-1", "A", deleteFn);
    });

    expect(deleteFn).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveDelete();
      await Promise.all([first, second]);
    });

    expect(deleteFn).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("works without clearLocalState", async () => {
    const navigateToOverview = mock(() => {});
    const refreshList = mock(() => {});
    const { result } = renderHook(() =>
      useEntityDelete({
        currentRouteId: "x",
        navigateToOverview,
        refreshList,
      }),
    );

    await act(async () => {
      await result.current.deleteEntity("x", "X", async () => {});
    });

    expect(navigateToOverview).toHaveBeenCalledTimes(1);
    expect(refreshList).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledTimes(1);
  });

  it("supports numeric ids", async () => {
    const navigateToOverview = mock(() => {});
    const refreshList = mock(() => {});
    const { result } = renderHook(() =>
      useEntityDelete({
        currentRouteId: 42,
        navigateToOverview,
        refreshList,
      }),
    );

    await act(async () => {
      await result.current.deleteEntity(42, "Answer", async () => {});
    });

    expect(navigateToOverview).toHaveBeenCalledTimes(1);
    expect(toastSuccess).toHaveBeenCalledWith('Deleted "Answer"', { duration: 3000 });
  });

  it("reads latest currentRouteId via ref (not a stale closure)", async () => {
    const navigateToOverview = mock(() => {});
    const refreshList = mock(() => {});
    let routeId: string | null = "old";

    const { result, rerender } = renderHook(() =>
      useEntityDelete({
        currentRouteId: routeId,
        navigateToOverview,
        refreshList,
      }),
    );

    // Capture deleteEntity from first render, then change route id
    const deleteEntity = result.current.deleteEntity;
    routeId = "new";
    rerender();

    await act(async () => {
      await deleteEntity("new", "New", async () => {});
    });

    expect(navigateToOverview).toHaveBeenCalledTimes(1);
  });
});
