import { useSyncExternalStore } from "react";

function getMediaQueryList(query: string): MediaQueryList | null {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return null;
  return window.matchMedia(query);
}

/**
 * Reactive `window.matchMedia` result. Returns `false` when matchMedia is
 * unavailable (tests, SSR).
 */
export function useMediaQuery(query: string): boolean {
  return useSyncExternalStore(
    onStoreChange => {
      const list = getMediaQueryList(query);
      if (!list) return () => {};
      list.addEventListener("change", onStoreChange);
      return () => list.removeEventListener("change", onStoreChange);
    },
    () => getMediaQueryList(query)?.matches ?? false,
    () => false,
  );
}

/** Below the tablet breakpoint the shell renders one screen at a time. */
export const MOBILE_MEDIA_QUERY = "(max-width: 767px)";

export function useIsMobileViewport(): boolean {
  return useMediaQuery(MOBILE_MEDIA_QUERY);
}
