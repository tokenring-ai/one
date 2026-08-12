import { useEffect } from "react";
import { toastManager } from "../components/ui/toast.tsx";

export interface UseStaleRouteRedirectOptions {
  /** The route param value (e.g., from useParams). Null means no selection. */
  routeParam: string | null | undefined;
  /** The resolved entity. Null/undefined means not found. */
  entity: unknown;
  /** Whether the entity list is still loading. */
  isLoading: boolean;
  /** Whether the entity list fetch has an error. */
  hasError: boolean;
  /** Navigate function (from react-router-dom). */
  navigate: (to: string, options?: { replace: boolean }) => void;
  /** The path to navigate to when the entity is not found. */
  fallbackPath: string;
  /**
   * Label for the entity type, used in the toast message.
   * e.g., "Workflow", "Plugin", "Post"
   */
  entityLabel: string;
  /**
   * Optional: duration for the error toast. Defaults to 4000ms.
   */
  toastDuration?: number;
  /**
   * Optional: additional deps for the effect (e.g., searchParams).
   */
  deps?: unknown[];
}

const DEFAULT_TOAST_DURATION = 4000;

/**
 * Redirects when a route param points to a missing entity.
 * No return value — the hook runs a side effect.
 *
 * Only fires when `routeParam` is set, the list is not loading, there is no
 * list error, and `entity` is missing. Uses `{ replace: true }` so the stale
 * route does not pollute the history stack.
 */
export function useStaleRouteRedirect(options: UseStaleRouteRedirectOptions): void {
  const { routeParam, entity, isLoading, hasError, navigate, fallbackPath, entityLabel, toastDuration = DEFAULT_TOAST_DURATION, deps } = options;

  useEffect(() => {
    if (!routeParam || isLoading || hasError || entity) return;
    toastManager.error(`${entityLabel} "${routeParam}" not found`, { duration: toastDuration });
    navigate(fallbackPath, { replace: true });
    // Callers may pass extra deps (e.g. searchParams) that affect fallbackPath.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- deps is intentionally spread from options
  }, [routeParam, entity, isLoading, hasError, navigate, fallbackPath, entityLabel, toastDuration, ...(deps ?? [])]);
}
