import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { renderHook } from "@testing-library/react";

const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: {
    success: mock(),
    error: toastError,
    warning: mock(),
    info: mock(),
    remove: mock(),
  },
}));

const { useStaleRouteRedirect } = await import("./useStaleRouteRedirect.ts");

describe("useStaleRouteRedirect", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  afterEach(() => {
    toastError.mockClear();
  });

  function setup(overrides?: Partial<Parameters<typeof useStaleRouteRedirect>[0]>) {
    const navigate =
      (overrides?.navigate as ((to: string, options?: { replace: boolean }) => void) | undefined) ?? mock((_to: string, _opts?: { replace?: boolean }) => {});
    renderHook(() =>
      useStaleRouteRedirect({
        routeParam: "missing",
        entity: null,
        isLoading: false,
        hasError: false,
        fallbackPath: "/workflows",
        entityLabel: "Workflow",
        ...overrides,
        navigate,
      }),
    );
    return { navigate };
  }

  it("toasts and navigates with replace when the route param has no matching entity", () => {
    const { navigate } = setup();

    expect(toastError).toHaveBeenCalledWith('Workflow "missing" not found', { duration: 4000 });
    expect(navigate).toHaveBeenCalledWith("/workflows", { replace: true });
  });

  it("does nothing while the list is loading", () => {
    const { navigate } = setup({ isLoading: true });

    expect(toastError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing when the list fetch has an error", () => {
    const { navigate } = setup({ hasError: true });

    expect(toastError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing when there is no route param", () => {
    const { navigate } = setup({ routeParam: null });

    expect(toastError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does nothing when the entity is found", () => {
    const { navigate } = setup({ entity: { name: "missing" } });

    expect(toastError).not.toHaveBeenCalled();
    expect(navigate).not.toHaveBeenCalled();
  });

  it("uses a custom toast duration when provided", () => {
    setup({ toastDuration: 2500 });

    expect(toastError).toHaveBeenCalledWith('Workflow "missing" not found', { duration: 2500 });
  });

  it("uses the entity label in the toast message", () => {
    setup({ entityLabel: "Plugin", routeParam: "gone", fallbackPath: "/configuration" });

    expect(toastError).toHaveBeenCalledWith('Plugin "gone" not found', { duration: 4000 });
  });

  it("re-runs when extra deps change", () => {
    const navigate = mock((_to: string, _opts?: { replace?: boolean }) => {});
    let extra = "a";

    const { rerender } = renderHook(
      ({ dep }: { dep: string }) =>
        useStaleRouteRedirect({
          routeParam: "missing",
          entity: null,
          isLoading: false,
          hasError: false,
          navigate,
          fallbackPath: `/workflows?x=${dep}`,
          entityLabel: "Workflow",
          deps: [dep],
        }),
      { initialProps: { dep: extra } },
    );

    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenLastCalledWith("/workflows?x=a", { replace: true });

    extra = "b";
    rerender({ dep: extra });

    expect(navigate).toHaveBeenCalledTimes(2);
    expect(navigate).toHaveBeenLastCalledWith("/workflows?x=b", { replace: true });
  });
});
