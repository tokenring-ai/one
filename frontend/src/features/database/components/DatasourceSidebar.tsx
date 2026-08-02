import { ChevronRight, Database, Eye, Lock, Pencil, Plus, RefreshCw, Table2 } from "lucide-react";
import { useEffect, useState } from "react";
import ErrorState from "../../../components/ui/ErrorState.tsx";
import LoadingState from "../../../components/ui/LoadingState.tsx";
import { cn } from "../../../lib/utils.ts";
import type { DatasourceSummary, TableRef } from "../types.ts";

/**
 * Datasource list; the active one expands in place into its tables. Tables are
 * only fetched for the expanded datasource, so opening the app doesn't connect
 * to every configured database at once.
 */
export default function DatasourceSidebar({
  datasources,
  datasourcesLoading,
  datasourcesError,
  activeDatasource,
  tables,
  tablesLoading,
  tablesError,
  activeTable,
  onSelectDatasource,
  onSelectTable,
  onAddDatasource,
  onEditDatasource,
  onRefresh,
}: {
  datasources: DatasourceSummary[];
  datasourcesLoading: boolean;
  datasourcesError: unknown;
  activeDatasource: string | null;
  tables: TableRef[];
  tablesLoading: boolean;
  tablesError: unknown;
  activeTable: string | null;
  onSelectDatasource: (name: string) => void;
  onSelectTable: (table: string) => void;
  onAddDatasource: () => void;
  onEditDatasource: (datasource: DatasourceSummary) => void;
  onRefresh: () => void;
}) {
  const [tableFilter, setTableFilter] = useState("");

  // A filter typed for one datasource shouldn't hide tables after switching.
  useEffect(() => {
    setTableFilter("");
  }, [activeDatasource]);

  const filteredTables = tableFilter.trim() ? tables.filter(table => table.name.toLowerCase().includes(tableFilter.trim().toLowerCase())) : tables;

  return (
    <>
      <div className="shrink-0 flex items-center justify-between gap-2 px-3 py-2 border-b border-primary">
        <span className="text-2xs font-semibold text-muted uppercase tracking-wider">Datasources</span>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
          </button>
          <button
            type="button"
            onClick={onAddDatasource}
            className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
            title="Add datasource"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {datasourcesLoading && datasources.length === 0 ? (
          <LoadingState message="Loading datasources…" size="sm" className="py-8" />
        ) : datasourcesError ? (
          <ErrorState title="Failed to load datasources" error={datasourcesError} onRetry={onRefresh} variant="inline" className="py-6" />
        ) : datasources.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <Database className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">No datasources configured</p>
            <button type="button" onClick={onAddDatasource} className="text-xs text-accent hover:text-accent-soft cursor-pointer transition-colors focus-ring">
              Add your first datasource →
            </button>
          </div>
        ) : (
          datasources.map(datasource => {
            const isActive = datasource.name === activeDatasource;
            return (
              <div key={datasource.name}>
                <div
                  className={cn(
                    "group w-full flex items-center gap-2 px-3 py-2 border-b border-primary hover:bg-hover transition-colors border-l-2",
                    isActive ? "bg-active border-l-accent" : "border-l-transparent",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => onSelectDatasource(datasource.name)}
                    className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer focus-ring rounded"
                    aria-expanded={isActive}
                  >
                    <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 text-muted transition-transform", isActive && "rotate-90")} />
                    <Database className={cn("w-4 h-4 shrink-0", isActive ? "text-cyan-400" : "text-muted")} />
                    <span className={cn("text-sm truncate", isActive ? "text-primary font-medium" : "text-secondary")}>{datasource.name}</span>
                    {!datasource.allowWrites && <Lock className="w-3 h-3 shrink-0 text-muted" aria-label="Read-only" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => onEditDatasource(datasource)}
                    className="p-1 text-muted hover:text-primary rounded opacity-0 group-hover:opacity-100 focus:opacity-100 transition-all cursor-pointer focus-ring shrink-0"
                    title={`Edit ${datasource.name}`}
                  >
                    <Pencil className="w-3 h-3" />
                  </button>
                </div>

                {isActive && (
                  <div className="bg-primary/40">
                    {tables.length > 8 && (
                      <div className="px-3 py-1.5 border-b border-primary">
                        <input
                          type="search"
                          value={tableFilter}
                          onChange={e => setTableFilter(e.target.value)}
                          placeholder="Filter tables…"
                          aria-label="Filter tables"
                          className="w-full bg-input border border-primary rounded py-1 px-2 text-2xs text-primary placeholder-muted focus-accent"
                        />
                      </div>
                    )}

                    {tablesLoading ? (
                      <LoadingState message="Loading tables…" size="sm" className="py-6" />
                    ) : tablesError ? (
                      <ErrorState title="Failed to load tables" error={tablesError} onRetry={onRefresh} variant="inline" className="py-4" />
                    ) : filteredTables.length === 0 ? (
                      <p className="text-2xs text-muted px-3 py-4 text-center">{tableFilter ? `No tables matching "${tableFilter}"` : "No tables"}</p>
                    ) : (
                      filteredTables.map(table => (
                        <button
                          type="button"
                          key={`${table.schema ?? ""}.${table.name}`}
                          onClick={() => onSelectTable(table.name)}
                          className={cn(
                            "w-full flex items-center gap-2 pl-8 pr-3 py-1.5 text-left hover:bg-hover transition-colors cursor-pointer focus-ring",
                            table.name === activeTable ? "bg-active text-primary font-medium" : "text-muted hover:text-primary",
                          )}
                          aria-current={table.name === activeTable ? "true" : undefined}
                        >
                          {table.type === "view" ? <Eye className="w-3.5 h-3.5 shrink-0" /> : <Table2 className="w-3.5 h-3.5 shrink-0" />}
                          <span className="text-xs truncate">{table.name}</span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </>
  );
}
