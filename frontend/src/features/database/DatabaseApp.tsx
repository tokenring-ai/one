import { ChevronLeft, ChevronRight, Database, Lock, RefreshCw, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import { databaseRPCClient, useDatabaseTables, useDatasources, useTableRows, useTableSchema } from "../../rpc.ts";
import DatasourceFormModal from "./components/DatasourceFormModal.tsx";
import DatasourceSidebar from "./components/DatasourceSidebar.tsx";
import FilterBar from "./components/FilterBar.tsx";
import RowDetailPane from "./components/RowDetailPane.tsx";
import RowGrid from "./components/RowGrid.tsx";
import { DATABASE_AGENT_TYPE, PAGE_SIZE } from "./constants.ts";
import { draftFiltersToQuery } from "./filterQuery.ts";
import type { DatasourceSummary, DraftFilter, OrderBy, Row } from "./types.ts";

const FILTER_DEBOUNCE_MS = 300;

function rowKeyOf(row: Row, index: number, primaryKey: string[]): string {
  if (primaryKey.length > 0) {
    return primaryKey.map(column => JSON.stringify(row[column] ?? null)).join("|");
  }
  // No PK — fall back to a stable-ish fingerprint of the visible cells plus index
  // so two identical rows on the same page stay distinct for selection.
  try {
    return `${index}:${JSON.stringify(row)}`;
  } catch {
    return String(index);
  }
}

export default function DatabaseApp() {
  const navigate = useNavigate();
  const { datasource: routeDatasource } = useParams<{ datasource?: string }>();
  // URL is the source of truth for which datasource is open (params are already decoded).
  const activeDatasource = routeDatasource ?? null;

  const datasourcesQuery = useDatasources();
  const datasources = datasourcesQuery.data?.datasources ?? [];

  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftFilter[]>([]);
  const [appliedFilters, setAppliedFilters] = useState<DraftFilter[]>([]);
  const [orderBy, setOrderBy] = useState<OrderBy[]>([]);
  const [offset, setOffset] = useState(0);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectedRowsByKey, setSelectedRowsByKey] = useState<Map<string, Row>>(() => new Map());
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [formMode, setFormMode] = useState<{ existing?: DatasourceSummary } | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);

  const tablesQuery = useDatabaseTables(activeDatasource ?? undefined);
  const tables = tablesQuery.data?.tables ?? [];

  const schemaQuery = useTableSchema(activeDatasource ?? undefined, activeTable ?? undefined);
  const columns = schemaQuery.data?.schema.columns ?? [];
  const primaryKey = schemaQuery.data?.schema.primaryKey ?? [];

  const openDatasource = useCallback(
    (name: string | null, options?: { replace?: boolean }) => {
      const path = name ? `/database/${encodeURIComponent(name)}` : "/database";
      void navigate(path, options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  // Debounce filter edits so every keystroke doesn't fire a new selectRows call.
  useEffect(() => {
    const handle = window.setTimeout(() => setAppliedFilters(draftFilters), FILTER_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [draftFilters]);

  const queryFilters = useMemo(() => draftFiltersToQuery(appliedFilters, columns), [appliedFilters, columns]);

  const rowQuery = useMemo(
    () => ({
      ...(queryFilters.length > 0 ? { filters: queryFilters } : {}),
      ...(orderBy.length > 0 ? { orderBy } : {}),
      limit: PAGE_SIZE,
      offset,
    }),
    [queryFilters, orderBy, offset],
  );

  const rowsQuery = useTableRows(activeDatasource ?? undefined, activeTable ?? undefined, rowQuery);
  const rows = rowsQuery.data?.rows ?? [];
  const fields = rowsQuery.data?.fields ?? columns.map(column => column.name);
  const totalCount = rowsQuery.data?.totalCount ?? null;
  const hasMore = rowsQuery.data?.hasMore ?? false;

  // Keep a valid datasource selected as the list loads and changes; bare `/database` opens the first one.
  useEffect(() => {
    if (datasourcesQuery.isLoading) return;
    if (datasources.length === 0) {
      if (routeDatasource) openDatasource(null, { replace: true });
      setActiveTable(null);
      return;
    }
    if (!activeDatasource || !datasources.some(ds => ds.name === activeDatasource)) {
      openDatasource(datasources[0]!.name, { replace: true });
      setActiveTable(null);
    }
  }, [datasources, activeDatasource, routeDatasource, datasourcesQuery.isLoading, openDatasource]);

  // Drop selection / paging / filters when the table context changes.
  useEffect(() => {
    setDraftFilters([]);
    setAppliedFilters([]);
    setOrderBy([]);
    setOffset(0);
    setSelectedKeys(new Set());
    setSelectedRowsByKey(new Map());
    setDetailRow(null);
  }, [activeDatasource, activeTable]);

  // Keep the agent pointed at whatever the user is looking at so tools can act on it.
  useEffect(() => {
    if (!agentId || !activeDatasource) return;
    databaseRPCClient
      .updateDatabaseState({
        agentId,
        datasource: activeDatasource,
        ...(activeTable ? { table: activeTable } : {}),
        selectedRows: Array.from(selectedRowsByKey.values()),
      })
      .catch(() => {});
  }, [agentId, activeDatasource, activeTable, selectedRowsByKey]);

  const handleSelectDatasource = useCallback(
    (name: string) => {
      if (name === activeDatasource) return;
      setActiveTable(null);
      openDatasource(name);
    },
    [activeDatasource, openDatasource],
  );

  const handleSelectTable = useCallback((table: string) => {
    setActiveTable(table);
  }, []);

  const handleSort = useCallback((column: string) => {
    setOrderBy(prev => {
      const existing = prev.find(order => order.column === column);
      if (!existing) return [{ column, direction: "asc" }];
      if (existing.direction === "asc") return [{ column, direction: "desc" }];
      return [];
    });
    setOffset(0);
  }, []);

  const handleFiltersChange = useCallback((next: DraftFilter[]) => {
    setDraftFilters(next);
    setOffset(0);
  }, []);

  const keyOf = useCallback((row: Row, index: number) => rowKeyOf(row, index, primaryKey), [primaryKey]);

  const handleToggleRow = useCallback(
    (row: Row, index: number) => {
      const key = keyOf(row, index);
      setSelectedKeys(prev => {
        const next = new Set(prev);
        if (next.has(key)) next.delete(key);
        else next.add(key);
        return next;
      });
      setSelectedRowsByKey(prev => {
        const next = new Map(prev);
        if (next.has(key)) next.delete(key);
        else next.set(key, row);
        return next;
      });
    },
    [keyOf],
  );

  const handleToggleAll = useCallback(() => {
    const allKeys = rows.map((row, index) => keyOf(row, index));
    const allSelected = allKeys.length > 0 && allKeys.every(key => selectedKeys.has(key));
    if (allSelected) {
      setSelectedKeys(prev => {
        const next = new Set(prev);
        for (const key of allKeys) next.delete(key);
        return next;
      });
      setSelectedRowsByKey(prev => {
        const next = new Map(prev);
        for (const key of allKeys) next.delete(key);
        return next;
      });
      return;
    }
    setSelectedKeys(prev => {
      const next = new Set(prev);
      for (const key of allKeys) next.add(key);
      return next;
    });
    setSelectedRowsByKey(prev => {
      const next = new Map(prev);
      rows.forEach((row, index) => {
        next.set(keyOf(row, index), row);
      });
      return next;
    });
  }, [keyOf, rows, selectedKeys]);

  const handleRefresh = useCallback(() => {
    void datasourcesQuery.mutate();
    void tablesQuery.mutate();
    void schemaQuery.mutate();
    void rowsQuery.mutate();
  }, [datasourcesQuery, tablesQuery, schemaQuery, rowsQuery]);

  const handleDatasourceSaved = useCallback(
    (name: string) => {
      void datasourcesQuery.mutate().then(() => {
        setActiveTable(null);
        openDatasource(name);
      });
    },
    [datasourcesQuery, openDatasource],
  );

  const activeDatasourceMeta = datasources.find(ds => ds.name === activeDatasource);
  const pageStart = rows.length === 0 ? 0 : offset + 1;
  const pageEnd = offset + rows.length;
  const canPrev = offset > 0;
  const canNext = hasMore || (totalCount !== null && offset + rows.length < totalCount);

  const rangeLabel = (() => {
    if (!activeTable) return null;
    if (rowsQuery.isLoading && rows.length === 0) return "Loading…";
    if (totalCount !== null) {
      return `${pageStart}–${pageEnd} of ${totalCount}`;
    }
    if (rows.length === 0) return "0 rows";
    return hasMore ? `${pageStart}–${pageEnd}+` : `${pageStart}–${pageEnd}`;
  })();

  const body = (
    <WorkspaceShell
      appId="database"
      title="Database"
      navigationLabel="Datasources and tables"
      hasSelection={activeTable !== null}
      navigation={
        <div className="h-full flex flex-col min-h-0 bg-secondary">
          <DatasourceSidebar
            datasources={datasources}
            datasourcesLoading={datasourcesQuery.isLoading}
            datasourcesError={datasourcesQuery.error}
            activeDatasource={activeDatasource}
            tables={tables}
            tablesLoading={tablesQuery.isLoading}
            tablesError={tablesQuery.error}
            activeTable={activeTable}
            onSelectDatasource={handleSelectDatasource}
            onSelectTable={handleSelectTable}
            onAddDatasource={() => setFormMode({})}
            onEditDatasource={datasource => setFormMode({ existing: datasource })}
            onRefresh={handleRefresh}
          />
        </div>
      }
    >
      <div className="h-full flex flex-col min-h-0 bg-primary">
        {!activeDatasource ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Database className="w-10 h-10 text-muted opacity-30" />
            <div>
              <h2 className="text-sm font-semibold text-primary mb-1">Select a datasource</h2>
              <p className="text-xs text-muted max-w-sm">Pick a database on the left, or add one if none are configured yet.</p>
            </div>
          </div>
        ) : !activeTable ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-6">
            <Table2 className="w-10 h-10 text-muted opacity-30" />
            <div>
              <h2 className="text-sm font-semibold text-primary mb-1">Select a table</h2>
              <p className="text-xs text-muted max-w-sm">
                Browse tables under <span className="font-mono text-secondary">{activeDatasource}</span> to inspect rows.
              </p>
            </div>
          </div>
        ) : (
          <>
            <div className="shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3">
              <span className="text-sm font-semibold text-primary truncate font-mono">{activeTable}</span>
              {activeDatasourceMeta && !activeDatasourceMeta.allowWrites && (
                <span className="inline-flex items-center gap-1 text-2xs text-muted border border-primary rounded px-1.5 py-0.5">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              )}
              <span className="text-2xs text-muted truncate">{activeDatasource}</span>
              <div className="flex-1" />
              {selectedKeys.size > 0 && <span className="text-2xs text-muted">{selectedKeys.size} selected</span>}
              {rangeLabel && <span className="text-2xs text-muted tabular-nums">{rangeLabel}</span>}
              <button
                type="button"
                onClick={() => void rowsQuery.mutate()}
                className="p-1.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
                title="Refresh rows"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canPrev || rowsQuery.isLoading}
                onClick={() => setOffset(prev => Math.max(0, prev - PAGE_SIZE))}
                className="p-1.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={!canNext || rowsQuery.isLoading}
                onClick={() => setOffset(prev => prev + PAGE_SIZE)}
                className="p-1.5 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <FilterBar columns={columns} filters={draftFilters} onChange={handleFiltersChange} />

            <div className="relative flex-1 flex min-h-0">
              <RowGrid
                rows={rows}
                columns={columns}
                fields={fields.length > 0 ? fields : columns.map(column => column.name)}
                orderBy={orderBy}
                selectedKeys={selectedKeys}
                rowKeyOf={keyOf}
                loading={rowsQuery.isLoading || schemaQuery.isLoading}
                error={rowsQuery.error ?? schemaQuery.error}
                onToggleRow={handleToggleRow}
                onToggleAll={handleToggleAll}
                onSort={handleSort}
                onRetry={() => {
                  void schemaQuery.mutate();
                  void rowsQuery.mutate();
                }}
                onOpenRow={row => {
                  setAgentId(null);
                  setDetailRow(row);
                }}
                hasActiveFilters={queryFilters.length > 0}
              />
              {detailRow && <RowDetailPane row={detailRow} columns={columns} onClose={() => setDetailRow(null)} />}
            </div>
          </>
        )}
      </div>
    </WorkspaceShell>
  );

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-primary">
      <div className="shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-sm shrink-0">
          <Database className="w-4 h-4 text-white" />
        </div>
        <span className="text-sm font-semibold text-primary">Database</span>
        <div className="flex-1" />
        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
        <AgentLauncherBar
          defaultAgentType={DATABASE_AGENT_TYPE}
          buttonLabel="Open Agent"
          buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
          onLaunch={id => {
            setDetailRow(null);
            setAgentId(id);
          }}
        />
      </div>

      <div className="flex-1 min-h-0">
        <ChatDock agentId={agentId} storageKey="database" initialRatio={0.65} headerTitle="Database Agent">
          {body}
        </ChatDock>
      </div>

      {formMode && (
        <DatasourceFormModal
          {...(formMode.existing ? { existing: formMode.existing } : {})}
          onClose={() => setFormMode(null)}
          onSaved={name => {
            handleDatasourceSaved(name);
          }}
        />
      )}
    </div>
  );
}
