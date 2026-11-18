import { type ConfigScope, configScopes } from "@tokenring-ai/app/config/scopes";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import deepClone from "@tokenring-ai/utility/object/deepClone";
import deepEqual from "@tokenring-ai/utility/object/deepEqual";
import { FolderGit2, User } from "lucide-react";
import { useCallback, useEffect, useMemo } from "react";
import { useMultiSourceLoading } from "../../hooks/useMultiSourceLoading.ts";
import { usePaneLink } from "../../layout/hooks.ts";
import { useConfigSchema, useConfigValues } from "../../rpc.ts";
import { getConfigurationState, setConfigDraft, setDraftPersistenceContext, useConfigurationStore } from "./configurationStore.ts";

/**
 * Vocabulary shared by the Configuration views (plugin list, plugin editor).
 * Each view is its own React subtree, so anything both need lives here or in
 * {@link ./configurationStore.ts}.
 */

export const CONFIGURATION_PATH = "/configuration";

export const CONFIGURATION_PLUGINS_VIEW = "configuration-plugins";
export const CONFIGURATION_PLUGIN_VIEW = "configuration-plugin";
export const CONFIGURATION_START_VIEW = "configuration-start";
/** Connect a model provider: paste a key, point at a local server, or add a custom one. */
export const AI_PROVIDERS_VIEW = "configuration-ai-providers";
/** Connect Google (Gmail, Calendar and Drive, as chosen): the step-by-step setup and sign-in. */
export const CONNECT_GOOGLE_VIEW = "configuration-connect-google";
/** The standing "always allow" permissions, with Revoke. */
export const PERMISSIONS_VIEW = "configuration-permissions";
/** Who can sign in (administrators), plus signing yourself in on a phone (everyone). */
export const USERS_VIEW = "configuration-users";

export const SCOPE_META: Record<ConfigScope, { label: string; icon: typeof User; blurb: string }> = {
  global: { label: "Global", icon: User, blurb: "applies everywhere you run TokenRing" },
  workspace: { label: "Workspace", icon: FolderGit2, blurb: "applies to this workspace and takes precedence over user settings" },
};

export function configurationPath(pluginName?: string | null): string {
  return pluginName ? `${CONFIGURATION_PATH}/${encodeURIComponent(pluginName)}` : CONFIGURATION_PATH;
}

export function isConfigScope(value: string | null | undefined): value is ConfigScope {
  return configScopes.includes(value as ConfigScope);
}

/** Clone a scope's overrides; a missing key becomes `{}` so a draft is never `undefined`. */
export function cloneScopeOverrides(overrides: Record<string, unknown> | undefined | null): Record<string, unknown> {
  return deepClone(overrides ?? {}) as Record<string, unknown>;
}

/** True when any of the plugin's slices is set in `source`. */
export function pluginHasOverrides(plugin: ConfigUIPluginSchema, source: Record<string, unknown>): boolean {
  return Object.keys(plugin.slices).some(sliceKey => source[sliceKey] !== undefined);
}

/** The plugin's slice keys (the root config keys it owns). */
function sliceKeysOf(plugin: ConfigUIPluginSchema): string[] {
  return Object.keys(plugin.slices);
}

/** True when `draft` differs from `server` in any of the plugin's slices. */
export function isPluginDirtyIn(plugin: ConfigUIPluginSchema, draft: Record<string, unknown> | null | undefined, server: Record<string, unknown>): boolean {
  if (draft == null) return false;
  return sliceKeysOf(plugin).some(key => !deepEqual(draft[key], server[key]));
}

/** Copies the plugin's slices from `source` onto `target` (a missing slice is removed). */
function withPluginSlices(plugin: ConfigUIPluginSchema, target: Record<string, unknown>, source: Record<string, unknown>): Record<string, unknown> {
  const next = { ...target };
  for (const key of sliceKeysOf(plugin)) {
    if (source[key] === undefined) delete next[key];
    else next[key] = deepClone(source[key]);
  }
  return next;
}

/**
 * The override set a plugin panel sends: the server's current overrides for the
 * scope with only this plugin's slices taken from the draft. `applyConfig`
 * replaces the whole scope, so other plugins' unsaved edits must not ride along.
 */
export function pluginSaveOverrides(plugin: ConfigUIPluginSchema, draft: Record<string, unknown>, server: Record<string, unknown>): Record<string, unknown> {
  return withPluginSlices(plugin, cloneScopeOverrides(server), draft);
}

/**
 * Resets the plugin's slices in `draft` to `server`, leaving other plugins'
 * edits alone. Returns `null` once nothing in the draft differs from the server.
 */
export function revertPluginSlices(
  plugin: ConfigUIPluginSchema,
  draft: Record<string, unknown> | null,
  server: Record<string, unknown>,
): Record<string, unknown> | null {
  if (draft == null) return null;
  const next = withPluginSlices(plugin, draft, server);
  return deepEqual(next, server) ? null : next;
}

/**
 * `source` without the value at `path`; parents left empty are removed too,
 * matching how the server's `resetConfig` prunes the overrides it stores.
 */
export function withoutPath(source: Record<string, unknown>, path: readonly string[]): Record<string, unknown> {
  if (path.length === 0) return {};
  const [head, ...rest] = path as [string, ...string[]];
  if (!(head in source)) return source;
  const next = { ...source };
  if (rest.length === 0) {
    delete next[head];
    return next;
  }
  const child = source[head];
  if (!isRecord(child)) return source;
  const pruned = withoutPath(child, rest);
  if (Object.keys(pruned).length === 0) delete next[head];
  else next[head] = pruned;
  return next;
}

/** The plugin that holds model providers and their API keys — the first thing a new install needs. */
/** The plugin behind Email and Calendar accounts; its settings page links to the guided setup. */
export const GOOGLE_PLUGIN = "@tokenring-ai/google";
export const AI_CLIENT_PLUGIN = "@tokenring-ai/ai-client";

/** By display name, with the AI client pinned first since nothing works until a provider is set up. */
export function sortConfigPlugins(plugins: readonly ConfigUIPluginSchema[]): ConfigUIPluginSchema[] {
  const rank = (plugin: ConfigUIPluginSchema) => (plugin.pluginName === AI_CLIENT_PLUGIN ? 0 : 1);
  return [...plugins].sort((a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Leaf values that differ between `a` and `b`; arrays count as one value. */
function countDifferences(a: unknown, b: unknown): number {
  if (isRecord(a) && isRecord(b)) {
    let count = 0;
    for (const key of new Set([...Object.keys(a), ...Object.keys(b)])) count += countDifferences(a[key], b[key]);
    return count;
  }
  if (isRecord(a)) return countDifferences(a, {});
  if (isRecord(b)) return countDifferences({}, b);
  return deepEqual(a, b) ? 0 : 1;
}

/** How many fields of `plugin` the draft changes relative to the server. */
export function countPluginDirtyFields(
  plugin: ConfigUIPluginSchema,
  draft: Record<string, unknown> | null | undefined,
  server: Record<string, unknown>,
): number {
  if (draft == null) return 0;
  return sliceKeysOf(plugin).reduce((total, key) => total + countDifferences(draft[key], server[key]), 0);
}

export interface ConfigurationData {
  schema: ReturnType<typeof useConfigSchema>;
  values: ReturnType<typeof useConfigValues>;
  loading: ReturnType<typeof useMultiSourceLoading>;
  /** Every configurable plugin, sorted by display name. */
  plugins: ConfigUIPluginSchema[];
  scope: ConfigScope;
  /** The draft the form edits: the scope's unsaved overrides, or a clone of the server's. */
  draft: Record<string, unknown>;
  /** Overrides a scope would save with right now (draft when dirty, else the server snapshot). */
  overridesFor: (scope: ConfigScope) => Record<string, unknown>;
  /** True when any plugin has unsaved edits in `scope` (the scope switch's marker). */
  isScopeDirty: (scope: ConfigScope) => boolean;
  /** True when `plugin` has unsaved edits in the active scope; other plugins' edits do not count. */
  isPluginDirty: (plugin: ConfigUIPluginSchema) => boolean;
  /** Replaces the active scope's draft. */
  changeDraft: (next: Record<string, unknown>) => void;
  /** Reverts only `plugin`'s slices in the active scope's draft to the server snapshot. */
  discardPluginDraft: (plugin: ConfigUIPluginSchema) => void;
}

/**
 * Schema + values + drafts, shared by both views so the plugin list can show
 * which plugins are overridden in each scope while the editor saves them.
 */
export function useConfigurationData(): ConfigurationData {
  const schema = useConfigSchema();
  const values = useConfigValues();
  const loading = useMultiSourceLoading([
    { source: schema, label: "schema" },
    { source: values, label: "values" },
  ]);
  const { scope, drafts } = useConfigurationStore();

  const plugins = useMemo(() => sortConfigPlugins(schema.data?.plugins ?? []), [schema.data]);

  const serverOverrides = values.data?.overrides;
  const scopeDraft = drafts[scope];

  // Lets the store tell secrets apart when it writes drafts to localStorage.
  useEffect(() => {
    if (schema.data && serverOverrides) setDraftPersistenceContext({ plugins: schema.data.plugins, serverOverrides });
  }, [schema.data, serverOverrides]);
  const draft = useMemo(() => scopeDraft ?? cloneScopeOverrides(serverOverrides?.[scope]), [scopeDraft, serverOverrides, scope]);

  const overridesFor = useCallback(
    (target: ConfigScope) => drafts[target] ?? serverOverrides?.[target] ?? {},
    // Reading one key of an object the hook already depends on.
    [drafts, serverOverrides],
  );

  const isScopeDirty = useCallback(
    (target: ConfigScope) => {
      const candidate = drafts[target];
      // No draft means "whatever the server has", which is never dirty.
      return candidate != null && !deepEqual(candidate, serverOverrides?.[target] ?? {});
    },
    [drafts, serverOverrides],
  );

  const isPluginDirty = useCallback(
    (plugin: ConfigUIPluginSchema) => isPluginDirtyIn(plugin, drafts[scope], serverOverrides?.[scope] ?? {}),
    [drafts, scope, serverOverrides],
  );

  const changeDraft = useCallback((next: Record<string, unknown>) => setConfigDraft(scope, next), [scope]);
  const discardPluginDraft = useCallback(
    (plugin: ConfigUIPluginSchema) => {
      // Read the store directly so an edit made in another panel since the last render survives.
      const current = getConfigurationState().drafts[scope];
      setConfigDraft(scope, revertPluginSlices(plugin, current, serverOverrides?.[scope] ?? {}));
    },
    [scope, serverOverrides],
  );

  return { schema, values, loading, plugins, scope, draft, overridesFor, isScopeDirty, isPluginDirty, changeDraft, discardPluginDraft };
}

/**
 * Opens a plugin's editor in the Configuration app (navigates to
 * `/configuration/<plugin>`). The "choose a plugin" start tab has done its job
 * then, so it closes, as the old placeholder panel used to be filled in place.
 */
export function useConfigurationNavigation() {
  const open = usePaneLink();
  const openPlugin = useCallback(
    (pluginName: string) => {
      open(CONFIGURATION_PLUGIN_VIEW, { plugin: pluginName });
    },
    [open],
  );
  return { openPlugin };
}
