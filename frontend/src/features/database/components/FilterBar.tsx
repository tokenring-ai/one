import { Filter, Plus, X } from "lucide-react";
import { FILTER_OPERATORS, FILTER_OPERATORS_BY_VALUE } from "../constants.ts";
import type { ColumnDef, DraftFilter, FilterOperator } from "../types.ts";

/**
 * Per-column filter rows. Values stay as strings here and are coerced when the
 * query is built, so a half-typed number doesn't reset the input.
 */
export default function FilterBar({
  columns,
  filters,
  onChange,
}: {
  columns: ColumnDef[];
  filters: DraftFilter[];
  onChange: (filters: DraftFilter[]) => void;
}) {
  const addFilter = () => {
    const first = columns[0];
    if (!first) return;
    onChange([...filters, { id: crypto.randomUUID(), column: first.name, op: "eq", value: "" }]);
  };

  const updateFilter = (id: string, patch: Partial<DraftFilter>) => {
    onChange(filters.map(filter => (filter.id === id ? { ...filter, ...patch } : filter)));
  };

  const removeFilter = (id: string) => {
    onChange(filters.filter(filter => filter.id !== id));
  };

  return (
    <div className="shrink-0 border-b border-primary px-3 py-2 flex flex-wrap items-center gap-2">
      <Filter className="w-3.5 h-3.5 text-muted shrink-0" />

      {filters.length === 0 && <span className="text-2xs text-muted">No filters</span>}

      {filters.map(filter => {
        const operator = FILTER_OPERATORS_BY_VALUE.get(filter.op);
        return (
          <div key={filter.id} className="flex items-center gap-1 bg-tertiary border border-primary rounded-lg px-1.5 py-1">
            <select
              value={filter.column}
              onChange={e => updateFilter(filter.id, { column: e.target.value })}
              aria-label="Filter column"
              className="bg-transparent text-2xs text-primary focus-accent rounded cursor-pointer max-w-32"
            >
              {columns.map(column => (
                <option key={column.name} value={column.name}>
                  {column.name}
                </option>
              ))}
            </select>

            <select
              value={filter.op}
              onChange={e => updateFilter(filter.id, { op: e.target.value as FilterOperator })}
              aria-label="Filter operator"
              className="bg-transparent text-2xs text-muted focus-accent rounded cursor-pointer"
            >
              {FILTER_OPERATORS.map(op => (
                <option key={op.value} value={op.value}>
                  {op.label}
                </option>
              ))}
            </select>

            {operator?.takesValue && (
              <input
                value={filter.value}
                onChange={e => updateFilter(filter.id, { value: e.target.value })}
                placeholder={operator.takesList ? "a, b, c" : "value"}
                aria-label="Filter value"
                className="bg-input border border-primary rounded px-1.5 py-0.5 text-2xs text-primary placeholder-muted focus-accent w-28"
              />
            )}

            <button
              type="button"
              onClick={() => removeFilter(filter.id)}
              className="p-0.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
              aria-label={`Remove filter on ${filter.column}`}
            >
              <X className="w-3 h-3" />
            </button>
          </div>
        );
      })}

      <button
        type="button"
        onClick={addFilter}
        disabled={columns.length === 0}
        className="flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary border-dashed rounded-lg hover:bg-hover transition-colors cursor-pointer disabled:opacity-50 focus-ring"
      >
        <Plus className="w-3 h-3" /> Filter
      </button>
    </div>
  );
}
