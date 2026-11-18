import { CheckCircle2, Package, RefreshCw, Search, Settings2 } from "lucide-react";
import { Link } from "react-router-dom";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { type ListFieldConfig, useFilteredList } from "../../hooks/useFilteredList.ts";
import { type FilterTabDefinition, useFilterTabs } from "../../hooks/useFilterTabs.ts";
import { cn } from "../../lib/utils.ts";
import { usePlugins } from "../../rpc.ts";
import Select from "../../ui/select.tsx";
import { useRouteParamsFor } from "../panelHooks.ts";
import { configurationPath, type InstalledPlugin, PLUGIN_DETAIL_VIEW, RestartRequiredNotice, usePluginDetailOpen, usePluginsNavigation } from "./shared.tsx";

type FilterId = "all" | "configurable";

const PLUGIN_FILTER_TAB_DEFS: FilterTabDefinition<InstalledPlugin, FilterId>[] = [
  { id: "all", label: "All" },
  { id: "configurable", label: "Configurable", predicate: plugin => plugin.hasConfig },
];

const PLUGIN_SORT_FIELDS: ListFieldConfig<InstalledPlugin>[] = [
  {
    key: "displayName",
    label: "Display name",
    compare: (a, b) => a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name),
  },
  { key: "name", label: "Package name", compare: (a, b) => a.name.localeCompare(b.name) },
  {
    key: "version",
    label: "Version",
    compare: (a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }) || a.displayName.localeCompare(b.displayName),
  },
];

function matchesPluginSearch(plugin: InstalledPlugin, query: string): boolean {
  return [plugin.displayName, plugin.name, plugin.description, plugin.version].join(" ").toLowerCase().includes(query);
}

function pluginFilterPredicate(plugin: InstalledPlugin, filter: string): boolean {
  return filter === "all" || (filter === "configurable" && plugin.hasConfig);
}

function PluginCard({ plugin, selected, onSelect }: { plugin: InstalledPlugin; selected: boolean; onSelect: () => void }) {
  return (
    <div
      className={cn(
        "flex items-start gap-3 px-4 py-3 bg-secondary border rounded-xl transition-colors group",
        selected ? "border-accent ring-1 ring-accent/40" : "border-primary hover:border-accent-muted",
      )}
      data-selected={selected || undefined}
      data-plugin-name={plugin.name}
    >
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={selected}
        className="flex flex-1 items-start gap-3 min-w-0 text-left cursor-pointer focus-ring rounded-lg -m-1 p-1"
        aria-label={`${plugin.displayName} details`}
      >
        <div className="shrink-0 w-9 h-9 rounded-lg bg-linear-to-br from-accent to-violet-600 flex items-center justify-center shadow-sm">
          <Package className="w-4 h-4 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-semibold text-primary truncate">{plugin.displayName}</span>
            {plugin.hasConfig && (
              <span className="inline-flex items-center gap-0.5 text-xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full shrink-0">
                <Settings2 className="w-2.5 h-2.5" />
                configurable
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-0.5 min-w-0">
            <span className="text-xs text-muted font-mono truncate" title={plugin.name}>
              {plugin.name}
            </span>
            <span className="text-xs text-muted font-mono shrink-0">v{plugin.version}</span>
          </div>
          <p className="text-xs text-muted line-clamp-2">{plugin.description || "No description"}</p>
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-hidden="true" />
      </button>
      {plugin.hasConfig && (
        <Link
          to={configurationPath(plugin.name)}
          className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors focus-ring shrink-0 self-start"
          title={`Configure ${plugin.displayName}`}
        >
          <Settings2 className="w-3 h-3" />
          Configure
        </Link>
      )}
    </div>
  );
}

/** Navigator for the Plugins dashboard: search, filter and pick an installed plugin. */
export default function PluginListView() {
  const plugins = usePlugins();
  const routeName = useRouteParamsFor(PLUGIN_DETAIL_VIEW)?.name;
  const { openPlugin, closePlugin } = usePluginsNavigation();
  // Selection is the URL, so a reload or a shared link restores it — but only while
  // that plugin's panel is actually open; closing its tab leaves the URL behind.
  const routeSelection = routeName ?? null;
  const routePanelOpen = usePluginDetailOpen(routeSelection);
  const selectedName = routePanelOpen ? routeSelection : null;

  const installedPlugins: InstalledPlugin[] = plugins.data?.plugins ?? [];

  const list = useFilteredList({
    items: installedPlugins,
    matchesSearch: matchesPluginSearch,
    filterPredicate: pluginFilterPredicate,
    sortFields: PLUGIN_SORT_FIELDS,
    defaultSort: "displayName",
    defaultFilter: "all",
  });

  // Treat as hard failure only when there is no cached payload.
  const hardError = Boolean(plugins.error && !plugins.data);
  const showStats = !(plugins.isLoading && !plugins.data) && !hardError;

  const { tabs: filterTabs } = useFilterTabs(installedPlugins, PLUGIN_FILTER_TAB_DEFS);
  const configurableCount = filterTabs.find(tab => tab.id === "configurable")?.count ?? 0;

  return (
    <ViewShell
      pad="page"
      bodyClassName="space-y-8"
      header={
        <ViewHeader
          icon={Package}
          iconGradient="from-fuchsia-500 to-pink-600"
          title="Plugins"
          subtitle="Browse installed plugins and jump into configuration"
          actions={[
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", plugins.isValidating && "animate-spin")} />,
              label: "Refresh",
              onClick: () => void plugins.mutate(),
              disabled: plugins.isLoading && !plugins.data,
            },
          ]}
        />
      }
    >
      <div className="space-y-3">
        <RestartRequiredNotice requiresRestart={plugins.data?.requiresRestart} />
        <div className="flex flex-wrap items-center gap-2">
          {showStats && (
            <>
              <span className="text-xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">{installedPlugins.length} installed</span>
              <span className="text-xs px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full">
                {configurableCount} configurable
              </span>
              {list.hasActiveFilters && (
                <span className="text-xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">Showing {list.matchedCount}</span>
              )}
            </>
          )}
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <SearchInput
            value={list.search}
            onChange={list.setSearch}
            placeholder="Search by name, package, or description…"
            aria-label="Search plugins"
            className="flex-1 min-w-0"
          />
          <Select value={list.sort} onChange={list.setSort} aria-label="Sort plugins" className="shrink-0">
            {PLUGIN_SORT_FIELDS.map(field => (
              <option key={field.key} value={field.key}>
                {field.label}
              </option>
            ))}
          </Select>
        </div>

        <FilterTabs tabs={filterTabs} value={list.filter as FilterId} onChange={list.setFilter} showZeroCounts className="bg-transparent" />
      </div>

      <section>
        <div className="flex items-center justify-between mb-3 px-1">
          <SectionLabel>Installed</SectionLabel>
          <Link to="/configuration" className="text-xs text-muted hover:text-primary underline-offset-2 hover:underline focus-ring rounded">
            Open configuration
          </Link>
        </div>

        {plugins.isLoading && !plugins.data ? (
          <LoadingState message="Loading plugins…" className="py-16" />
        ) : hardError ? (
          <ErrorState title="Failed to load plugins" error={plugins.error} onRetry={() => void plugins.mutate()} variant="inline" className="py-6" />
        ) : (
          <>
            {plugins.error && (
              <ErrorState
                title="Could not refresh plugins"
                error={plugins.error}
                onRetry={() => void plugins.mutate()}
                variant="inline"
                className="py-3 mb-3"
              />
            )}
            {installedPlugins.length === 0 ? (
              <EmptyState
                variant="card"
                icon={Package}
                title="No plugins installed"
                hint={<>Plugins are built into this TokenRing One installation, so they can't be added or removed here.</>}
              />
            ) : list.items.length === 0 ? (
              <EmptyState
                variant="card"
                icon={Search}
                title="No matching plugins"
                hint={
                  <>
                    Nothing matches{list.search.trim() ? ` “${list.search.trim()}”` : ""}
                    {list.filter === "configurable" ? " in configurable plugins" : ""}.
                  </>
                }
                action={
                  <button
                    type="button"
                    onClick={list.clearFilters}
                    className="text-xs text-accent hover:text-accent-soft transition-colors focus-ring cursor-pointer"
                  >
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0 content-start">
                {list.items.map(plugin => (
                  <PluginCard
                    key={plugin.name}
                    plugin={plugin}
                    selected={plugin.name === selectedName}
                    onSelect={() => (plugin.name === selectedName ? closePlugin(plugin.name) : openPlugin(plugin.name))}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </section>

      <section>
        <SectionLabel className="px-1 mb-2">Adding plugins</SectionLabel>
        <p className="px-1 text-xs text-muted">
          Plugins are built into this TokenRing One installation, so they can't be added or removed here. To change their settings, open Configuration.
        </p>
      </section>
    </ViewShell>
  );
}
