import { useEffect, useRef } from "react";
import { useLayoutApi } from "../layout/context.ts";
import { usePanel } from "../layout/hooks.ts";
import type { PanelBadge, ViewParams } from "../layout/types.ts";

/**
 * Small wrappers over `usePanel()` for the core apps. `usePanel()` returns a
 * fresh handle every render, so effects keyed on it would re-run constantly;
 * these key on the values instead and reach the handle through a ref.
 */

/** Keeps the panel's tab title in sync; `null` falls back to the view's own title. */
export function usePanelTitle(title: string | null): void {
  const panel = usePanel();
  const ref = useRef(panel);
  ref.current = panel;
  useEffect(() => {
    ref.current.setTitle(title);
  }, [title]);
}

/** Shows a badge on the panel's tab while `badge` is set; cleared on unmount. */
export function usePanelBadge(badge: PanelBadge | null): void {
  const panel = usePanel();
  const ref = useRef(panel);
  ref.current = panel;
  const tone = badge?.tone ?? null;
  const label = badge?.label ?? null;
  useEffect(() => {
    ref.current.setBadge(tone ? { tone, ...(label ? { label } : {}) } : null);
  }, [tone, label]);
  useEffect(() => () => ref.current.setBadge(null), []);
}

/**
 * Params of the URL when it focuses `viewId` in this app, else null. For
 * single-instance views (the marketplace) whose panel keeps the params it was
 * first opened with while the URL moves between items.
 */
export function useRouteParamsFor(viewId: string): ViewParams | null {
  const { route } = useLayoutApi();
  return route?.viewId === viewId ? route.params : null;
}
