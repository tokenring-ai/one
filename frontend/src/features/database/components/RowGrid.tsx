import { ArrowDown, ArrowUp, ChevronsUpDown, KeyRound } from "lucide-react";
import ErrorState from "../../../components/ui/ErrorState.tsx";
import LoadingState from "../../../components/ui/LoadingState.tsx";
import { cn } from "../../../lib/utils.ts";
import { isNumericType } from "../constants.ts";
import type { CellValue, ColumnDef, OrderBy, Row } from "../types.ts";

/** Renders a cell so null is visibly different from the string "null" or "". */
function CellContent({ value }: { value: CellValue }) {
  if (value === null) return <span className="text-muted italic opacity-60">null</span>;
  if (value === "") return <span className="text-muted italic opacity-60">empty</span>;
  if (typeof value === "boolean") return <span className="text-muted">{String(value)}</span>;
  return <>{String(value)}</>;
}

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
}) {
  if (loading && rows.length === 0) {
    return <LoadingState message="Loading rows…" className="flex-1" />;
  }
  if (error) {
    return <ErrorState title="Failed to load rows" error={error} onRetry={onRetry} variant="page" />;
  }
  if (rows.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center px-6">
        <p className="text-sm text-muted">No rows match the current filters.</p>
      </div>
    );
  }

  const columnByName = new Map(columns.map(column => [column.name, column]));
  const allSelected = rows.every((row, index) => selectedKeys.has(rowKeyOf(row, index)));

  return (
    <div className="flex-1 overflow-auto">
      <table className="w-full border-collapse text-xs">
        <thead className="sticky top-0 z-10 bg-secondary">
          <tr className="border-b border-primary">
            <th scope="col" className="w-9 px-2 py-2">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                aria-label={allSelected ? "Deselect all rows" : "Select all rows"}
                className="w-3.5 h-3.5 rounded border-primary bg-input accent-accent cursor-pointer align-middle"
              />
            </th>
            {fields.map(field => {
              const column = columnByName.get(field);
              const sort = orderBy.find(order => order.column === field);
              return (
                <th key={field} scope="col" className="px-3 py-2 text-left font-medium whitespace-nowrap">
                  <button
                    type="button"
                    onClick={() => onSort(field)}
                    className="group inline-flex items-center gap-1.5 text-primary hover:text-accent transition-colors cursor-pointer focus-ring rounded"
                    title={column ? `${column.dataType}${column.nullable ? " · nullable" : ""}` : field}
                  >
                    {column?.isPrimaryKey && <KeyRound className="w-3 h-3 text-amber-400 shrink-0" aria-label="Primary key" />}
                    <span>{field}</span>
                    {sort ? (
                      sort.direction === "asc" ? (
                        <ArrowUp className="w-3 h-3 shrink-0" />
                      ) : (
                        <ArrowDown className="w-3 h-3 shrink-0" />
                      )
                    ) : (
                      <ChevronsUpDown className="w-3 h-3 shrink-0 opacity-0 group-hover:opacity-40 transition-opacity" />
                    )}
                  </button>
                  {column && <span className="block text-2xs font-normal text-muted lowercase">{column.dataType}</span>}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const key = rowKeyOf(row, index);
            const selected = selectedKeys.has(key);
            return (
              <tr key={key} className={cn("border-b border-primary/60 hover:bg-hover transition-colors", selected && "bg-active")} aria-selected={selected}>
                <td className="px-2 py-1.5 align-top">
                  <input
                    type="checkbox"
                    checked={selected}
                    onChange={() => onToggleRow(row, index)}
                    aria-label={`Select row ${index + 1}`}
                    className="w-3.5 h-3.5 rounded border-primary bg-input accent-accent cursor-pointer"
                  />
                </td>
                {fields.map(field => {
                  const column = columnByName.get(field);
                  return (
                    <td
                      key={field}
                      onDoubleClick={() => onOpenRow(row)}
                      className={cn(
                        "px-3 py-1.5 align-top text-secondary max-w-xs truncate font-mono",
                        column && isNumericType(column.dataType) && "text-right tabular-nums",
                      )}
                      title={row[field] === null ? "null" : String(row[field])}
                    >
                      <CellContent value={row[field] ?? null} />
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
