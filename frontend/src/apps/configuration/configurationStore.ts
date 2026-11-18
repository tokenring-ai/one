import type { ConfigScope } from "@tokenring-ai/app/config/scopes";
import type { ConfigUINode, ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import { useSyncExternalStore } from "react";
import { isRedactedSensitiveValue } from "../../lib/utils.ts";

/**
 * State shared by the Configuration views. The plugin list and the editor are
 * separate React subtrees, so the active scope and the unsaved overrides live
 * here rather than in component state.
 *
 * Drafts are persisted to localStorage (per scope), so a reload — or an
 * accidental tab close — no longer silently discards unsaved edits. A scope's
 * draft is `null` while it matches the server snapshot; the editor seeds it on
 * the first edit and drops it again after a successful save, so "dirty" never
 * lingers when the server prunes or redacts what it stored.
 *
 * Typed-in secrets never reach storage: the persisted copy has every sensitive
 * value reverted to what the server reported (its redacted sentinel, or
 * nothing), so a secret edit lives in memory only and is lost on reload.
 */
export interface ConfigurationState {
  scope: ConfigScope;
  /** Unsaved override set per scope; `null` means "whatever the server has". */
  drafts: Readonly<Record<ConfigScope, Record<string, unknown> | null>>;
  /** True once `?scope=` has been consumed (or the user picked a scope), so the URL stops winning. */
  scopeSeeded: boolean;
}

const DRAFTS_STORAGE_KEY = "tokenring-configuration-drafts";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function loadPersistedDrafts(): Record<ConfigScope, Record<string, unknown> | null> {
  const empty: Record<ConfigScope, Record<string, unknown> | null> = { global: null, workspace: null };
  try {
    const raw = localStorage.getItem(DRAFTS_STORAGE_KEY);
    if (!raw) return empty;
    const parsed: unknown = JSON.parse(raw);
    if (!isPlainObject(parsed)) return empty;
    const read = (scope: ConfigScope): Record<string, unknown> | null => {
      const value = parsed[scope];
      return isPlainObject(value) ? value : null;
    };
    return { global: read("global"), workspace: read("workspace") };
  } catch {
    return empty;
  }
}

/**
 * Returns `draft` with every value the schema marks sensitive replaced by the
 * server's value at the same path (`undefined` removes the key). Values that
 * are already the server's redacted sentinel, and env/vault references, pass
 * through unchanged.
 */
function stripSensitiveEdits(node: ConfigUINode, draft: unknown, server: unknown): unknown {
  if (draft === undefined) return undefined;
  switch (node.kind) {
    case "field":
    case "opaque":
      return node.sensitive && !isRedactedSensitiveValue(draft) ? server : draft;
    case "secret":
      return node.sensitive && typeof draft === "string" ? server : draft;
    case "group": {
      if (!isPlainObject(draft)) return draft;
      const serverRecord = isPlainObject(server) ? server : {};
      const out: Record<string, unknown> = { ...draft };
      for (const child of node.children) {
        const next = stripSensitiveEdits(child, out[child.key], serverRecord[child.key]);
        if (next === undefined) delete out[child.key];
        else out[child.key] = next;
      }
      return out;
    }
    case "list":
      if (!Array.isArray(draft)) return draft;
      return draft.map((item, index) => stripSensitiveEdits(node.item, item, Array.isArray(server) ? server[index] : undefined) ?? null);
    case "map": {
      if (!isPlainObject(draft)) return draft;
      const serverRecord = isPlainObject(server) ? server : {};
      const out: Record<string, unknown> = {};
      for (const [key, value] of Object.entries(draft)) {
        const next = stripSensitiveEdits(node.value, value, serverRecord[key]);
        if (next !== undefined) out[key] = next;
      }
      return out;
    }
    case "variant": {
      if (!isPlainObject(draft)) return draft;
      const variant = node.variants[String(draft[node.discriminator])];
      return variant ? stripSensitiveEdits(variant, draft, server) : draft;
    }
  }
}

/** What persisting needs to tell secrets apart: the UI schemas and the server's overrides per scope. */
export interface DraftPersistenceContext {
  plugins: readonly ConfigUIPluginSchema[];
  serverOverrides: Partial<Record<ConfigScope, Record<string, unknown>>>;
}

let persistenceContext: DraftPersistenceContext | null = null;

/** The draft as it may be written to storage: sensitive edits reverted to the server's value. */
export function persistableDraft(
  draft: Record<string, unknown>,
  plugins: readonly ConfigUIPluginSchema[],
  server: Record<string, unknown>,
): Record<string, unknown> {
  const out: Record<string, unknown> = { ...draft };
  for (const plugin of plugins) {
    for (const [key, node] of Object.entries(plugin.slices)) {
      const next = stripSensitiveEdits(node, out[key], server[key]);
      if (next === undefined) delete out[key];
      else out[key] = next;
    }
  }
  return out;
}

function persistDrafts(drafts: ConfigurationState["drafts"]): void {
  try {
    if (drafts.global === null && drafts.workspace === null) {
      localStorage.removeItem(DRAFTS_STORAGE_KEY);
      return;
    }
    // Without the schema there is no telling which values are secrets, so nothing is written.
    const context = persistenceContext;
    if (!context) return;
    const sanitize = (scope: ConfigScope) => {
      const draft = drafts[scope];
      return draft === null ? null : persistableDraft(draft, context.plugins, context.serverOverrides[scope] ?? {});
    };
    localStorage.setItem(DRAFTS_STORAGE_KEY, JSON.stringify({ global: sanitize("global"), workspace: sanitize("workspace") }));
  } catch {
    // Storage unavailable (private mode/quota): drafts stay in memory.
  }
}

const INITIAL: ConfigurationState = { scope: "global", drafts: loadPersistedDrafts(), scopeSeeded: false };

let state: ConfigurationState = INITIAL;
const listeners = new Set<() => void>();

function update(next: ConfigurationState) {
  state = next;
  persistDrafts(next.drafts);
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useConfigurationStore(): ConfigurationState {
  return useSyncExternalStore(
    subscribe,
    () => state,
    () => state,
  );
}

export function getConfigurationState(): ConfigurationState {
  return state;
}

/** Explicit pick from the scope switch; wins over any later `?scope=` in the URL. */
export function setConfigurationScope(scope: ConfigScope): void {
  if (state.scope === scope && state.scopeSeeded) return;
  update({ ...state, scope, scopeSeeded: true });
}

/** Applies `?scope=` from a deep link, once: after that the switch owns the scope. */
export function seedConfigurationScope(scope: ConfigScope): void {
  if (state.scopeSeeded) return;
  update({ ...state, scope, scopeSeeded: true });
}

/** `null` drops the draft, so the form falls back to the server snapshot. */
export function setConfigDraft(scope: ConfigScope, draft: Record<string, unknown> | null): void {
  if (state.drafts[scope] === draft) return;
  update({ ...state, drafts: { ...state.drafts, [scope]: draft } });
}

/**
 * Supplies the schema and server overrides that persisting drafts needs, and
 * re-writes storage with them. Called by the Configuration views once both load.
 */
export function setDraftPersistenceContext(context: DraftPersistenceContext | null): void {
  persistenceContext = context;
  if (context) persistDrafts(state.drafts);
}

/** Test helper: back to a fresh-launch state, including drafts re-read from storage. */
export function resetConfigurationStore(): void {
  update({ scope: "global", drafts: loadPersistedDrafts(), scopeSeeded: false });
}
