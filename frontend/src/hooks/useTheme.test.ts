import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { useTheme } from "./useTheme.ts";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
  });

  it("defaults to system when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());
    const [, , preference] = result.current;
    expect(preference).toBe("system");
  });

  it("restores a stored light preference", () => {
    localStorage.setItem("theme", "light");
    const { result } = renderHook(() => useTheme());
    const [resolved, , preference] = result.current;
    expect(preference).toBe("light");
    expect(resolved).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("restores a stored dark preference and applies the class", () => {
    localStorage.setItem("theme", "dark");
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
});
