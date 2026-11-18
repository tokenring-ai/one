import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import { ACCENTS } from "../theme/themes.ts";
import { resetThemeStoreForTests, THEME_CHROME_COLORS, useTheme, useThemeSettings } from "./useTheme.ts";

describe("useTheme", () => {
  beforeEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    act(() => resetThemeStoreForTests());
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    act(() => resetThemeStoreForTests());
  });

  it("defaults to system when nothing is stored", () => {
    const { result } = renderHook(() => useTheme());
    const [, , preference] = result.current;
    expect(preference).toBe("system");
  });

  it("restores a stored light preference", () => {
    localStorage.setItem("theme", "light");
    act(() => resetThemeStoreForTests());
    const { result } = renderHook(() => useTheme());
    const [resolved, , preference] = result.current;
    expect(preference).toBe("light");
    expect(resolved).toBe("light");
    expect(document.documentElement.classList.contains("dark")).toBe(false);
  });

  it("restores a stored dark preference and applies the class", () => {
    localStorage.setItem("theme", "dark");
    act(() => resetThemeStoreForTests());
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

describe("useTheme page chrome", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => resetThemeStoreForTests());
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    act(() => resetThemeStoreForTests());
  });

  function themeColor() {
    return document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
  }

  it("keeps the html background and theme-color meta in step with the theme", () => {
    const { result } = renderHook(() => useTheme());

    act(() => {
      result.current[1]("dark");
    });
    expect(themeColor()).toBe(THEME_CHROME_COLORS.dark);
    expect(document.documentElement.style.backgroundColor).not.toBe("");
    const darkBackground = document.documentElement.style.backgroundColor;

    act(() => {
      result.current[1]("light");
    });
    expect(themeColor()).toBe(THEME_CHROME_COLORS.light);
    expect(document.documentElement.style.backgroundColor).not.toBe(darkBackground);
    // One meta, updated in place.
    expect(document.head.querySelectorAll('meta[name="theme-color"]').length).toBe(1);
  });
});

describe("useThemeSettings", () => {
  beforeEach(() => {
    localStorage.clear();
    act(() => resetThemeStoreForTests());
  });

  afterEach(() => {
    localStorage.clear();
    document.documentElement.classList.remove("dark");
    act(() => resetThemeStoreForTests());
  });

  it("defaults to the indigo accent and default density", () => {
    const { result } = renderHook(() => useThemeSettings());
    expect(result.current.accent).toBe("indigo");
    expect(result.current.density).toBe("default");
    expect(document.documentElement.getAttribute("data-density")).toBe("default");
  });

  it("resolves light to Paper and dark to Charcoal", () => {
    const { result } = renderHook(() => useThemeSettings());
    act(() => {
      result.current.setPreference("light");
    });
    expect(result.current.theme.id).toBe("paper");
    expect(document.documentElement.getAttribute("data-theme")).toBe("paper");
    act(() => {
      result.current.setPreference("dark");
    });
    expect(result.current.theme.id).toBe("charcoal");
    expect(result.current.resolved).toBe("dark");
    expect(document.documentElement.getAttribute("data-theme")).toBe("charcoal");
  });

  it("persists accent and density under their own raw keys and applies them", () => {
    const { result } = renderHook(() => useThemeSettings());
    act(() => {
      result.current.setAccent("amber");
      result.current.setDensity("comfortable");
    });
    expect(result.current.accent).toBe("amber");
    expect(result.current.density).toBe("comfortable");
    expect(localStorage.getItem("theme-accent")).toBe("amber");
    expect(localStorage.getItem("theme-density")).toBe("comfortable");
    expect(document.documentElement.style.getPropertyValue("--accent-primary")).toBe(ACCENTS.amber.color);
    expect(document.documentElement.getAttribute("data-density")).toBe("comfortable");
  });

  it("restores stored values and ignores unknown ones", () => {
    localStorage.setItem("theme-accent", "slate");
    localStorage.setItem("theme-density", "huge");
    act(() => resetThemeStoreForTests());
    const { result } = renderHook(() => useThemeSettings());
    expect(result.current.accent).toBe("slate");
    expect(result.current.density).toBe("default");
  });

  it("keeps useTheme consumers in sync with settings changes", () => {
    const settings = renderHook(() => useThemeSettings());
    const theme = renderHook(() => useTheme());
    act(() => {
      settings.result.current.setPreference("dark");
    });
    expect(theme.result.current[0]).toBe("dark");
    expect(theme.result.current[2]).toBe("dark");
  });
});
