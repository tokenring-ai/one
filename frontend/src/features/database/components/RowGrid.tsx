import { useMemo } from "react";
import DataGrid, { type DataGridColumn } from "../../../components/ui/DataGrid.tsx";
import { isNumericType } from "../constants.ts";
import type { ColumnDef, OrderBy, Row } from "../types.ts";

export default function RowGrid({
  rows,
  columns,
  fields,
  orderBy,
  selectedKeys,
  rowKeyOf,
  loading,
  error,
  onToggleRow,
  onToggleAll,
  onSort,
  onRetry,
  onOpenRow,
  hasActiveFilters = false,
}: {
  rows: Row[];
  columns: ColumnDef[];
  fields: string[];
  orderBy: OrderBy[];
  selectedKeys: Set<string>;
  rowKeyOf: (row: Row, index: number) => string;
  loading: boolean;
  error: unknown;
  onToggleRow: (row: Row, index: number) => void;
  onToggleAll: () => void;
  onSort: (column: string) => void;
  onRetry: () => void;
  onOpenRow: (row: Row) => void;
  /** When true, empty state mentions filters rather than an empty table. */
  hasActiveFilters?: boolean;
}) {
  const gridColumns: DataGridColumn[] = useMemo(
    () =>
      columns.map(column => ({
        name: column.name,
        dataType: column.dataType,
        isPrimaryKey: column.isPrimaryKey,
        isNumeric: isNumericType(column.dataType),
        title: `${column.dataType}${column.nullable ? " · nullable" : ""}`,
      })),
    [columns],
  );

  return (
    <DataGrid
      rows={rows}
      columns={gridColumns}
      fields={fields}
      orderBy={orderBy}
      selectedKeys={selectedKeys}
      rowKeyOf={rowKeyOf as (row: Record<string, unknown>, index: number) => string}
      loading={loading}
      error={error}
      onToggleRow={onToggleRow as (row: Record<string, unknown>, index: number) => void}
      onToggleAll={onToggleAll}
      onSort={onSort}
      onRetry={onRetry}
      onOpenRow={onOpenRow as (row: Record<string, unknown>) => void}
      hasActiveFilters={hasActiveFilters}
      loadingMessage="Loading rows…"
      errorTitle="Failed to load rows"
      emptyMessage="This table has no rows."
      emptyFilteredMessage="No rows match the current filters."
    />
  );
}
