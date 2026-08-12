import { ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import { cn } from "../../lib/utils.ts";

export type PaginationControlsSize = "sm" | "md";
export type PaginationControlsVariant = "toolbar" | "footer";

export interface PaginationControlsProps {
  /** Current offset (0-based) */
  offset: number;
  /** Number of items per page */
  pageSize: number;
  /** Total number of items (null/undefined if unknown) */
  totalCount?: number | null;
  /** Whether more pages exist beyond the current one */
  hasMore: boolean;
  /** Number of currently loaded items (for range calculation) */
  itemCount: number;
  /** Whether data is currently loading */
  loading?: boolean;
  /** Called when user navigates to a different page. Receives new offset. */
  onPageChange: (newOffset: number) => void;
  /** Optional refresh handler */
  onRefresh?: () => void;
  /** Whether to show the refresh button (default: false) */
  showRefresh?: boolean;
  /** Optional selection count to display */
  selectionCount?: number;
  /**
   * Custom range label formatter. Return null to hide the label.
   * Defaults to "1–50 of 237", "1–50+", "0 rows", or "Loading…".
   */
  rangeLabelFormatter?: (pageStart: number, pageEnd: number, totalCount: number | null, hasMore: boolean, itemCount: number) => string | null;
  /** Size variant (default: "sm") */
  size?: PaginationControlsSize;
  /** Layout variant (default: "toolbar") */
  variant?: PaginationControlsVariant;
  className?: string;
  "data-testid"?: string;
}

const sizeStyles: Record<
  PaginationControlsSize,
  {
    button: string;
    icon: string;
    label: string;
  }
> = {
  sm: {
    button: "p-1.5",
    icon: "w-3.5 h-3.5",
    label: "text-xs",
  },
  md: {
    button: "p-2",
    icon: "w-4 h-4",
    label: "text-sm",
  },
};

/**
 * Default range label: "1–50 of 237", "1–50+", "0 rows", or "Loading…".
 */
export function formatPaginationRangeLabel(
  pageStart: number,
  pageEnd: number,
  totalCount: number | null,
  hasMore: boolean,
  itemCount: number,
  loading = false,
): string | null {
  if (loading && itemCount === 0) return "Loading…";
  if (totalCount !== null) {
    return `${pageStart}–${pageEnd} of ${totalCount}`;
  }
  if (itemCount === 0) return "0 rows";
  return hasMore ? `${pageStart}–${pageEnd}+` : `${pageStart}–${pageEnd}`;
}

/**
 * Offset-based previous/next pagination controls with range label.
 * Data-agnostic: does not manage offset state or fetch data.
 */
export default function PaginationControls({
  offset,
  pageSize,
  totalCount = null,
  hasMore,
  itemCount,
  loading = false,
  onPageChange,
  onRefresh,
  showRefresh = false,
  selectionCount,
  rangeLabelFormatter,
  size = "sm",
  variant = "toolbar",
  className,
  "data-testid": testId,
}: PaginationControlsProps) {
  const styles = sizeStyles[size];
  const pageStart = itemCount === 0 ? 0 : offset + 1;
  const pageEnd = offset + itemCount;
  const canPrev = offset > 0;
  const canNext = hasMore;
  const resolvedTotal = totalCount ?? null;

  const rangeLabel = rangeLabelFormatter
    ? rangeLabelFormatter(pageStart, pageEnd, resolvedTotal, hasMore, itemCount)
    : formatPaginationRangeLabel(pageStart, pageEnd, resolvedTotal, hasMore, itemCount, loading);

  const navDisabled = loading;
  const buttonClass = cn(
    styles.button,
    "text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed",
  );

  const content = (
    <>
      {selectionCount != null && selectionCount > 0 && <span className={cn(styles.label, "text-muted")}>{selectionCount} selected</span>}
      {rangeLabel != null && rangeLabel !== "" && (
        <span className={cn(styles.label, "text-muted tabular-nums")} aria-live="polite">
          {rangeLabel}
        </span>
      )}
      {showRefresh && onRefresh && (
        <button type="button" onClick={onRefresh} className={buttonClass} title="Refresh" aria-label="Refresh">
          <RefreshCw className={styles.icon} />
        </button>
      )}
      <button
        type="button"
        disabled={!canPrev || navDisabled}
        onClick={() => onPageChange(Math.max(0, offset - pageSize))}
        className={buttonClass}
        aria-label="Previous page"
      >
        <ChevronLeft className={styles.icon} />
      </button>
      <button type="button" disabled={!canNext || navDisabled} onClick={() => onPageChange(offset + pageSize)} className={buttonClass} aria-label="Next page">
        <ChevronRight className={styles.icon} />
      </button>
    </>
  );

  if (variant === "footer") {
    return (
      <div
        className={cn("shrink-0 border-t border-primary bg-secondary flex items-center justify-center gap-2 px-3 py-2", className)}
        data-testid={testId}
        role="navigation"
        aria-label="Pagination"
      >
        {content}
      </div>
    );
  }

  return (
    <div className={cn("flex items-center gap-2", className)} data-testid={testId} role="navigation" aria-label="Pagination">
      {content}
    </div>
  );
}
