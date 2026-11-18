/**
 * Test helpers for the layout system: mounts a real LayoutApp inside a
 * MemoryRouter at a URL, with persistence disabled, and exposes the current
 * location plus history controls.
 *
 * Plugins import this as `@tokenring-ai/one-frontend/test/layout.tsx`.
 */
import { act, type RenderResult, render } from "@testing-library/react";
import type { ComponentType, ReactNode } from "react";
import { type Location, MemoryRouter, type NavigateFunction, useLocation, useNavigate } from "react-router-dom";
import { defineApp, type ViewDefinition } from "../layout/define.ts";
import { LayoutApp } from "../layout/LayoutApp.tsx";
import { createLayoutRegistry, type LayoutRegistry } from "../layout/registry.ts";
import type { KindManifest, ViewParams } from "../layout/types.ts";

export interface RenderLayoutAppOptions {
  registry: LayoutRegistry;
  url: string;
  /** Router location state for the first entry (e.g. a hand-off from another app). */
  state?: unknown;
  /** Providers around the app (e.g. an SWRConfig with deduping off). */
  wrapper?: ComponentType<{ children: ReactNode }>;
  mobile?: boolean;
}

export interface RenderedLayoutApp extends RenderResult {
  /** Current router location. */
  location(): Location;
  /** Navigate like the browser would (inside act). */
  go(to: string | number): void;
}

/** Routes the current URL to its app, like the shell's AppHost. */
function Host({ registry, mobile }: { registry: LayoutRegistry; mobile?: boolean | undefined }) {
  const location = useLocation();
  const route = registry.routes.resolve(location.pathname);
  if (!route) return <p>No route for {location.pathname}</p>;
  return <LayoutApp key={route.app} registry={registry} appId={route.app} route={route} remote={null} {...(mobile === undefined ? {} : { mobile })} />;
}

interface RouterHandle {
  location: Location | null;
  navigate: NavigateFunction | null;
}

/** Records the router's location and navigate function for the test. */
function Probe({ handle }: { handle: RouterHandle }) {
  handle.location = useLocation();
  handle.navigate = useNavigate();
  return null;
}

export function renderLayoutApp({ registry, url, mobile, state, wrapper: Wrapper }: RenderLayoutAppOptions): RenderedLayoutApp {
  // Start from the app's template: forget saved layouts (only those; tests may seed other keys).
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("tokenring-layout:")) localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
  const router: RouterHandle = { location: null, navigate: null };
  const tree = (
    <MemoryRouter initialEntries={[state === undefined ? url : { pathname: url, state }]}>
      <Host registry={registry} mobile={mobile} />
      <Probe handle={router} />
    </MemoryRouter>
  );
  const result = render(Wrapper ? <Wrapper>{tree}</Wrapper> : tree);
  return {
    ...result,
    location: () => {
      if (!router.location) throw new Error("router not mounted");
      return router.location;
    },
    go: to => {
      act(() => {
        if (typeof to === "number") void router.navigate?.(to);
        else void router.navigate?.(to);
      });
    },
  };
}

export interface RenderLayoutViewOptions {
  params?: ViewParams;
  /** Other views the view may open (they join the test app). */
  views?: ViewDefinition[];
  kinds?: KindManifest[];
  mobile?: boolean;
}

/**
 * Mounts one view, alone in a single container of a throwaway app, at its own
 * URL. For view-level tests that don't need the real app's layout.
 */
export function renderLayoutView(view: ViewDefinition, { params = {}, views = [], kinds = [], mobile }: RenderLayoutViewOptions = {}): RenderedLayoutApp {
  const all = [view, ...views.filter(v => v.id !== view.id)];
  const kindIds = [...new Set(all.map(v => v.kind))];
  const app = defineApp({
    id: "test",
    path: "/test",
    label: "Test",
    description: "",
    icon: view.icon,
    group: "System",
    views: all.map(v => v.id),
    primaryKind: view.kind,
    layout: { presenter: "tabs", accepts: ["*"], items: [{ view: view.id, params }], primary: true },
  });
  const registry = createLayoutRegistry({
    apps: [app],
    views: all,
    kinds: [...kinds, ...kindIds.filter(id => !kinds.some(k => k.id === id)).map(id => ({ id, label: id, plural: id }))],
  });
  const url = registry.routes.urlFor("test", view.id, params) ?? "/test";
  return renderLayoutApp({ registry, url, ...(mobile === undefined ? {} : { mobile }) });
}
