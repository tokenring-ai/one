import { configScopes } from "@tokenring-ai/app/config/scopes";
import { KeyRound, Plug, RefreshCw, ShieldCheck, Users } from "lucide-react";
import { useCallback, useEffect } from "react";
import { useLocation } from "react-router-dom";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorBanner from "../../components/ui/ErrorBanner.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SearchInput from "../../components/ui/SearchInput.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import { collectSettingLabels, matchingSettingLabels, nodeHasSensitiveFields } from "../../features/config/ConfigForm.tsx";
import { useSearchFilter } from "../../hooks/useSearchFilter.ts";
import { usePaneLink } from "../../layout/hooks.ts";
import { cn } from "../../lib/utils.ts";
import { useProviderStatuses } from "../../rpc.ts";
import { useRouteParamsFor } from "../panelHooks.ts";
import { seedConfigurationScope, setConfigurationScope } from "./configurationStore.ts";
import {
  AI_PROVIDERS_VIEW,
  CONFIGURATION_PLUGIN_VIEW,
  isConfigScope,
  PERMISSIONS_VIEW,
  pluginHasOverrides,
  SCOPE_META,
  USERS_VIEW,
  useConfigurationData,
  useConfigurationNavigation,
} from "./shared.tsx";

/**
 * The first row of the navigator: the "connect a model provider" screen, with how many providers are
 * connected, since nothing works until one is.
 */
function AIProvidersLink() {
  const open = usePaneLink();
  const providers = useProviderStatuses();
  const isSelected = useRouteParamsFor(AI_PROVIDERS_VIEW) !== null;
  const connected = providers.data?.providers.filter(provider => provider.state === "connected").length;
  const status =
    connected === undefined ? null : connected === 0 ? (
      <span className="block text-xs text-warning">No provider connected</span>
    ) : (
      <span className="block text-xs text-muted">{connected} connected</span>
    );
  return (
    <div className="shrink-0 p-2 border-b border-primary">
      <button
        type="button"
        onClick={() => open(AI_PROVIDERS_VIEW, {})}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer focus-ring border",
          isSelected ? "bg-active text-primary font-medium border-accent" : "border-primary text-primary hover:bg-hover",
        )}
      >
        <Plug className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium">AI providers</span>
          {status}
        </span>
        {connected === 0 && <span className="w-1.5 h-1.5 rounded-full bg-warning shrink-0" aria-hidden="true" />}
      </button>
    </div>
  );
}

/** The second row of the navigator: the standing "always allow" permissions. */
function PermissionsLink() {
  const open = usePaneLink();
  const isSelected = useRouteParamsFor(PERMISSIONS_VIEW) !== null;
  return (
    <div className="shrink-0 p-2 border-b border-primary">
      <button
        type="button"
        onClick={() => open(PERMISSIONS_VIEW, {})}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer focus-ring border",
          isSelected ? "bg-active text-primary font-medium border-accent" : "border-primary text-primary hover:bg-hover",
        )}
      >
        <ShieldCheck className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium">Permissions</span>
          <span className="block text-xs text-muted">Always-allowed actions</span>
        </span>
      </button>
    </div>
  );
}

/** The third row of the navigator: who can sign in, and signing yourself in on a phone. */
function UsersLink() {
  const open = usePaneLink();
  const isSelected = useRouteParamsFor(USERS_VIEW) !== null;
  return (
    <div className="shrink-0 p-2 border-b border-primary">
      <button
        type="button"
        onClick={() => open(USERS_VIEW, {})}
        aria-current={isSelected ? "page" : undefined}
        className={cn(
          "w-full flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer focus-ring border",
          isSelected ? "bg-active text-primary font-medium border-accent" : "border-primary text-primary hover:bg-hover",
        )}
      >
        <Users className="w-4 h-4 shrink-0 text-accent" aria-hidden="true" />
        <span className="flex-1 min-w-0">
          <span className="block truncate font-medium">Users</span>
          <span className="block text-xs text-muted">Who can sign in</span>
        </span>
      </button>
    </div>
  );
}

/**
 * Navigator for the Configuration dashboard: the scope switch, plus every
 * configurable plugin with a dot showing where it is overridden. Rows open the
 * plugin's editor panel; the plugin named by the URL is highlighted.
 */
export default function ConfigurationPluginsView() {
  const { search: locationSearch } = useLocation();
  const { schema, plugins, scope, loading, overridesFor, isScopeDirty } = useConfigurationData();
  const { openPlugin } = useConfigurationNavigation();

  const selectedName = useRouteParamsFor(CONFIGURATION_PLUGIN_VIEW)?.plugin ?? null;

  // Old deep links carry the layer as ?scope=; after the first one the scope switch owns it.
  useEffect(() => {
    const scopeParam = new URLSearchParams(locationSearch).get("scope");
    if (isConfigScope(scopeParam)) seedConfigurationScope(scopeParam);
  }, [locationSearch]);

  // Setting labels are searched too, so "api key" or "timeout" finds the plugin that owns the field.
  const searchFields = useCallback(
    (plugin: (typeof plugins)[number]) =>
      [plugin.displayName, plugin.pluginName, plugin.description, ...Object.values(plugin.slices).flatMap(node => collectSettingLabels(node))].join("\n"),
    [],
  );
  const { query: search, setQuery: setSearch, filtered: filteredPlugins } = useSearchFilter({ items: plugins, searchFields });

  /** Under a row found by a setting rather than its name: which settings matched. */
  const settingMatches = (plugin: (typeof plugins)[number]) => {
    const q = search.trim().toLowerCase();
    if (!q || `${plugin.displayName} ${plugin.pluginName} ${plugin.description}`.toLowerCase().includes(q)) return null;
    const labels = matchingSettingLabels(plugin, q);
    if (labels.length === 0) return null;
    return (
      <span className="block text-xs text-muted truncate" title={labels.join(", ")}>
        {labels.slice(0, 3).join(", ")}
        {labels.length > 3 ? ` +${labels.length - 3}` : ""}
      </span>
    );
  };

  const overridesFile = schema.data?.overridesFiles[scope];
  const otherScope = scope === "global" ? "workspace" : "global";

  let body: React.ReactNode;
  if (loading.isLoading) {
    body = <LoadingState message="Loading configuration…" size="sm" className="h-full" />;
  } else if (loading.hasHardError) {
    body = <ErrorState title="Failed to load configuration" error={loading.hardError} onRetry={loading.refresh} variant="page" />;
  } else {
    body = (
      <nav className="p-2 space-y-0.5" aria-label="Configuration plugins">
        {filteredPlugins.map(plugin => {
          const isSelected = plugin.pluginName === selectedName;
          const hasScopeOverrides = pluginHasOverrides(plugin, overridesFor(scope));
          const hasOtherOverrides = pluginHasOverrides(plugin, overridesFor(otherScope));
          return (
            <button
              key={plugin.pluginName}
              type="button"
              onClick={() => openPlugin(plugin.pluginName)}
              aria-current={isSelected ? "page" : undefined}
              className={cn(
                "w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer focus-ring",
                isSelected ? "bg-active text-primary font-medium" : "text-secondary hover:bg-hover hover:text-primary",
              )}
            >
              <span
                className={cn(
                  "w-1.5 h-1.5 rounded-full shrink-0",
                  hasScopeOverrides ? "bg-accent" : hasOtherOverrides ? "bg-muted opacity-60" : "bg-transparent",
                )}
                title={
                  hasScopeOverrides
                    ? `Has ${SCOPE_META[scope].label.toLowerCase()} overrides`
                    : hasOtherOverrides
                      ? `Has ${SCOPE_META[otherScope].label.toLowerCase()} overrides`
                      : undefined
                }
              />
              <span className="flex-1 min-w-0">
                <span className="block truncate">{plugin.displayName}</span>
                {settingMatches(plugin)}
              </span>
              {Object.values(plugin.slices).some(nodeHasSensitiveFields) && <KeyRound className="w-3 h-3 text-muted shrink-0" />}
            </button>
          );
        })}
        {plugins.length === 0 ? (
          <EmptyState variant="inline" title="No configurable plugins" hint="None of the installed plugins have settings to edit." />
        ) : (
          filteredPlugins.length === 0 && <p className="text-xs text-muted px-2.5 py-4">No plugins or settings match "{search}"</p>
        )}
      </nav>
    );
  }

  return (
    <ViewShell
      tone="sidebar"
      scroll={false}
      header={
        <NavigationSidebarHeader
          meta={plugins.length > 0 ? plugins.length : undefined}
          actions={[
            {
              icon: <RefreshCw className={cn("w-3.5 h-3.5", loading.isRefreshing && "animate-spin")} />,
              label: "Refresh",
              onClick: loading.refresh,
            },
          ]}
        />
      }
    >
      <AIProvidersLink />
      <PermissionsLink />
      <UsersLink />

      <div className="shrink-0 p-2 border-b border-primary space-y-2">
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-tertiary border border-primary" role="group" aria-label="Configuration scope">
          {configScopes.map(candidate => {
            const { label, icon: Icon, blurb } = SCOPE_META[candidate];
            const isActive = candidate === scope;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => setConfigurationScope(candidate)}
                aria-pressed={isActive}
                title={`${label} configuration — ${blurb}`}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer focus-ring",
                  isActive ? "bg-secondary text-primary shadow-sm" : "text-muted hover:text-primary",
                )}
              >
                <Icon className="w-3.5 h-3.5" />
                {label}
                {isScopeDirty(candidate) && <span className="w-1.5 h-1.5 rounded-full bg-accent" title="Unsaved changes" />}
              </button>
            );
          })}
        </div>

        {overridesFile && (
          <p className="text-xs text-muted truncate" title={overridesFile}>
            Saving to <span className="font-mono text-secondary">{overridesFile}</span>
          </p>
        )}

        <SearchInput value={search} onChange={setSearch} placeholder="Search plugins and settings…" aria-label="Search plugins" />
      </div>

      {schema.data?.overlayError && <ErrorBanner variant="error" title="Configuration overlay error" message={schema.data.overlayError} />}

      <div className="flex-1 overflow-y-auto min-h-0">{body}</div>
    </ViewShell>
  );
}
