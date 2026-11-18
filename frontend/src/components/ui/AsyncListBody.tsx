import type { ElementType, ReactNode } from "react";
import EmptyState from "./EmptyState.tsx";
import ErrorState from "./ErrorState.tsx";
import LoadingState from "./LoadingState.tsx";

export interface AsyncListBodyProps {
  /** A fetch is in flight. Only shown when there is nothing to display yet. */
  isLoading?: boolean | undefined;
  /** Fetch error. Only shown when there is nothing to display yet. */
  error?: unknown;
  onRetry?: (() => void) | undefined;
  /** True when there is something to render — a stale list still beats a spinner. */
  hasItems: boolean;
  /**
   * `panel` fills a navigator or panel body; `nested` is the tighter treatment
   * for rows revealed inside an expanded tree node.
   */
  variant?: "panel" | "nested" | undefined;
  loadingMessage?: string | undefined;
  errorTitle?: string | undefined;
  emptyIcon?: ElementType | undefined;
  emptyTitle?: string | undefined;
  emptyHint?: ReactNode | undefined;
  children: ReactNode;
}

/**
 * The loading → error → empty → content triage that every list-shaped view
 * performs.
 *
 * The three state primitives already existed, but the *decision* between them
 * was hand-written everywhere — which is how the app ended up with ~63 bespoke
 * states, including spinners and "nothing here" paragraphs that ignored
 * `LoadingState` and `EmptyState` entirely. Keeping stale content visible while
 * a refresh is in flight is part of the contract: only a list with nothing to
 * show falls back to a spinner.
 */
export default function AsyncListBody({
  isLoading,
  error,
  onRetry,
  hasItems,
  variant = "panel",
  loadingMessage,
  errorTitle = "Failed to load",
  emptyIcon,
  emptyTitle = "Nothing here yet",
  emptyHint,
  children,
}: AsyncListBodyProps) {
  const nested = variant === "nested";

  if (!hasItems) {
    if (isLoading) {
      return <LoadingState size="sm" {...(loadingMessage ? { message: loadingMessage } : {})} className={nested ? "py-3" : "py-6"} />;
    }
    if (error) {
      return <ErrorState title={errorTitle} error={error} {...(onRetry ? { onRetry } : {})} variant="inline" {...(nested ? { className: "px-2 py-2" } : {})} />;
    }
    return (
      <EmptyState
        {...(emptyIcon ? { icon: emptyIcon } : {})}
        title={emptyTitle}
        {...(emptyHint ? { hint: emptyHint } : {})}
        variant={nested ? "inline" : "compact"}
        {...(nested ? { className: "px-2 py-2" } : {})}
      />
    );
  }

  return <>{children}</>;
}
