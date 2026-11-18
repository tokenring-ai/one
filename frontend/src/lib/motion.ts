/**
 * Reduced-motion checks for script-driven motion. CSS `scroll-behavior: auto` does not override an
 * explicit smooth behavior option in JS, so every programmatic smooth scroll asks here first.
 * Safe without a DOM or without matchMedia (SSR, jsdom).
 */

/** The OS setting, or the explicit `<html data-motion="reduce">` the app can set. */
export function prefersReducedMotion(): boolean {
  if (typeof document !== "undefined" && document.documentElement?.dataset.motion === "reduce") return true;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  try {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  } catch {
    return false;
  }
}

/** `behavior` for scrollTo and scrollIntoView: instant when motion is reduced. */
export function scrollBehavior(): "auto" | "smooth" {
  return prefersReducedMotion() ? "auto" : "smooth";
}
