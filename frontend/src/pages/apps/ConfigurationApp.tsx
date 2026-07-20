import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { AlertTriangle, KeyRound, RefreshCw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ConfigForm, { nodeHasSensitiveFields } from "../../features/config/ConfigForm.tsx";
import type { ConfigIssue } from "../../features/config/ConfigNodeRenderer.tsx";
import { deepCloneValue, deepEqual } from "../../features/config/values.ts";
import { configRPCClient, useConfigSchema, useConfigValues } from "../../rpc.ts";

export default function ConfigurationApp() {
  const schema = useConfigSchema();
  const values = useConfigValues();
  const [searchParams, setSearchParams] = useSearchParams();

  const [search, setSearch] = useState("");
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null);
  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [restartRequired, setRestartRequired] = useState(false);

  const serverOverrides = values.data?.overrides;

  // Seed / reseed the draft whenever fresh server overrides arrive and there are no local edits in flight.
  useEffect(() => {
    if (serverOverrides && draft === null) {
      setDraft(deepCloneValue(serverOverrides));
    }
  }, [serverOverrides, draft]);

  useEffect(() => {
    if (schema.data) setRestartRequired(schema.data.restartRequired);
  }, [schema.data]);

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

  const dirty = draft !== null && serverOverrides !== undefined && !deepEqual(draft, serverOverrides);

  const pluginHasOverrides = (plugin: ConfigUIPluginSchema) => {
    const source = draft ?? serverOverrides ?? {};
    return Object.keys(plugin.slices).some(sliceKey => source[sliceKey] !== undefined);
  };

  const save = async () => {
    if (!draft || saving) return;
    setSaving(true);
    setSaveMessage(null);
    try {
      const result = await configRPCClient.applyConfig({ overrides: draft });
      if (result.ok) {
        setIssues([]);
        setRestartRequired(result.restartRequired);
        setSaveMessage("Saved");
        setDraft(null); // reseed from server
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
    setDraft(serverOverrides ? deepCloneValue(serverOverrides) : {});
    setIssues([]);
    setSaveMessage(null);
  };

  const isLoading = schema.isLoading || values.isLoading;
  const loadError = schema.error ?? values.error;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Configuration"
        subtitle="Override plugin settings; changes are saved to your user configuration"
        icon={<SlidersHorizontal className="w-4 h-4" />}
        iconGradient="from-accent to-violet-600"
      />

      {restartRequired && (
        <div className="flex items-center gap-2 px-4 sm:px-6 py-2 bg-amber-500/10 border-b border-amber-500/20 text-amber-600 dark:text-amber-400 text-xs">
          <RefreshCw className="w-3.5 h-3.5 shrink-0" />
          Some changes need a restart to take effect.
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
                return (
                  <button
                    key={plugin.pluginName}
                    type="button"
                    onClick={() => setSearchParams({ plugin: plugin.pluginName })}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left text-sm transition-colors cursor-pointer ${
                      isSelected ? "bg-secondary text-primary font-medium" : "text-secondary hover:bg-hover hover:text-primary"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full shrink-0 ${pluginHasOverrides(plugin) ? "bg-accent" : "bg-transparent"}`}
                      title={pluginHasOverrides(plugin) ? "Has overrides" : undefined}
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
                    <ConfigForm
                      plugin={selectedPlugin}
                      draft={draft}
                      effective={values.data?.effective ?? {}}
                      issues={issues}
                      onDraftChange={next => {
                        setDraft(next);
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
                        <span className="text-muted">Unsaved changes</span>
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
                      {saving ? "Saving…" : "Save changes"}
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
