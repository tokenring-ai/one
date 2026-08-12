import { ArrowDown, ArrowUp, ChevronsUpDown, KeyRound } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "../../lib/utils.ts";
import EmptyState from "./EmptyState.tsx";
import ErrorState from "./ErrorState.tsx";
import LoadingState from "./LoadingState.tsx";

export interface DataGridColumn {
  /** Column field name (used as data key) */
  name: string;
  /** Display label (defaults to name) */
  label?: string;
  /** Data type hint (e.g., "integer", "varchar", "date") */
  dataType?: string;
  /** Whether this column is a primary key */
  isPrimaryKey?: boolean;
  /** Whether this column contains numeric data (for right-alignment) */
  isNumeric?: boolean;
  /** Custom cell renderer */
  renderCell?: (value: unknown, row: Record<string, unknown>) => ReactNode;
  /** Whether this column is sortable (default: true) */
  sortable?: boolean;
  /** Column width */
  width?: string;
  /** Optional header tooltip (overrides dataType-based title) */
  title?: string;
}

export interface DataGridOrderBy {
  column: string;
  direction: "asc" | "desc";
}

export type DataGridSize = "xs" | "sm" | "md";

export interface DataGridProps {
  /** Rows to display */
  rows: Record<string, unknown>[];
  /** Column definitions */
  columns: DataGridColumn[];
  /** Fields to display (subset or reorder of columns). Defaults to all column names. */
  fields?: string[];
  /** Current sort order */
  orderBy?: DataGridOrderBy[];
  /** Set of selected row keys */
  selectedKeys?: Set<string>;
  /** Function to generate a stable key for a row */
  rowKeyOf: (row: Record<string, unknown>, index: number) => string;
  /** Whether data is loading */
  loading?: boolean;
  /** Error state */
  error?: unknown;
  /** Called when a row's selection toggles */
  onToggleRow?: (row: Record<string, unknown>, index: number) => void;
  /** Called when select-all/deselect-all is triggered */
  onToggleAll?: () => void;
  /** Called when a column header is clicked for sorting */
  onSort?: (column: string) => void;
  /** Called to retry after error */
  onRetry?: () => void;
  /** Called when a row is double-clicked */
  onOpenRow?: (row: Record<string, unknown>) => void;
  /** Whether filters are active (affects empty state message) */
  hasActiveFilters?: boolean;
  /** Loading message (default: "Loading…") */
  loadingMessage?: string;
  /** Error title (default: "Failed to load") */
  errorTitle?: string;
  /** Empty state message when no filters (default: "No rows") */
  emptyMessage?: string;
  /** Empty state message when filters are active (default: "No rows match the current filters.") */
  emptyFilteredMessage?: string;
  /** Whether to show selection checkboxes (default: true) */
  showSelection?: boolean;
  /** Whether to show data type labels under column headers (default: true) */
  showDataTypeLabels?: boolean;
  /** Whether to show primary key indicators (default: true) */
  showPrimaryKeyIndicators?: boolean;
  /** Whether to enable double-click to open row (default: true when onOpenRow is provided) */
  enableRowDetail?: boolean;
  /** Size variant */
  size?: DataGridSize;
  className?: string;
  "data-testid"?: string;
}

const sizeStyles: Record<DataGridSize, { table: string; headerCell: string; bodyCell: string; checkbox: string }> = {
  xs: {
    table: "text-xs",
    headerCell: "px-3 py-2",
    bodyCell: "px-3 py-1.5",
    checkbox: "w-3.5 h-3.5",
  },
  sm: {
    table: "text-sm",
    headerCell: "px-3 py-2",
    bodyCell: "px-3 py-2",
    checkbox: "w-4 h-4",
  },
  md: {
    table: "text-sm",
    headerCell: "px-4 py-2.5",
    bodyCell: "px-4 py-2.5",
    checkbox: "w-4 h-4",
  },
};

/** Format a cell value without falling back to Object's "[object Object]". */
function formatCellValue(value: unknown): string {
  if (value === null || value === undefined) return "null";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
    return String(value);
  }
  if (typeof value === "symbol") return value.toString();
  try {
    return JSON.stringify(value);
  } catch {
    return Object.prototype.toString.call(value);
  }
}

/** Renders a cell so null is visibly different from the string "null" or "". */
export function DataGridCellContent({ value }: { value: unknown }) {
  if (value === null || value === undefined) {
    return <span className="text-muted italic opacity-60">null</span>;
  }
  if (value === "") {
    return <span className="text-muted italic opacity-60">empty</span>;
  }
  if (typeof value === "boolean") {
    return <span className="text-muted">{String(value)}</span>;
  }
  return <>{formatCellValue(value)}</>;
}

function cellTitle(value: unknown): string {
  return formatCellValue(value);
}

/**
 * Sortable, selectable HTML table for tabular data.
 * Handles loading, error, and empty states; supports column sort indicators,
 * checkbox selection, double-click row detail, and null/empty cell rendering.
 */
export default function DataGrid({
  rows,
  columns,
  fields,
  orderBy = [],
  selectedKeys = new Set(),
  rowKeyOf,
  loading = false,
  error,
  onToggleRow,
  onToggleAll,
  onSort,
  onRetry,
  onOpenRow,
  hasActiveFilters = false,
  loadingMessage = "Loading…",
  errorTitle = "Failed to load",
  emptyMessage = "No rows",
  emptyFilteredMessage = "No rows match the current filters.",
  showSelection = true,
  showDataTypeLabels = true,
  showPrimaryKeyIndicators = true,
  enableRowDetail = true,
  size = "xs",
  className,
  "data-testid": testId,
}: DataGridProps) {
  if (loading && rows.length === 0) {
    return (
      <div className={cn("flex-1 flex flex-col", className)} data-testid={testId}>
        <LoadingState message={loadingMessage} className="flex-1" />
      </div>
    );
  }

  if (error) {
    return (
      <div className={cn("flex-1 flex flex-col", className)} data-testid={testId}>
        <ErrorState title={errorTitle} error={error} {...(onRetry ? { onRetry } : {})} variant="page" className="flex-1" />
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <EmptyState
        title={hasActiveFilters ? emptyFilteredMessage : emptyMessage}
        variant="page"
        className={cn("flex-1", className)}
        {...(testId != null ? { "data-testid": testId } : {})}
      />
    );
  }

  const displayFields = fields ?? columns.map(column => column.name);
  const columnByName = new Map(columns.map(column => [column.name, column]));
  const styles = sizeStyles[size];

  const allSelected = showSelection && rows.length > 0 && rows.every((row, index) => selectedKeys.has(rowKeyOf(row, index)));
  const someSelected = showSelection && !allSelected && rows.some((row, index) => selectedKeys.has(rowKeyOf(row, index)));

  const canOpenRow = enableRowDetail && onOpenRow != null;

  return (
    <div className={cn("flex-1 overflow-auto", className)} data-testid={testId}>
      <table className={cn("w-full border-collapse", styles.table)}>
        <thead className="sticky top-0 z-10 bg-secondary">
          <tr className="border-b border-primary">
            {showSelection && (
              <th scope="col" className="w-9 px-2 py-2">
                <input
                  type="checkbox"
                  checked={allSelected}
                  ref={el => {
                    if (el) el.indeterminate = someSelected;
                  }}
                  onChange={() => onToggleAll?.()}
                  aria-label={allSelected ? "Deselect rows on this page" : "Select rows on this page"}
                  title={allSelected ? "Deselect rows on this page" : "Select rows on this page"}
                  className={cn(styles.checkbox, "rounded border-primary bg-input accent-accent cursor-pointer align-middle")}
                />
              </th>
            )}
            {displayFields.map(field => {
              const column = columnByName.get(field);
              const sort = orderBy.find(order => order.column === field);
              const sortable = column?.sortable !== false && onSort != null;
              const label = column?.label ?? field;
              const headerTitle = column?.title ?? (column?.dataType ? column.dataType : field);

              return (
                <th
                  key={field}
                  scope="col"
                  className={cn(styles.headerCell, "text-left font-medium whitespace-nowrap")}
                  style={column?.width ? { width: column.width } : undefined}
                >
                  {sortable ? (
                    <button
                      type="button"
                      onClick={() => onSort(field)}
                      className="group inline-flex items-center gap-1.5 text-primary hover:text-accent transition-colors cursor-pointer focus-ring rounded"
                      title={headerTitle}
                    >
                      {showPrimaryKeyIndicators && column?.isPrimaryKey && <KeyRound className="w-3 h-3 text-amber-400 shrink-0" aria-label="Primary key" />}
                      <span>{label}</span>
                      {sort ? (
                        sort.direction === "asc" ? (
                          <ArrowUp className="w-3 h-3 shrink-0" aria-label="Sorted ascending" />
                        ) : (
                          <ArrowDown className="w-3 h-3 shrink-0" aria-label="Sorted descending" />
                        )
                      ) : (
                        <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" aria-hidden />
                      )}
                    </button>
                  ) : (
                    <span className="inline-flex items-center gap-1.5 text-primary" title={headerTitle}>
                      {showPrimaryKeyIndicators && column?.isPrimaryKey && <KeyRound className="w-3 h-3 text-amber-400 shrink-0" aria-label="Primary key" />}
                      <span>{label}</span>
                    </span>
                  )}
                  {showDataTypeLabels && column?.dataType && <span className="block text-xs font-normal text-muted lowercase">{column.dataType}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            // Identity is content/PK-based (stable across sort); index only
            // disambiguates duplicate no-PK rows for React's key list.
            const identity = rowKeyOf(row, index);
            const selected = showSelection && selectedKeys.has(identity);
            return (
              <tr
                key={`${identity}#${index}`}
                className={cn("border-b border-primary/60 hover:bg-hover transition-colors", selected && "bg-active")}
                aria-selected={showSelection ? selected : undefined}
              >
                {showSelection && (
                  <td className="px-2 py-1.5 align-top">
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => onToggleRow?.(row, index)}
                      aria-label={`Select row ${index + 1}`}
                      className={cn(styles.checkbox, "rounded border-primary bg-input accent-accent cursor-pointer")}
                    />
                  </td>
                )}
                {displayFields.map(field => {
                  const column = columnByName.get(field);
                  const value = row[field];
                  return (
                    <td
                      key={field}
                      onDoubleClick={canOpenRow ? () => onOpenRow(row) : undefined}
                      className={cn(
                        styles.bodyCell,
                        "align-top text-secondary max-w-xs truncate font-mono",
                        column?.isNumeric && "text-right tabular-nums",
                        canOpenRow && "cursor-pointer",
                      )}
                      style={column?.width ? { width: column.width } : undefined}
                      title={cellTitle(value)}
                    >
                      {column?.renderCell ? column.renderCell(value, row) : <DataGridCellContent value={value ?? null} />}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
