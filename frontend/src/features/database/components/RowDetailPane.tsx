import { KeyRound, X } from "lucide-react";
import type { ColumnDef, Row } from "../types.ts";

/** Single-row view, for tables too wide to read across in the grid. */
export default function RowDetailPane({ row, columns, onClose }: { row: Row; columns: ColumnDef[]; onClose: () => void }) {
  const fields = columns.length > 0 ? columns.map(column => column.name) : Object.keys(row);
  const columnByName = new Map(columns.map(column => [column.name, column]));

  return (
    <aside
      aria-label="Row detail"
      className="absolute inset-0 z-30 w-full bg-secondary flex flex-col min-h-0 lg:relative lg:inset-auto lg:z-auto lg:w-80 lg:shrink-0 lg:border-l lg:border-primary"
    >
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-primary">
        <span className="text-2xs font-semibold text-muted uppercase tracking-wider">Row detail</span>
        <button
          type="button"
          onClick={onClose}
          className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
          aria-label="Close row detail"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      <dl className="flex-1 overflow-y-auto px-3 py-2 space-y-3">
        {fields.map(field => {
          const column = columnByName.get(field);
          const value = row[field] ?? null;
          return (
            <div key={field}>
              <dt className="flex items-center gap-1.5 text-2xs font-semibold text-muted uppercase tracking-wider mb-0.5">
                {column?.isPrimaryKey && <KeyRound className="w-2.5 h-2.5 text-amber-400 shrink-0" aria-label="Primary key" />}
                {field}
                {column && <span className="font-normal normal-case tracking-normal opacity-70">· {column.dataType}</span>}
              </dt>
              <dd className="text-xs text-primary font-mono break-words whitespace-pre-wrap">
                {value === null ? (
                  <span className="text-muted italic opacity-60">null</span>
                ) : value === "" ? (
                  <span className="text-muted italic opacity-60">empty</span>
                ) : typeof value === "boolean" ? (
                  <span className="text-muted">{String(value)}</span>
                ) : (
                  String(value)
                )}
              </dd>
            </div>
          );
        })}
      </dl>
    </aside>
  );
}
