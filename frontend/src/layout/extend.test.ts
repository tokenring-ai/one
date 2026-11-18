import { describe, expect, test } from "bun:test";
import { LayoutDashboard } from "lucide-react";
import { extendApp } from "./extend.ts";
import type { AppManifest } from "./types.ts";

const HOME: AppManifest = {
  id: "home",
  path: "/home",
  label: "Home",
  description: "",
  icon: LayoutDashboard,
  group: "System",
  views: ["welcome", "agents-widget"],
  primaryKind: "page",
  layout: {
    split: "row",
    children: [
      { presenter: "tabs", accepts: ["*"], items: ["welcome"], primary: true },
      { presenter: "single", accepts: ["widget"], items: ["agents-widget"] },
      { presenter: "accordion", accepts: ["widget"], items: [] },
    ],
  },
};

describe("extendApp", () => {
  test("adds views and places them in the first multi-item container that names the kind", () => {
    const app = extendApp(HOME, [
      { app: "home", views: ["cost", "runs"], into: "widget" },
      { app: "other", views: ["nope"], into: "widget" },
    ]);
    expect(app.views).toEqual(["welcome", "agents-widget", "cost", "runs"]);
    const children = "split" in app.layout ? app.layout.children : [];
    expect(children[0]).toMatchObject({ presenter: "tabs", items: ["welcome"] });
    expect(children[1]).toMatchObject({ presenter: "single", items: ["agents-widget"] });
    expect(children[2]).toMatchObject({ presenter: "accordion", items: ["cost", "runs"] });
  });

  test("prefers a side area to the app's main one, even when the main one names the kind", () => {
    const layout = {
      split: "row" as const,
      children: [
        { presenter: "tabs" as const, accepts: ["widget", "page"], items: ["agents-widget"], primary: true },
        { presenter: "accordion" as const, accepts: ["widget"], items: [] },
      ],
    };
    const app = extendApp({ ...HOME, layout }, [{ app: "home", views: ["cost"], into: "widget" }]);
    const children = "split" in app.layout ? app.layout.children : [];
    expect(children[0]).toMatchObject({ items: ["agents-widget"] });
    expect(children[1]).toMatchObject({ items: ["cost"] });
  });

  test("uses the main area when it is the only one that takes the kind", () => {
    const app = extendApp({ ...HOME, layout: { presenter: "tabs", accepts: ["widget"], items: [], primary: true } }, [
      { app: "home", views: ["cost"], into: "widget" },
    ]);
    expect(app.layout).toMatchObject({ items: ["cost"] });
  });

  test("without `into` only offers the views, and never adds one twice", () => {
    const app = extendApp(HOME, [
      { app: "home", views: ["cost"] },
      { app: "home", views: ["cost", "welcome"], into: "widget" },
    ]);
    expect(app.views).toEqual(["welcome", "agents-widget", "cost"]);
    expect(app.layout).toEqual(HOME.layout);
  });

  test("leaves apps nothing extends untouched", () => {
    expect(extendApp(HOME, [])).toBe(HOME);
  });
});
