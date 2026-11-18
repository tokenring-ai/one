import type { ElementType, ReactNode } from "react";
import { cn } from "../../lib/utils.ts";
import EmptyState from "./EmptyState.tsx";
import ErrorState from "./ErrorState.tsx";
import LoadingState from "./LoadingState.tsx";

export interface DetailViewerNotReady {
  icon?: ElementType;
  title: string;
  hint?: ReactNode;
}

export interface DetailViewerEmptyState {
  icon?: ElementType;
  iconBadgeClassName?: string;
  title: string;
  hint?: ReactNode;
  ctaLabel?: string;
  ctaIcon?: ElementType;
  onCta?: () => void;
}

export interface DetailViewerAreaProps<T> {
  /** Whether all prerequisites are met (agent connected, provider selected, etc.) */
  ready: boolean;
  /** Loading message shown while prerequisites are being met */
  readyLoadingMessage?: string;
  /** Message shown when prerequisites are not met (e.g., no providers configured) */
  notReady?: DetailViewerNotReady;
  /** Whether an item is currently selected */
  hasSelection: boolean;
  /** The selected item data (null if not loaded or not selected) */
  data: T | null;
  /** Error from loading the selected item */
  error?: unknown;
  /** Whether the selected item is loading */
  loading: boolean;
  /** Loading message for the selected item */
  loadingMessage?: string;
  /** Error title */
  errorTitle?: string;
  /** Error retry handler */
  onRetry?: () => void;
  /** Empty state configuration when no item is selected */
  emptyState: DetailViewerEmptyState;
  /**
   * Content rendering function when data is available.
   * Pass a `key` on the root element (e.g. `key={data.id}`) so the detail view
   * remounts cleanly when selection changes.
   */
  renderContent: (data: T) => ReactNode;
  className?: string;
}

/**
 * Master-detail content pane state machine:
 * not-ready / connecting → empty (no selection) → loading / error → content.
 *
 * Composes LoadingState, ErrorState, and EmptyState; consumers supply
 * `renderContent` for the success path.
 */
export default function DetailViewerArea<T>({
  ready,
  readyLoadingMessage = "Loading…",
  notReady,
  hasSelection,
  data,
  error,
  loading,
  loadingMessage = "Loading…",
  errorTitle = "Failed to load",
  onRetry,
  emptyState,
  renderContent,
  className,
}: DetailViewerAreaProps<T>) {
  if (!ready) {
    // notReady means the app cannot function yet (e.g. no providers).
    // Without it, assume prerequisites are still loading (e.g. connecting agent).
    if (notReady) {
      return (
        <EmptyState
          variant="page"
          title={notReady.title}
          {...(notReady.icon != null ? { icon: notReady.icon } : {})}
          {...(notReady.hint != null ? { hint: notReady.hint } : {})}
          {...(className != null ? { className } : {})}
        />
      );
    }
    return <LoadingState message={readyLoadingMessage} className={cn("h-full", className)} />;
  }

  if (!hasSelection) {
    return (
      <EmptyState
        variant="page"
        title={emptyState.title}
        {...(emptyState.icon != null ? { icon: emptyState.icon } : {})}
        {...(emptyState.iconBadgeClassName != null ? { iconBadgeClassName: emptyState.iconBadgeClassName } : {})}
        {...(emptyState.hint != null ? { hint: emptyState.hint } : {})}
        {...(emptyState.ctaLabel != null ? { ctaLabel: emptyState.ctaLabel } : {})}
        {...(emptyState.ctaIcon != null ? { ctaIcon: emptyState.ctaIcon } : {})}
        {...(emptyState.onCta != null ? { onCta: emptyState.onCta } : {})}
        {...(className != null ? { className } : {})}
      />
    );
  }

  // Prefer content when we already have data (e.g. revalidation with stale cache).
  if (data != null) {
    return <>{renderContent(data)}</>;
  }

  // Error wins over loading when the fetch has failed (and is not still in-flight).
  if (error != null && !loading) {
    return (
      <ErrorState title={errorTitle} error={error} variant="page" {...(onRetry != null ? { onRetry } : {})} {...(className != null ? { className } : {})} />
    );
  }

  // Selected with no data yet — spinner while loading, or during transitional gaps
  // (e.g. SWR key change where isLoading is briefly false).
  return <LoadingState message={loadingMessage} className={cn("h-full", className)} />;
}
