import { type ConfigScope, configScopes } from "@tokenring-ai/app/config/scopes";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import deepEqual from "@tokenring-ai/utility/object/deepEqual";
import { AlertTriangle, FolderGit2, KeyRound, Search, SlidersHorizontal, User } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ConfigForm, { nodeHasSensitiveFields } from "../../features/config/ConfigForm.tsx";
import type { ConfigIssue } from "../../features/config/ConfigNodeRenderer.tsx";
import { cn } from "../../lib/utils.ts";
import { configRPCClient, useConfigSchema, useConfigValues } from "../../rpc.ts";

type Drafts = Record<ConfigScope, Record<string, unknown> | null>;

const SCOPE_META: Record<ConfigScope, { label: string; icon: typeof User; blurb: string }> = {
  global: { label: "Global", icon: User, blurb: "applies everywhere you run TokenRing" },
  workspace: { label: "Workspace", icon: FolderGit2, blurb: "applies to this workspace and takes precedence over user settings" },
};

const isScope = (value: string | null): value is ConfigScope => configScopes.includes(value as ConfigScope);

export default function ConfigurationApp() {
  const navigate = useNavigate();
  const { plugin: routePlugin } = useParams<{ plugin?: string }>();
  const schema = useConfigSchema();
  const values = useConfigValues();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL path is the source of truth for which plugin is open (params are already decoded).
  const selectedName = routePlugin ?? null;

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Drafts>({ global: null, workspace: null });
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** Bumped on discard/save so field-local UI state (secret source pick, JSON draft text) remounts cleanly. */
  const [formGeneration, setFormGeneration] = useState(0);
  /** Synchronous guard — React state alone cannot prevent a double-click before re-render. */
  const saveInFlightRef = useRef(false);

  const scopeParam = searchParams.get("scope");
  const scope: ConfigScope = isScope(scopeParam) ? scopeParam : "global";

  const serverOverrides = values.data?.overrides;
  const scopeOverrides = serverOverrides?.[scope];
  const draft = drafts[scope];

  const needsDraftSeed = configScopes.some(candidate => drafts[candidate] === null);

  // Seed / reseed each scope's draft whenever it is null and server overrides are available.
  // Depends on needsDraftSeed so a post-save null draft reseeds even if the server snapshot is unchanged.
  useEffect(() => {
    if (!serverOverrides || !needsDraftSeed) return;
    setDrafts(current => {
      const next = { ...current };
      let changed = false;
      for (const candidate of configScopes) {
        if (next[candidate] === null) {
          // Always seed an object — a missing scope key must not leave draft as undefined
          // (which is not null, so it would skip reseeding and break dirty checks).
          next[candidate] = deepClone(serverOverrides[candidate]);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [serverOverrides, needsDraftSeed]);

  const plugins = useMemo(() => {
    const list = schema.data?.plugins ?? [];
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [schema.data]);

  const filteredPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plugins;
    return plugins.filter(
      plugin =>
        plugin.displayName.toLowerCase().includes(query) || plugin.pluginName.toLowerCase().includes(query) || plugin.description.toLowerCase().includes(query),
    );
  }, [plugins, search]);

  const selectedPlugin: ConfigUIPluginSchema | undefined = plugins.find(plugin => plugin.pluginName === selectedName) ?? filteredPlugins[0];

  const isScopeDirty = (candidate: ConfigScope) => {
    const candidateDraft = drafts[candidate];
    if (candidateDraft === null) return false;
    const candidateServer = serverOverrides?.[candidate] ?? {};
    return !deepEqual(candidateDraft, candidateServer);
  };
  const dirty = isScopeDirty(scope);

  const pluginHasOverrides = (plugin: ConfigUIPluginSchema, target: ConfigScope) => {
    const source = drafts[target] ?? serverOverrides?.[target] ?? {};
    return Object.keys(plugin.slices).some(sliceKey => source[sliceKey] !== undefined);
  };

  /** Issues whose root path segment belongs to the currently selected plugin's slices. */
  const selectedSliceKeys = useMemo(() => (selectedPlugin ? new Set(Object.keys(selectedPlugin.slices)) : new Set<string>()), [selectedPlugin]);
  const issuesOnOtherPlugins = issues.filter(issue => issue.path.length === 0 || !selectedSliceKeys.has(String(issue.path[0])));

  /** Slices of the selected plugin that a higher-precedence scope also sets. */
  const shadowedByProject = scope === "global" && selectedPlugin !== undefined && pluginHasOverrides(selectedPlugin, "workspace");

  /** Clears server validation / save feedback so the user can keep editing cleanly. */
  const clearValidationFeedback = () => {
    setIssues([]);
    setSaveMessage(null);
  };

  const selectScope = (next: ConfigScope) => {
    const params = new URLSearchParams(searchParams);
    params.set("scope", next);
    // Drop legacy ?plugin= if present; plugin lives in the path now.
    params.delete("plugin");
    setSearchParams(params);
    clearValidationFeedback();
  };

  const selectPlugin = (pluginName: string) => {
    const params = new URLSearchParams(searchParams);
    params.delete("plugin");
    const qs = params.toString();
    void navigate(`/configuration/${encodeURIComponent(pluginName)}${qs ? `?${qs}` : ""}`);
    clearValidationFeedback();
  };

  const save = async () => {
    if (!draft || saving || saveInFlightRef.current) return;
    // Capture scope + draft at click time so a mid-flight scope switch cannot
    // reseed or label the wrong layer.
    const saveScope = scope;
    const saveDraft = draft;
    saveInFlightRef.current = true;
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await configRPCClient.applyConfig({ scope: saveScope, overrides: saveDraft });
      if (result.ok) {
        setIssues([]);
        setSaveMessage(`Saved to ${SCOPE_META[saveScope].label.toLowerCase()} configuration`);
        // Server may prune equals-base values and redact secrets, so the pre-save draft
        // will not deep-equal the post-save snapshot. Reseed from the refreshed values
        // (or null so the seed effect picks up the hook's next snapshot) without flashing
        // an empty form when mutate returns data synchronously.
        const [freshValues] = await Promise.all([values.mutate(), schema.mutate()]);
        const freshOverrides =
          freshValues && typeof freshValues === "object" && "overrides" in freshValues
            ? (freshValues as { overrides: Record<ConfigScope, Record<string, unknown>> }).overrides
            : undefined;
        if (freshOverrides) {
          setDrafts(current => ({ ...current, [saveScope]: deepClone(freshOverrides[saveScope]) }));
        } else {
          setDrafts(current => ({ ...current, [saveScope]: null }));
        }
        setFormGeneration(generation => generation + 1);
      } else {
        setIssues(result.issues);
        setSaveMessage(null);
      }
    } catch (error: unknown) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      saveInFlightRef.current = false;
      setSaving(false);
    }
  };

  const discard = () => {
    setDrafts(current => ({ ...current, [scope]: deepClone(scopeOverrides ?? {}) }));
    clearValidationFeedback();
    setFormGeneration(generation => generation + 1);
  };

  const isLoading = schema.isLoading || values.isLoading;
  const loadError = schema.error ?? values.error;
  const overridesFile = schema.data?.overridesFiles[scope];
  const pluginNavigation = (
    <div className="h-full flex flex-col min-h-0 bg-sidebar">
      <NavigationSidebarHeader title="Plugins" />
      <div className="p-2 border-b border-primary">
        <div className="relative">
          <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={search}
            onChange={event => setSearch(event.target.value)}
            placeholder="Search plugins…"
            className="w-full pl-8 pr-2.5 py-1.5 bg-tertiary border border-primary rounded-lg text-sm text-primary placeholder:text-muted focus-ring"
            aria-label="Search plugins"
          />
        </div>
      </div>
      <nav className="flex-1 overflow-y-auto p-2 space-y-0.5" aria-label="Configuration plugins">
        {filteredPlugins.map(plugin => {
          const isSelected = plugin.pluginName === selectedPlugin?.pluginName;
          const hasScopeOverrides = pluginHasOverrides(plugin, scope);
          const otherScope: ConfigScope = scope === "global" ? "workspace" : "global";
          const hasOtherOverrides = pluginHasOverrides(plugin, otherScope);
          return (
            <button
              key={plugin.pluginName}
              type="button"
              onClick={() => selectPlugin(plugin.pluginName)}
              aria-current={isSelected ? "page" : undefined}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer focus-ring ${
                isSelected ? "bg-active text-primary font-medium" : "text-secondary hover:bg-hover hover:text-primary"
              }`}
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
              <span className="truncate flex-1">{plugin.displayName}</span>
              {Object.values(plugin.slices).some(nodeHasSensitiveFields) && <KeyRound className="w-3 h-3 text-muted shrink-0" />}
            </button>
          );
        })}
        {filteredPlugins.length === 0 && <p className="text-xs text-muted px-2.5 py-4">No plugins match "{search}"</p>}
      </nav>
    </div>
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Configuration"
        subtitle={`Override plugin settings; changes are saved to your ${SCOPE_META[scope].label.toLowerCase()} configuration, which ${SCOPE_META[scope].blurb}`}
        icon={<SlidersHorizontal className="w-4 h-4" />}
        iconGradient="from-accent to-violet-600"
      >
        <div className="flex items-center gap-0.5 p-0.5 rounded-lg bg-tertiary border border-primary" role="group" aria-label="Configuration scope">
          {configScopes.map(candidate => {
            const { label, icon: Icon } = SCOPE_META[candidate];
            const isActive = candidate === scope;
            return (
              <button
                key={candidate}
                type="button"
                onClick={() => selectScope(candidate)}
                aria-pressed={isActive}
                title={`${label} configuration — ${SCOPE_META[candidate].blurb}`}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-colors cursor-pointer focus-ring",
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
      </AppPageHeader>

      {overridesFile && (
        <div className="shrink-0 px-4 sm:px-6 py-1.5 border-b border-primary bg-secondary/50 text-xs text-muted">
          Saving to <span className="font-mono text-secondary">{overridesFile}</span>
        </div>
      )}

      {schema.data?.overlayError && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-red-500/10 border-b border-red-500/20 text-red-500 text-xs">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          {schema.data.overlayError}
        </div>
      )}

      {isLoading ? (
        <LoadingState message="Loading configuration…" className="py-16" />
      ) : loadError ? (
        <ErrorState
          title="Failed to load configuration"
          error={loadError}
          onRetry={() => {
            void schema.mutate();
            void values.mutate();
          }}
          variant="inline"
          className="py-6"
        />
      ) : (
        <WorkspaceShell
          appId="configuration"
          title="Configuration"
          navigationLabel="Configuration plugins"
          navigation={pluginNavigation}
          hasSelection={selectedPlugin != null}
          className="flex-1"
        >
          {/* Detail pane */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedPlugin && draft !== null ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                  <div className="max-w-2xl">
                    <div className="mb-5">
                      <h2 className="text-base font-semibold text-primary">{selectedPlugin.displayName}</h2>
                      <p className="text-xs text-muted mt-0.5">
                        {selectedPlugin.description}
                        <span className="font-mono ml-2">
                          {selectedPlugin.pluginName} v{selectedPlugin.version}
                        </span>
                      </p>
                    </div>

                    {shadowedByProject && (
                      <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span>
                          This plugin is also configured at the project level, which takes precedence. Values you set here may not take effect until the project
                          override is removed.
                        </span>
                      </div>
                    )}

                    <ConfigForm
                      key={`${scope}-${formGeneration}`}
                      plugin={selectedPlugin}
                      draft={draft}
                      effective={values.data?.effective ?? {}}
                      issues={issues}
                      onDraftChange={next => {
                        setDrafts(current => ({ ...current, [scope]: next }));
                        // Clear stale validation so the user can fix fields without leftover errors.
                        clearValidationFeedback();
                      }}
                    />
                  </div>
                </div>

                {/* Save bar */}
                {(dirty || issues.length > 0 || saveMessage) && (
                  <div className="shrink-0 border-t border-primary bg-secondary px-4 sm:px-6 py-3 flex items-center gap-3">
                    <div className="flex-1 min-w-0 text-xs">
                      {issues.length > 0 ? (
                        <span className="text-red-400">
                          {issues.length} validation issue{issues.length === 1 ? "" : "s"}
                          {issuesOnOtherPlugins.length === issues.length
                            ? ` — ${issues
                                .slice(0, 2)
                                .map(issue => (issue.path.length > 0 ? issue.path.join(".") : issue.message))
                                .join("; ")}${issues.length > 2 ? "…" : ""} (on other plugins)`
                            : issuesOnOtherPlugins.length > 0
                              ? ` — fix the highlighted fields (${issuesOnOtherPlugins.length} on other plugins)`
                              : " — fix the highlighted fields"}
                        </span>
                      ) : saveMessage ? (
                        <span className={saveMessage.startsWith("Save failed") ? "text-red-400" : "text-emerald-500"}>{saveMessage}</span>
                      ) : (
                        <span className="text-muted">Unsaved changes to the {SCOPE_META[scope].label.toLowerCase()} configuration</span>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={discard}
                      disabled={!dirty || saving}
                      className="px-3 py-1.5 rounded-lg text-xs font-medium text-secondary hover:text-primary disabled:opacity-50 cursor-pointer"
                    >
                      Discard
                    </button>
                    <button
                      type="button"
                      onClick={() => void save()}
                      disabled={!dirty || saving}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-accent text-white hover:opacity-90 disabled:opacity-50 cursor-pointer"
                    >
                      {saving ? "Saving…" : `Save to ${SCOPE_META[scope].label.toLowerCase()}`}
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <p className="text-sm text-muted">Select a plugin to configure</p>
              </div>
            )}
          </div>
        </WorkspaceShell>
      )}
    </div>
  );
}
