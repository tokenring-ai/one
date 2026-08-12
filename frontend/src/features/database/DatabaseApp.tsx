import { Database, Lock, Table2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AgentLaunchPanel from "../../components/ui/AgentLaunchPanel.tsx";
import PaginationControls from "../../components/ui/PaginationControls.tsx";
import PanelToolbar from "../../components/ui/PanelToolbar.tsx";
import { useCyclicSort } from "../../hooks/useCyclicSort.ts";
import { useDebounce } from "../../hooks/useDebounce.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { databaseRPCClient, useDatabaseConfiguration, useDatabaseTables, useTableRows, useTableSchema } from "../../rpc.ts";
import DatasourceFormModal from "./components/DatasourceFormModal.tsx";
import DatasourceSidebar from "./components/DatasourceSidebar.tsx";
import FilterBar from "./components/FilterBar.tsx";
import RowDetailPane from "./components/RowDetailPane.tsx";
import RowGrid from "./components/RowGrid.tsx";
import { DATABASE_AGENT_TYPE, PAGE_SIZE } from "./constants.ts";
import { draftFiltersToQuery } from "./filterQuery.ts";
import type { DatasourceSummary, DraftFilter, Row } from "./types.ts";

const FILTER_DEBOUNCE_MS = 300;

/**
 * Stable identity for selection / React state. Prefer the primary key when the
 * table has one; otherwise fingerprint the full row so sort/filter/pagination
 * do not reshuffle selection. Index is intentionally not part of the key.
 */
function rowKeyOf(row: Row, _index: number, primaryKey: string[]): string {
  if (primaryKey.length > 0) {
    return primaryKey.map(column => JSON.stringify(row[column] ?? null)).join("|");
  }
  try {
    return JSON.stringify(row);
  } catch {
    // Non-serializable cell values are rare; collapse them rather than use index
    // (index keys corrupt selection when the page is reordered).
    return "unserializable";
  }
}

export default function DatabaseApp() {
  const navigate = useNavigate();
  const { datasource: routeDatasource } = useParams<{ datasource?: string }>();
  // URL is the source of truth for which datasource is open (params are already decoded).
  const activeDatasource = routeDatasource ?? null;

  const configuration = useDatabaseConfiguration();
  const datasources = configuration.data?.datasources ?? [];
  const allowedAgentTypes = configuration.data?.agentTypes ?? [DATABASE_AGENT_TYPE];
  const defaultAgentType = allowedAgentTypes[0] ?? DATABASE_AGENT_TYPE;

  const [activeTable, setActiveTable] = useState<string | null>(null);
  const [draftFilters, setDraftFilters] = useState<DraftFilter[]>([]);
  // Debounce filter edits so every keystroke doesn't fire a new selectRows call.
  // Empty drafts apply immediately (table switch / clear) so we never query the new
  // table with the previous table's filters during the debounce window.
  const debouncedFilters = useDebounce(draftFilters, FILTER_DEBOUNCE_MS);
  const appliedFilters = draftFilters.length === 0 ? draftFilters : debouncedFilters;
  const [offset, setOffset] = useState(0);
  const { orderBy, handleSort, clearSort } = useCyclicSort({
    onSortChange: () => setOffset(0),
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(() => new Set());
  const [selectedRowsByKey, setSelectedRowsByKey] = useState<Map<string, Row>>(() => new Map());
  const [detailRow, setDetailRow] = useState<Row | null>(null);
  const [formMode, setFormMode] = useState<{ existing?: DatasourceSummary } | null>(null);
  const [agentId, setAgentId] = useState<string | null>(null);
  /** AgentLaunchPanel calls attach once per selected key; bulk-sync only on the first call per agent. */
  const preparedAgentRef = useRef<string | null>(null);

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
    if (configuration.isLoading) return;
    if (datasources.length === 0) {
      if (routeDatasource) openDatasource(null, { replace: true });
      setActiveTable(null);
      return;
    }
    if (!activeDatasource || !datasources.some(ds => ds.name === activeDatasource)) {
      openDatasource(datasources[0]!.name, { replace: true });
      setActiveTable(null);
    }
  }, [datasources, activeDatasource, routeDatasource, configuration.isLoading, openDatasource]);

  // Drop selection / paging / filters when the table context changes.
  // appliedFilters follows draftFilters via useDebounce.
  useEffect(() => {
    setDraftFilters([]);
    clearSort();
    setOffset(0);
    setSelectedKeys(new Set());
    setSelectedRowsByKey(new Map());
    setDetailRow(null);
  }, [activeDatasource, activeTable, clearSort]);

  // Keep the agent pointed at whatever the user is looking at so tools can act on it.
  useEffect(() => {
    if (!agentId || !activeDatasource) return;
    toastOnReject(
      databaseRPCClient.updateDatabaseState({
        agentId,
        datasource: activeDatasource,
        ...(activeTable ? { table: activeTable } : {}),
        selectedRows: Array.from(selectedRowsByKey.values()),
      }),
    );
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
    void configuration.mutate();
    void tablesQuery.mutate();
    void schemaQuery.mutate();
    void rowsQuery.mutate();
  }, [configuration, tablesQuery, schemaQuery, rowsQuery]);

  const handleDatasourceSaved = useCallback(
    (name: string) => {
      void configuration.mutate().then(() => {
        setActiveTable(null);
        openDatasource(name);
      });
    },
    [configuration, openDatasource],
  );

  const clearRowSelection = useCallback(() => {
    setSelectedKeys(new Set());
    setSelectedRowsByKey(new Map());
  }, []);

  /**
   * Domain agents receive the full selection in one `updateDatabaseState` call.
   * The panel invokes this per key, so only the first call for an agent id does work.
   */
  const attachSelectedRowsToAgent = useCallback(
    async (newAgentId: string, _itemId: string) => {
      if (preparedAgentRef.current === newAgentId) return;
      preparedAgentRef.current = newAgentId;
      if (!activeDatasource) return;
      await databaseRPCClient.updateDatabaseState({
        agentId: newAgentId,
        datasource: activeDatasource,
        ...(activeTable ? { table: activeTable } : {}),
        selectedRows: Array.from(selectedRowsByKey.values()),
      });
    },
    [activeDatasource, activeTable, selectedRowsByKey],
  );

  const openAgentWithSelection = useCallback((id: string) => {
    setDetailRow(null);
    setAgentId(id);
  }, []);

  const activeDatasourceMeta = datasources.find(ds => ds.name === activeDatasource);

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
            datasourcesLoading={configuration.isLoading}
            datasourcesError={configuration.error}
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
                <span className="inline-flex items-center gap-1 text-xs text-muted border border-primary rounded px-1.5 py-0.5">
                  <Lock className="w-3 h-3" /> Read-only
                </span>
              )}
              <span className="text-xs text-muted truncate">{activeDatasource}</span>
              <div className="flex-1" />
              <PaginationControls
                offset={offset}
                pageSize={PAGE_SIZE}
                // Backend computes hasMore from the same totalCount/limit math; trust it as
                // the sole authority so a stale totalCount alone cannot open an empty page.
                hasMore={hasMore}
                itemCount={rows.length}
                totalCount={totalCount}
                loading={rowsQuery.isLoading}
                selectionCount={selectedKeys.size}
                showRefresh
                onRefresh={() => void rowsQuery.mutate()}
                onPageChange={setOffset}
              />
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
      <PanelToolbar
        icon={Database}
        iconGradient="from-cyan-500 to-blue-600"
        title="Database"
        actions={
          // Always-available launcher for browsing without a row selection.
          // When rows are selected, prefer the bottom AgentLaunchPanel.
          <AgentLauncherBar
            defaultAgentType={defaultAgentType}
            allowedAgentTypes={allowedAgentTypes}
            buttonLabel="Open Agent"
            buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
            onLaunch={openAgentWithSelection}
          />
        }
      />

      <div className="flex-1 min-h-0">
        <ChatDock agentId={agentId} storageKey="database" initialRatio={0.65} headerTitle="Database Agent">
          {body}
        </ChatDock>
      </div>

      {selectedKeys.size > 0 && (
        <AgentLaunchPanel
          selectedItems={selectedKeys}
          itemLabel="row"
          onClear={clearRowSelection}
          attachItemToAgent={attachSelectedRowsToAgent}
          onNavigateToAgent={openAgentWithSelection}
          defaultAgentType={defaultAgentType}
          allowedAgentTypes={allowedAgentTypes}
          launchLabel="Open Agent"
        />
      )}

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
