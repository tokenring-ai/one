import { describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type { ReactNode } from "react";
import { MemoryRouter, useNavigate } from "react-router-dom";
import { useNavigationStatePayload } from "./useNavigationStatePayload.ts";

type Payload = { fileContent?: string; title?: string };

function createWrapper(initialEntries: Array<string | { pathname: string; state?: unknown; key?: string }>) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
  };
}

describe("useNavigationStatePayload", () => {
  it("calls onPayload once when location.state is present", () => {
    const onPayload = jest.fn();
    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
        }),
      {
        wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "hello", title: "T" } }]),
      },
    );

    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(onPayload).toHaveBeenCalledWith({ fileContent: "hello", title: "T" });
  });

  it("does not call onPayload when location.state is null", () => {
    const onPayload = jest.fn();
    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
        }),
      {
        wrapper: createWrapper(["/docs"]),
      },
    );

    expect(onPayload).not.toHaveBeenCalled();
  });

  it("does not re-process the same location.key on re-render", () => {
    const onPayload = jest.fn();
    const { rerender } = renderHook(
      ({ handler }: { handler: (state: Payload) => void }) =>
        useNavigationStatePayload<Payload>({
          onPayload: handler,
        }),
      {
        initialProps: { handler: onPayload },
        wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "once" } }]),
      },
    );

    expect(onPayload).toHaveBeenCalledTimes(1);

    const nextHandler = jest.fn();
    rerender({ handler: nextHandler });

    // Same navigation key — must not fire again even if onPayload identity changes
    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(nextHandler).not.toHaveBeenCalled();
  });

  it("processes a new payload when location.key changes", () => {
    const onPayload = jest.fn();
    let navigateFn: ReturnType<typeof useNavigate> | null = null;

    function useHookUnderTest() {
      navigateFn = useNavigate();
      useNavigationStatePayload<Payload>({ onPayload });
    }

    renderHook(() => useHookUnderTest(), {
      wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "first" } }]),
    });

    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(onPayload).toHaveBeenLastCalledWith({ fileContent: "first" });

    act(() => {
      navigateFn!("/docs", { state: { fileContent: "second" } });
    });

    expect(onPayload).toHaveBeenCalledTimes(2);
    expect(onPayload).toHaveBeenLastCalledWith({ fileContent: "second" });
  });

  it("clears navigation state when clearAfterConsume is true", () => {
    const onPayload = jest.fn();
    const navigate = jest.fn();

    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
          clearAfterConsume: true,
          navigate,
          clearNavigateTo: "/web-design",
        }),
      {
        wrapper: createWrapper([{ pathname: "/web-design", state: { fileContent: "<html/>" } }]),
      },
    );

    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledTimes(1);
    expect(navigate).toHaveBeenCalledWith("/web-design", { replace: true, state: null });
  });

  it("defaults clearNavigateTo to the current pathname", () => {
    const onPayload = jest.fn();
    const navigate = jest.fn();

    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
          clearAfterConsume: true,
          navigate,
        }),
      {
        wrapper: createWrapper([{ pathname: "/docs/open", state: { fileContent: "x" } }]),
      },
    );

    expect(navigate).toHaveBeenCalledWith("/docs/open", { replace: true, state: null });
  });

  it("does not clear when clearAfterConsume is false", () => {
    const onPayload = jest.fn();
    const navigate = jest.fn();

    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
          clearAfterConsume: false,
          navigate,
          clearNavigateTo: "/docs",
        }),
      {
        wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "x" } }]),
      },
    );

    expect(onPayload).toHaveBeenCalledTimes(1);
    expect(navigate).not.toHaveBeenCalled();
  });

  it("does not clear when navigate is omitted", () => {
    const onPayload = jest.fn();

    renderHook(
      () =>
        useNavigationStatePayload<Payload>({
          onPayload,
          clearAfterConsume: true,
          clearNavigateTo: "/docs",
        }),
      {
        wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "x" } }]),
      },
    );

    expect(onPayload).toHaveBeenCalledTimes(1);
  });

  it("uses the latest onPayload without re-processing when the callback changes", () => {
    const first = jest.fn();
    const second = jest.fn();

    const { rerender } = renderHook(
      ({ handler }: { handler: (state: Payload) => void }) =>
        useNavigationStatePayload<Payload>({
          onPayload: handler,
        }),
      {
        initialProps: { handler: first },
        wrapper: createWrapper([{ pathname: "/docs", state: { fileContent: "body" } }]),
      },
    );

    expect(first).toHaveBeenCalledTimes(1);

    rerender({ handler: second });
    expect(second).not.toHaveBeenCalled();
    expect(first).toHaveBeenCalledTimes(1);
  });
});
