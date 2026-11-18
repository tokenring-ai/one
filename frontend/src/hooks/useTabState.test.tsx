import { describe, expect, it, jest } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTabState } from "./useTabState.ts";

const TAB_IDS = ["conversations", "channels", "people"] as const;
type DetailTab = (typeof TAB_IDS)[number];

describe("useTabState", () => {
  it("defaults to the first tab id when defaultTab is omitted", () => {
    const { result } = renderHook(() => useTabState(TAB_IDS));

    expect(result.current.activeTab).toBe("conversations");
  });

  it("uses the provided defaultTab", () => {
    const { result } = renderHook(() => useTabState(TAB_IDS, { defaultTab: "channels" }));

    expect(result.current.activeTab).toBe("channels");
  });

  it("setActiveTab updates the active tab", () => {
    const { result } = renderHook(() => useTabState(TAB_IDS));

    act(() => {
      result.current.setActiveTab("people");
    });

    expect(result.current.activeTab).toBe("people");
  });

  it("calls onTabChange with new and old tab when the tab changes", () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() => useTabState(TAB_IDS, { onTabChange }));

    act(() => {
      result.current.setActiveTab("channels");
    });

    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("channels", "conversations");
  });

  it("does not call onTabChange when setting the already-active tab", () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() => useTabState(TAB_IDS, { onTabChange }));

    act(() => {
      result.current.setActiveTab("conversations");
    });

    expect(onTabChange).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe("conversations");
  });

  it("resetTab returns to the default tab and notifies on change", () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() =>
      useTabState(TAB_IDS, {
        defaultTab: "conversations",
        onTabChange,
      }),
    );

    act(() => {
      result.current.setActiveTab("people");
    });
    onTabChange.mockClear();

    act(() => {
      result.current.resetTab();
    });

    expect(result.current.activeTab).toBe("conversations");
    expect(onTabChange).toHaveBeenCalledTimes(1);
    expect(onTabChange).toHaveBeenCalledWith("conversations", "people");
  });

  it("resetTab is a no-op when already on the default tab", () => {
    const onTabChange = jest.fn();
    const { result } = renderHook(() =>
      useTabState(TAB_IDS, {
        defaultTab: "conversations",
        onTabChange,
      }),
    );

    act(() => {
      result.current.resetTab();
    });

    expect(onTabChange).not.toHaveBeenCalled();
    expect(result.current.activeTab).toBe("conversations");
  });

  it("resetTab tracks an updated defaultTab after re-render", () => {
    const { result, rerender } = renderHook(({ defaultTab }: { defaultTab: DetailTab }) => useTabState(TAB_IDS, { defaultTab }), {
      initialProps: { defaultTab: "conversations" as DetailTab },
    });

    act(() => {
      result.current.setActiveTab("people");
    });

    rerender({ defaultTab: "channels" });

    act(() => {
      result.current.resetTab();
    });

    expect(result.current.activeTab).toBe("channels");
  });

  it("uses the latest onTabChange without requiring a stable callback identity", () => {
    const first = jest.fn();
    const second = jest.fn();
    const { result, rerender } = renderHook(({ onTabChange }) => useTabState(TAB_IDS, { onTabChange }), { initialProps: { onTabChange: first } });

    rerender({ onTabChange: second });

    act(() => {
      result.current.setActiveTab("channels");
    });

    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledWith("channels", "conversations");
  });

  it("throws when tabIds is empty and defaultTab is omitted", () => {
    expect(() => {
      renderHook(() => useTabState([] as const));
    }).toThrow(/non-empty tabIds|defaultTab/);
  });

  it("allows an empty tabIds array when defaultTab is provided", () => {
    const { result } = renderHook(() => useTabState([] as readonly DetailTab[], { defaultTab: "conversations" }));

    expect(result.current.activeTab).toBe("conversations");
  });
});
