import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { resetThemeStoreForTests, useTheme } from "./useTheme.ts";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    resetThemeStoreForTests();
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    resetThemeStoreForTests();
  });

  it("defaults to system when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());
    const [, , preference] = result.current;
    expect(preference).toBe("system");
  });

  it("restores a stored light preference", () => {
    localStorage.setItem("theme", "light");
    resetThemeStoreForTests();
    const { result } = renderHook(() => useTheme());
    const [resolved, , preference] = result.current;
    expect(preference).toBe("light");
    expect(resolved).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("restores a stored dark preference and applies the class", () => {
    localStorage.setItem("theme", "dark");
    resetThemeStoreForTests();
    const { result } = renderHook(() => useTheme());
    const [resolved, , preference] = result.current;
    expect(preference).toBe("dark");
    expect(resolved).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });

  it("persists preference changes and updates the document class", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current[1]("dark");
    });
    expect(result.current[0]).toBe("dark");
    expect(result.current[2]).toBe("dark");
    expect(localStorage.getItem("theme")).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    act(() => {
      result.current[1]("light");
    });
    expect(result.current[0]).toBe("light");
    expect(result.current[2]).toBe("light");
    expect(localStorage.getItem("theme")).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    act(() => {
      result.current[1]("system");
    });
    expect(result.current[2]).toBe("system");
    expect(localStorage.getItem("theme")).toBe("system");
  });

  it("keeps multiple consumers in sync", () => {
    const a = renderHook(() => useTheme());
    const b = renderHook(() => useTheme());

    act(() => {
      a.result.current[1]("dark");
    });

    expect(a.result.current[0]).toBe("dark");
    expect(a.result.current[2]).toBe("dark");
    expect(b.result.current[0]).toBe("dark");
    expect(b.result.current[2]).toBe("dark");
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
