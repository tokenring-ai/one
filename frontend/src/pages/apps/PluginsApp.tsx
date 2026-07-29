import { CheckCircle2, Copy, ExternalLink, Package, RefreshCw, Search, Settings2, Store, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
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
type SortId = "displayName" | "name" | "version";

function matchesQuery(plugin: InstalledPlugin, query: string): boolean {
  if (!query) return true;
  const haystack = [plugin.displayName, plugin.name, plugin.description, plugin.version].join(" ").toLowerCase();
  return haystack.includes(query);
}

function packageShortName(name: string): string {
  const slash = name.lastIndexOf("/");
  return slash >= 0 ? name.slice(slash + 1) : name;
}

async function copyText(text: string, label: string) {
  try {
    await navigator.clipboard.writeText(text);
    toastManager.success(`Copied ${label}`, { duration: 2000 });
  } catch {
    toastManager.error("Could not copy to clipboard", { duration: 3000 });
  }
}

function PluginCard({ plugin, selected, onSelect }: { plugin: InstalledPlugin; selected: boolean; onSelect: () => void }) {
  const configHref = `/configuration?plugin=${encodeURIComponent(plugin.name)}`;

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
              <span className="inline-flex items-center gap-0.5 text-2xs px-1.5 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 rounded-full shrink-0">
                <Settings2 className="w-2.5 h-2.5" />
                configurable
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mb-0.5 min-w-0">
            <span className="text-2xs text-muted font-mono truncate" title={plugin.name}>
              {plugin.name}
            </span>
            <span className="text-2xs text-muted font-mono shrink-0">v{plugin.version}</span>
          </div>
          <p className="text-2xs text-muted line-clamp-2">{plugin.description || "No description"}</p>
        </div>
        <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" aria-label="Installed" />
      </button>
      {plugin.hasConfig && (
        <Link
          to={configHref}
          className="inline-flex items-center gap-1 text-2xs px-2 py-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 transition-colors focus-ring shrink-0 self-start"
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
  const configHref = `/configuration?plugin=${encodeURIComponent(plugin.name)}`;

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
              <p className="text-2xs text-muted font-mono truncate" title={plugin.name}>
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

      <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1.5 text-2xs">
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
          onClick={() => void copyText(plugin.name, "package name")}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary bg-tertiary border border-primary hover:bg-hover transition-colors focus-ring"
        >
          <Copy className="w-3.5 h-3.5" />
          Copy package name
        </button>
        <button
          type="button"
          onClick={() => void copyText(packageShortName(plugin.name), "short name")}
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
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [sort, setSort] = useState<SortId>("displayName");
  const [selectedName, setSelectedName] = useState<string | null>(null);

  const installedPlugins = plugins.data?.plugins ?? [];

  const configurableCount = useMemo(() => installedPlugins.filter(plugin => plugin.hasConfig).length, [installedPlugins]);

  const filteredPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
    const list = installedPlugins.filter(plugin => {
      if (filter === "configurable" && !plugin.hasConfig) return false;
      return matchesQuery(plugin, query);
    });

    return [...list].sort((a, b) => {
      if (sort === "name") return a.name.localeCompare(b.name);
      if (sort === "version") return a.version.localeCompare(b.version, undefined, { numeric: true }) || a.displayName.localeCompare(b.displayName);
      return a.displayName.localeCompare(b.displayName) || a.name.localeCompare(b.name);
    });
  }, [installedPlugins, search, filter, sort]);

  const selectedPlugin = selectedName ? (installedPlugins.find(plugin => plugin.name === selectedName) ?? null) : null;

  useEffect(() => {
    if (selectedName && !plugins.isLoading && !installedPlugins.some(plugin => plugin.name === selectedName)) {
      setSelectedName(null);
    }
  }, [selectedName, installedPlugins, plugins.isLoading]);

  const filterTabs = [
    { id: "all" as const, label: "All", count: installedPlugins.length },
    { id: "configurable" as const, label: "Configurable", count: configurableCount },
  ];

  const hasActiveFilters = search.trim().length > 0 || filter !== "all";

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
          disabled={plugins.isLoading}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium text-muted hover:text-primary hover:bg-hover border border-primary transition-colors focus-ring disabled:opacity-50"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", plugins.isLoading && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto py-6 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto space-y-8">
          {/* Stats + filters */}
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {!plugins.isLoading && !plugins.error && (
                <>
                  <span className="text-2xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">{installedPlugins.length} installed</span>
                  <span className="text-2xs px-2 py-0.5 bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30 rounded-full">
                    {configurableCount} configurable
                  </span>
                  {hasActiveFilters && (
                    <span className="text-2xs px-2 py-0.5 bg-secondary border border-primary rounded-full text-muted">Showing {filteredPlugins.length}</span>
                  )}
                </>
              )}
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <div className="relative flex-1 min-w-0">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted pointer-events-none" />
                <input
                  type="search"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search by name, package, or description…"
                  className="w-full bg-input border border-primary rounded-md py-1.5 pl-8 pr-8 text-xs text-primary placeholder-muted focus-ring"
                  aria-label="Search plugins"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch("")}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-primary rounded focus-ring"
                    aria-label="Clear search"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
              <label className="flex items-center gap-1.5 shrink-0 text-2xs text-muted">
                <span className="sr-only sm:not-sr-only">Sort</span>
                <select
                  value={sort}
                  onChange={event => setSort(event.target.value as SortId)}
                  className="bg-input border border-primary rounded-md py-1.5 px-2 text-xs text-primary focus-ring"
                  aria-label="Sort plugins"
                >
                  <option value="displayName">Display name</option>
                  <option value="name">Package name</option>
                  <option value="version">Version</option>
                </select>
              </label>
            </div>

            <FilterTabs tabs={filterTabs} value={filter} onChange={setFilter} showZeroCounts className="bg-transparent" />
          </div>

          {/* Installed plugins */}
          <section>
            <div className="flex items-center justify-between mb-3 px-1">
              <p className="text-2xs font-bold text-muted uppercase tracking-widest">Installed</p>
              <Link to="/configuration" className="text-2xs text-muted hover:text-primary underline-offset-2 hover:underline focus-ring rounded">
                Open configuration
              </Link>
            </div>

            {plugins.isLoading && installedPlugins.length === 0 ? (
              <LoadingState message="Loading plugins…" className="py-16" />
            ) : plugins.error ? (
              <ErrorState title="Failed to load plugins" error={plugins.error} onRetry={() => void plugins.mutate()} variant="inline" className="py-6" />
            ) : installedPlugins.length === 0 ? (
              <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
                <Package className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-secondary mb-1">No plugins installed</p>
                <p className="text-2xs text-muted max-w-sm mx-auto">
                  Plugins are bundled with your TokenRing instance at startup. Once loaded, they appear here for inspection and configuration.
                </p>
              </div>
            ) : filteredPlugins.length === 0 ? (
              <div className="px-6 py-12 bg-secondary border border-primary border-dashed rounded-xl text-center">
                <Search className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
                <p className="text-sm font-medium text-secondary mb-1">No matching plugins</p>
                <p className="text-2xs text-muted max-w-sm mx-auto mb-3">
                  Nothing matches{search.trim() ? ` “${search.trim()}”` : ""}
                  {filter === "configurable" ? " in configurable plugins" : ""}.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setSearch("");
                    setFilter("all");
                  }}
                  className="text-2xs text-accent hover:text-accent-soft transition-colors focus-ring cursor-pointer"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={cn("grid gap-4", selectedPlugin ? "lg:grid-cols-[1fr_20rem]" : "grid-cols-1")}>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 min-w-0 content-start">
                  {filteredPlugins.map(plugin => (
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
          </section>

          {/* Plugin store — no registry API yet */}
          <section>
            <p className="text-2xs font-bold text-muted uppercase tracking-widest px-1 mb-3">Plugin Store</p>
            <div className="px-6 py-10 bg-secondary border border-primary border-dashed rounded-xl text-center">
              <Store className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
              <p className="text-sm font-medium text-secondary mb-1">Coming soon</p>
              <p className="text-2xs text-muted max-w-xs mx-auto">
                Browse and install community plugins from the TokenRing plugin registry. Install, enable, and disable from the store are not available via RPC
                yet.
              </p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
