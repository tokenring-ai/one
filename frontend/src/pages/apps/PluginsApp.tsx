import { CheckCircle2, Copy, ExternalLink, Package, RefreshCw, Search, Settings2, Store, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import { type ListFieldConfig, useFilteredList } from "../../hooks/useFilteredList.ts";
import { type FilterTabDefinition, useFilterTabs } from "../../hooks/useFilterTabs.ts";
import { copyToClipboard } from "../../lib/clipboard.ts";
import { cn } from "../../lib/utils.ts";
import { usePlugins } from "../../rpc.ts";

export type InstalledPlugin = {
  name: string;
  displayName: string;
  version: string;
  description: string;
  hasConfig: boolean;
};

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
  {
    key: "name",
    label: "Package name",
    compare: (a, b) => a.name.localeCompare(b.name),
  },
  {
    key: "version",
    label: "Version",
    compare: (a, b) => a.version.localeCompare(b.version, undefined, { numeric: true }) || a.displayName.localeCompare(b.displayName),
  },
];

function matchesPluginSearch(plugin: InstalledPlugin, query: string): boolean {
  const haystack = [plugin.displayName, plugin.name, plugin.description, plugin.version].join(" ").toLowerCase();
  return haystack.includes(query);
}

function pluginFilterPredicate(plugin: InstalledPlugin, filter: string): boolean {
  return filter === "all" || (filter === "configurable" && plugin.hasConfig);
}

function packageShortName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

function PluginCard({ plugin, selected, onSelect }: { plugin: InstalledPlugin; selected: boolean; onSelect: () => void }) {
  const configHref = `/configuration/${encodeURIComponent(plugin.name)}`;

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
        aria-label={`${selected ? "Deselect" : "Select"} ${plugin.displayName}`}
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
          to={configHref}
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

function PluginDetail({ plugin, onClose }: { plugin: InstalledPlugin; onClose: () => void }) {
  const configHref = `/configuration/${encodeURIComponent(plugin.name)}`;

  return (
    <aside className="bg-secondary border border-primary rounded-xl p-4 space-y-3" aria-label={`Details for ${plugin.displayName}`}>
      <div className="flex items-start gap-3">
        <div className="shrink-0 w-10 h-10 rounded-lg bg-linear-to-br from-accent to-violet-600 flex items-center justify-center shadow-sm">
          <Package className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h2 className="text-sm font-semibold text-primary truncate">{plugin.displayName}</h2>
              <p className="text-xs text-muted font-mono truncate" title={plugin.name}>
                {plugin.name}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1 rounded-md text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
              aria-label="Close plugin details"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      <p className="text-xs text-secondary whitespace-pre-wrap">{plugin.description || "No description provided."}</p>

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-xs">
        <dt className="text-muted">Version</dt>
        <dd className="font-mono text-primary">v{plugin.version}</dd>
        <dt className="text-muted">Package</dt>
        <dd className="font-mono text-primary break-all">{plugin.name}</dd>
        <dt className="text-muted">Status</dt>
        <dd className="text-emerald-600 dark:text-emerald-400 inline-flex items-center gap-1">
          <CheckCircle2 className="w-3 h-3" />
          Installed and active
        </dd>
        <dt className="text-muted">Configuration</dt>
        <dd className="text-primary">{plugin.hasConfig ? "Has settings UI" : "No config schema"}</dd>
      </dl>

      <div className="flex flex-wrap gap-2 pt-1">
        {plugin.hasConfig ? (
          <Link
            to={configHref}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-colors focus-ring"
          >
            <Settings2 className="w-3.5 h-3.5" />
            Open configuration
            <ExternalLink className="w-3 h-3 opacity-80" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs text-muted bg-tertiary border border-primary">
            <Settings2 className="w-3.5 h-3.5" />
            No configuration available
          </span>
        )}
        <button
          type="button"
          onClick={() => void copyToClipboard(plugin.name, { label: "package name" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary bg-tertiary border border-primary hover:bg-hover transition-colors focus-ring"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy package name
        </button>
        <button
          type="button"
          onClick={() => void copyToClipboard(packageShortName(plugin.name), { label: "short name" })}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary bg-tertiary border border-primary hover:bg-hover transition-colors focus-ring"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy short name
        </button>
      </div>
    </aside>
  );
}

export default function PluginsApp() {
  const plugins = usePlugins();
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const installedPlugins = plugins.data?.plugins ?? [];

  const list = useFilteredList({
    items: installedPlugins,
    matchesSearch: matchesPluginSearch,
    filterPredicate: pluginFilterPredicate,
    sortFields: PLUGIN_SORT_FIELDS,
    defaultSort: "displayName",
    defaultFilter: "all",
  });

  // Only surface details for plugins still visible under current filters.
  const selectedPlugin = selectedName ? (list.items.find(plugin => plugin.name === selectedName) ?? null) : null;
  // Treat as hard failure only when there is no cached payload (matches other apps).
  const hardError = Boolean(plugins.error && !plugins.data);
  const showStats = !(plugins.isLoading && !plugins.data) && !hardError;

  useEffect(() => {
    if (selectedName && !plugins.isLoading && !installedPlugins.some(plugin => plugin.name === selectedName)) {
      setSelectedName(null);
    }
  }, [selectedName, installedPlugins, plugins.isLoading]);

  const { tabs: filterTabs } = useFilterTabs(installedPlugins, PLUGIN_FILTER_TAB_DEFS);
  const configurableCount = filterTabs.find(tab => tab.id === "configurable")?.count ?? 0;

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      <AppPageHeader
        title="Plugins"
        subtitle="Browse installed plugins and jump into configuration"
        icon={<Package className="w-4 h-4" />}
        iconGradient="from-accent to-violet-600"
      >
        <button
          type="button"
          onClick={() => void plugins.mutate()}
          disabled={plugins.isLoading && !plugins.data}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary hover:bg-hover border border-primary transition-colors focus-ring disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", plugins.isValidating && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Stats + filters */}
          <div className="space-y-3">
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
              <label className="flex items-center gap-1.5 shrink-0 text-xs text-muted">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={list.sort}
                  onChange={event => list.setSort(event.target.value)}
                  className="bg-input border border-primary rounded-md py-1.5 px-2 text-xs text-primary focus-ring"
                  aria-label="Sort plugins"
                >
                  {PLUGIN_SORT_FIELDS.map(field => (
                    <option key={field.key} value={field.key}>
                      {field.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <FilterTabs tabs={filterTabs} value={list.filter as FilterId} onChange={list.setFilter} showZeroCounts className="bg-transparent" />
          </div>

          {/* Installed plugins */}
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-xs font-bold text-muted uppercase tracking-widest">Installed</p>
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
                    hint="Plugins are bundled with your TokenRing instance at startup. Once loaded, they appear here for inspection and configuration."
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
                  <div className={cn("grid gap-4", selectedPlugin ? "lg:grid-cols-[1fr_20rem]" : "grid-cols-1")}>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0 content-start">
                      {list.items.map(plugin => (
                        <PluginCard
                          key={plugin.name}
                          plugin={plugin}
                          selected={plugin.name === selectedName}
                          onSelect={() => setSelectedName(current => (current === plugin.name ? null : plugin.name))}
                        />
                      ))}
                    </div>
                    {selectedPlugin && (
                      <div className="lg:sticky lg:top-4 self-start">
                        <PluginDetail plugin={selectedPlugin} onClose={() => setSelectedName(null)} />
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </section>

          {/* Plugin store — no registry API yet */}
          <section>
            <p className="text-xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Plugin Store</p>
            <EmptyState
              variant="card"
              icon={Store}
              title="Coming soon"
              hint="Browse and install community plugins from the TokenRing plugin registry. Install, enable, and disable from the store are not available via RPC yet."
            />
          </section>
        </div>
      </div>
    </div>
  );
}
