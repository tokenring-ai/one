import { type ConfigScope, configScopes } from "@tokenring-ai/app/config/scopes";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import { AlertTriangle, FolderGit2, KeyRound, Search, SlidersHorizontal, User } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ConfigForm, { nodeHasSensitiveFields } from "../../features/config/ConfigForm.tsx";
import type { ConfigIssue } from "../../features/config/ConfigNodeRenderer.tsx";
import { cn, deepEqual } from "../../lib/utils.ts";
import { configRPCClient, useConfigSchema, useConfigValues } from "../../rpc.ts";

type Drafts = Record<ConfigScope, Record<string, unknown> | null>;

const SCOPE_META: Record<ConfigScope, { label: string; icon: typeof User; blurb: string }> = {
  user: { label: "User", icon: User, blurb: "applies everywhere you run TokenRing" },
  project: { label: "Project", icon: FolderGit2, blurb: "applies to this project and takes precedence over user settings" },
};

const isScope = (value: string | null): value is ConfigScope => configScopes.includes(value as ConfigScope);

export default function ConfigurationApp() {
  const schema = useConfigSchema();
  const values = useConfigValues();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Drafts>({ user: null, project: null });
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const scopeParam = searchParams.get("scope");
  const scope: ConfigScope = isScope(scopeParam) ? scopeParam : "user";

  const serverOverrides = values.data?.overrides;
  const scopeOverrides = serverOverrides?.[scope];
  const draft = drafts[scope];

  // Seed / reseed each scope's draft whenever fresh server overrides arrive and there are no local edits in flight.
  useEffect(() => {
    if (!serverOverrides) return;
    setDrafts(current => {
      const next = { ...current };
      let changed = false;
      for (const candidate of configScopes) {
        if (next[candidate] === null) {
          next[candidate] = deepClone(serverOverrides[candidate]);
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [serverOverrides]);

  const plugins = useMemo(() => {
    const list = schema.data?.plugins ?? [];
    return [...list].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [schema.data]);

  const filteredPlugins = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return plugins;
    return plugins.filter(plugin => plugin.displayName.toLowerCase().includes(query) || plugin.pluginName.toLowerCase().includes(query));
  }, [plugins, search]);

  const selectedName = searchParams.get("plugin");
  const selectedPlugin: ConfigUIPluginSchema | undefined = plugins.find(plugin => plugin.pluginName === selectedName) ?? filteredPlugins[0];

  const isScopeDirty = (candidate: ConfigScope) => {
    const candidateDraft = drafts[candidate];
    const candidateServer = serverOverrides?.[candidate];
    return candidateDraft !== null && candidateServer !== undefined && !deepEqual(candidateDraft, candidateServer);
  };
  const dirty = isScopeDirty(scope);

  const pluginHasOverrides = (plugin: ConfigUIPluginSchema, target: ConfigScope) => {
    const source = (target === scope ? draft : null) ?? serverOverrides?.[target] ?? {};
    return Object.keys(plugin.slices).some(sliceKey => source[sliceKey] !== undefined);
  };

  /** Slices of the selected plugin that a higher-precedence scope also sets. */
  const shadowedByProject = scope === "user" && selectedPlugin !== undefined && pluginHasOverrides(selectedPlugin, "project");

  const selectScope = (next: ConfigScope) => {
    const params = new URLSearchParams(searchParams);
    params.set("scope", next);
    setSearchParams(params);
    setIssues([]);
    setSaveMessage(null);
  };

  const selectPlugin = (pluginName: string) => {
    const params = new URLSearchParams(searchParams);
    params.set("plugin", pluginName);
    setSearchParams(params);
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await configRPCClient.applyConfig({ scope, overrides: draft });
      if (result.ok) {
        setIssues([]);
        setSaveMessage(`Saved to ${SCOPE_META[scope].label.toLowerCase()} configuration`);
        setDrafts(current => ({ ...current, [scope]: null })); // reseed from server
        await Promise.all([values.mutate(), schema.mutate()]);
      } else {
        setIssues(result.issues);
        setSaveMessage(null);
      }
    } catch (error: unknown) {
      setSaveMessage(`Save failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      setSaving(false);
    }
  };

  const discard = () => {
    setDrafts(current => ({ ...current, [scope]: scopeOverrides ? deepClone(scopeOverrides) : {} }));
    setIssues([]);
    setSaveMessage(null);
  };

  const isLoading = schema.isLoading || values.isLoading;
  const loadError = schema.error ?? values.error;
  const overridesFile = schema.data?.overridesFiles[scope];

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
        <div className="shrink-0 px-4 sm:px-6 py-1.5 border-b border-primary bg-secondary/50 text-2xs text-muted">
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
        <div className="flex-1 flex min-h-0">
          {/* Plugin list */}
          <aside className="w-56 sm:w-64 shrink-0 border-r border-primary flex flex-col min-h-0">
            <div className="p-2 border-b border-primary">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={event => setSearch(event.target.value)}
                  placeholder="Search plugins…"
                  className="w-full pl-8 pr-2.5 py-1.5 bg-tertiary border border-primary rounded-lg text-sm text-primary placeholder:text-muted focus-ring"
                  aria-label="Search plugins"
                />
              </div>
            </div>
            <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredPlugins.map(plugin => {
                const isSelected = plugin.pluginName === selectedPlugin?.pluginName;
                const hasScopeOverrides = pluginHasOverrides(plugin, scope);
                const otherScope: ConfigScope = scope === "user" ? "project" : "user";
                const hasOtherOverrides = pluginHasOverrides(plugin, otherScope);
                return (
                  <button
                    key={plugin.pluginName}
                    type="button"
                    onClick={() => selectPlugin(plugin.pluginName)}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                      isSelected ? "bg-secondary text-primary font-medium" : "text-secondary hover:bg-hover hover:text-primary"
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
              {filteredPlugins.length === 0 && <p className="text-2xs text-muted px-2.5 py-4">No plugins match "{search}"</p>}
            </nav>
          </aside>

          {/* Detail pane */}
          <div className="flex-1 flex flex-col min-h-0 min-w-0">
            {selectedPlugin && draft !== null ? (
              <>
                <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
                  <div className="max-w-2xl">
                    <div className="mb-5">
                      <h2 className="text-base font-semibold text-primary">{selectedPlugin.displayName}</h2>
                      <p className="text-2xs text-muted mt-0.5">
                        {selectedPlugin.description}
                        <span className="font-mono ml-2">
                          {selectedPlugin.pluginName} v{selectedPlugin.version}
                        </span>
                      </p>
                    </div>

                    {shadowedByProject && (
                      <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-2xs">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
                        <span>
                          This plugin is also configured at the project level, which takes precedence. Values you set here may not take effect until the project
                          override is removed.
                        </span>
                      </div>
                    )}

                    <ConfigForm
                      plugin={selectedPlugin}
                      draft={draft}
                      effective={values.data?.effective ?? {}}
                      issues={issues}
                      onDraftChange={next => {
                        setDrafts(current => ({ ...current, [scope]: next }));
                        setSaveMessage(null);
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
                          {issues.length} validation issue{issues.length === 1 ? "" : "s"} — fix the highlighted fields
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
        </div>
      )}
    </div>
  );
}
