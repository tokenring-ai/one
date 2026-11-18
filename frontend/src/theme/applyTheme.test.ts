import { afterEach, describe, expect, it } from "bun:test";
import { applyTheme, THEME_BOOT_CACHE_KEY } from "./applyTheme.ts";
import { ACCENTS, THEMES } from "./themes.ts";

function themeColor() {
  return document.head.querySelector<HTMLMetaElement>('meta[name="theme-color"]')?.content;
}

describe("applyTheme", () => {
  afterEach(() => {
    const root = document.documentElement;
    root.classList.remove("dark");
    root.removeAttribute("data-theme");
    root.removeAttribute("data-density");
    root.removeAttribute("style");
    localStorage.clear();
  });

  it("applies Charcoal: dark class, data attributes, chrome and accent shades", () => {
    applyTheme({ theme: THEMES.charcoal, accent: "teal", density: "compact" });
    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(true);
    expect(root.getAttribute("data-theme")).toBe("charcoal");
    expect(root.getAttribute("data-density")).toBe("compact");
    expect(root.style.getPropertyValue("--accent-primary")).toBe(ACCENTS.teal.color);
    expect(root.style.getPropertyValue("--accent-primary-hover")).toBe(ACCENTS.teal.dark.hover);
    expect(root.style.getPropertyValue("--accent-primary-soft")).toBe(ACCENTS.teal.dark.soft);
    expect(themeColor()).toBe(THEMES.charcoal.surface.canvas);
    expect(root.style.backgroundColor).not.toBe("");
  });

  it("applies Paper with the default accent matching tokens.css", () => {
    applyTheme({ theme: THEMES.charcoal, accent: "indigo", density: "default" });
    applyTheme({ theme: THEMES.paper, accent: "indigo", density: "comfortable" });
    const root = document.documentElement;
    expect(root.classList.contains("dark")).toBe(false);
    expect(root.getAttribute("data-theme")).toBe("paper");
    expect(root.getAttribute("data-density")).toBe("comfortable");
    expect(root.style.getPropertyValue("--accent-primary")).toBe("#5a5df0");
    expect(root.style.getPropertyValue("--accent-primary-hover")).toBe("#4346ee");
    expect(themeColor()).toBe(THEMES.paper.surface.canvas);
    expect(document.head.querySelectorAll('meta[name="theme-color"]').length).toBe(1);
  });

  it("caches what the index.html bootstrap needs", () => {
    applyTheme({ theme: THEMES.charcoal, accent: "rose", density: "compact" });
    expect(JSON.parse(localStorage.getItem(THEME_BOOT_CACHE_KEY) ?? "null")).toEqual({
      mode: "dark",
      bg: THEMES.charcoal.surface.canvas,
      accent: ACCENTS.rose.color,
      density: "compact",
    });
  });
});
