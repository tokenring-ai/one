import type { ConfigScope } from "@tokenring-ai/app/config/scopes";
import type { ConfigUIPluginSchema } from "@tokenring-ai/app/config/uiSchema";
import deepEqual from "@tokenring-ai/utility/object/deepEqual";
import { AlertTriangle, Plug, SlidersHorizontal, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FormActionBar from "../../components/ui/FormActionBar.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import ConfigForm from "../../features/config/ConfigForm.tsx";
import type { ConfigIssue } from "../../features/config/ConfigNodeRenderer.tsx";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import type { ViewProps } from "../../layout/define.ts";
import { usePaneLink, usePanel } from "../../layout/hooks.ts";
import { configRPCClient } from "../../rpc.ts";
import { usePanelBadge, usePanelTitle } from "../panelHooks.ts";
import { getConfigurationState, setConfigDraft } from "./configurationStore.ts";
import {
  AI_PROVIDERS_VIEW,
  CONNECT_GOOGLE_VIEW,
  countPluginDirtyFields,
  GOOGLE_PLUGIN,
  pluginHasOverrides,
  pluginSaveOverrides,
  revertPluginSlices,
  SCOPE_META,
  useConfigurationData,
  withoutPath,
} from "./shared.tsx";

/** How long the form must sit still before a draft is validated against the server. */
export const VALIDATE_DEBOUNCE_MS = 400;

/**
 * One plugin's configuration per panel: the generated form for the active
 * scope plus the save bar. A panel without a `plugin` is the dashboard's
 * Configuration start page (route `/configuration`), which asks the user to pick one.
 */
export default function ConfigurationPluginView({ params }: ViewProps) {
  const pluginName = params.plugin;
  const panel = usePanel();
  const openPane = usePaneLink();
  const { schema, values, loading, plugins, scope, draft, overridesFor, isPluginDirty, changeDraft, discardPluginDraft } = useConfigurationData();

  const [issues, setIssues] = useState<ConfigIssue[]>([]);
  /** Issues from validating the unsaved draft (before Save); replaced by `issues` once a save reports its own. */
  const [previewIssues, setPreviewIssues] = useState<ConfigIssue[]>([]);
  const [resetting, setResetting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  /** Bumped on discard/save so field-local UI state (secret source pick, JSON draft text) remounts cleanly. */
  const [formGeneration, setFormGeneration] = useState(0);
  /** Synchronous guard — React state alone cannot prevent a double-click before re-render. */
  const saveInFlightRef = useRef(false);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();

  const selectedPlugin = useMemo(() => (pluginName ? (plugins.find(plugin => plugin.pluginName === pluginName) ?? null) : null), [plugins, pluginName]);
  // Per plugin: the scope's draft is shared by every open plugin panel, but only this
  // plugin's slices make this panel (and its tab badge) dirty.
  const dirty = selectedPlugin !== null && isPluginDirty(selectedPlugin);

  usePanelTitle(selectedPlugin?.displayName ?? pluginName ?? "Configuration");
  // A dot on the tab while edits are unsaved, so a backgrounded plugin is not forgotten.
  usePanelBadge(dirty ? { tone: "warning", label: "Unsaved changes" } : null);

  /** Clears server validation / save feedback so the user can keep editing cleanly. */
  const clearValidationFeedback = useCallback(() => {
    setIssues([]);
    setSaveMessage(null);
  }, []);

  // Feedback belongs to the scope it came from; switching layers starts clean.
  useEffect(() => {
    clearValidationFeedback();
  }, [scope, clearValidationFeedback]);

  /** Issues whose root path segment belongs to this plugin's slices. */
  const selectedSliceKeys = useMemo(() => (selectedPlugin ? new Set(Object.keys(selectedPlugin.slices)) : new Set<string>()), [selectedPlugin]);
  const issuesOnOtherPlugins = issues.filter(issue => issue.path.length === 0 || !selectedSliceKeys.has(String(issue.path[0])));
  /** Draft problems in this plugin's own fields, found before Save. */
  const ownPreviewIssues = previewIssues.filter(issue => issue.path.length > 0 && selectedSliceKeys.has(String(issue.path[0])));
  const shownIssues = issues.length > 0 ? issues : ownPreviewIssues;

  // Validate the unsaved draft once typing pauses, so field errors show before Save.
  const serverOverridesForScope = values.data?.overrides[scope];
  useEffect(() => {
    if (!selectedPlugin || !dirty) {
      setPreviewIssues([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      const overrides = pluginSaveOverrides(selectedPlugin, draft, serverOverridesForScope ?? {});
      try {
        const result = await configRPCClient.validateConfig({ scope, overrides });
        if (!cancelled) setPreviewIssues(result.ok ? [] : result.issues);
      } catch {
        // Validation is advisory; Save re-validates and reports failures itself.
        if (!cancelled) setPreviewIssues([]);
      }
    }, VALIDATE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dirty, draft, scope, selectedPlugin, serverOverridesForScope]);

  /** Slices of this plugin that a higher-precedence scope also sets. */
  const shadowedByWorkspace = scope === "global" && selectedPlugin !== null && pluginHasOverrides(selectedPlugin, overridesFor("workspace"));

  const save = useCallback(
    async (plugin: ConfigUIPluginSchema, saveScope: ConfigScope, saveDraft: Record<string, unknown>) => {
      if (saving || saveInFlightRef.current) return;
      saveInFlightRef.current = true;
      setSaving(true);
      setSaveMessage(null);
      try {
        // applyConfig replaces the whole scope, so send the server's current overrides with
        // only this plugin's slices taken from the draft: other panels' unsaved edits stay drafts.
        const serverBefore = values.data?.overrides[saveScope] ?? {};
        const overrides = pluginSaveOverrides(plugin, saveDraft, serverBefore);
        const result = await configRPCClient.applyConfig({ scope: saveScope, overrides });
        if (result.ok) {
          setIssues([]);
          setSaveMessage(`Saved to ${SCOPE_META[saveScope].label.toLowerCase()} configuration`);
          const [refreshed] = await Promise.all([values.mutate(), schema.mutate()]);
          // The server may prune equals-base values and redact secrets, so the pre-save slices
          // will not deep-equal what comes back. Re-seed this plugin's slices from the refreshed
          // snapshot (so no phantom "unsaved changes"), but only if the user did not keep editing
          // this plugin while the save was in flight; other plugins' edits are left untouched.
          const serverAfter = refreshed?.overrides[saveScope] ?? overrides;
          const current = getConfigurationState().drafts[saveScope];
          const unchangedSinceSave = current != null && Object.keys(plugin.slices).every(key => deepEqual(current[key], overrides[key]));
          if (unchangedSinceSave) setConfigDraft(saveScope, revertPluginSlices(plugin, current, serverAfter));
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
    },
    [saving, schema, values],
  );

  /** Removes a saved override straight away (after asking), leaving other unsaved edits as drafts. */
  const resetSaved = useCallback(
    async (path: string[], label: string) => {
      if (resetting) return;
      const confirmed = await openConfirm({
        id: "configuration:reset-saved",
        title: `Reset ${label}?`,
        message: `Remove the saved ${SCOPE_META[scope].label.toLowerCase()} value for ${label} (${path.join(".")}) and fall back to the default. This takes effect immediately.`,
        confirmText: "Reset",
        variant: "danger",
      });
      if (!confirmed) return;
      setResetting(true);
      setSaveMessage(null);
      try {
        const result = await configRPCClient.resetConfig({ scope, path });
        if (!result.ok) {
          setIssues(result.issues);
          return;
        }
        setIssues([]);
        setSaveMessage(`Reset ${label} to its default`);
        const [refreshed] = await Promise.all([values.mutate(), schema.mutate()]);
        const current = getConfigurationState().drafts[scope];
        if (current != null) {
          const next = withoutPath(current, path);
          setConfigDraft(scope, deepEqual(next, refreshed?.overrides[scope] ?? {}) ? null : next);
        }
        setFormGeneration(generation => generation + 1);
      } catch (error: unknown) {
        setSaveMessage(`Reset failed: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setResetting(false);
      }
    },
    [openConfirm, resetting, schema, scope, values],
  );

  const discard = useCallback(async () => {
    if (selectedPlugin) {
      // One field is cheap to retype; several are worth a second look before they go.
      const changed = countPluginDirtyFields(selectedPlugin, getConfigurationState().drafts[scope], values.data?.overrides[scope] ?? {});
      if (changed > 1) {
        const confirmed = await openConfirm({
          id: "configuration:discard",
          title: "Discard changes?",
          message: `Discard ${changed} unsaved changes to ${selectedPlugin.displayName}? This cannot be undone.`,
          confirmText: "Discard",
          variant: "danger",
        });
        if (!confirmed) return;
      }
      discardPluginDraft(selectedPlugin);
    }
    clearValidationFeedback();
    setFormGeneration(generation => generation + 1);
  }, [clearValidationFeedback, discardPluginDraft, openConfirm, scope, selectedPlugin, values.data]);

  if (!pluginName) {
    return (
      <EmptyState
        variant="page"
        className="h-full"
        icon={SlidersHorizontal}
        title="Select a plugin"
        hint={
          <>
            Pick a plugin from the list to change its settings. New here? Start with <strong>AI providers</strong>: paste an API key and your agents have a
            model to think with.
            <br />
            <strong>Global</strong> settings apply everywhere you run TokenRing; <strong>Workspace</strong> settings apply only to this workspace and win over
            Global. Choose the scope with the switch above the list.
          </>
        }
        ctaLabel="Connect an AI provider"
        ctaIcon={Plug}
        onCta={() => openPane(AI_PROVIDERS_VIEW, {})}
      />
    );
  }

  if (loading.isLoading) return <LoadingState message="Loading configuration…" className="h-full" />;
  if (loading.hasHardError) {
    return <ErrorState title="Failed to load configuration" error={loading.hardError} onRetry={loading.refresh} variant="page" />;
  }

  if (!selectedPlugin) {
    return (
      <EmptyState
        variant="page"
        className="h-full"
        icon={SlidersHorizontal}
        title="Plugin not found"
        hint={`"${pluginName}" is not configurable (it may have been removed). Close this panel or pick another plugin.`}
        ctaLabel="Close panel"
        ctaIcon={X}
        onCta={() => panel.close()}
      />
    );
  }

  const statusMessage =
    issues.length === 0 && ownPreviewIssues.length > 0 ? (
      <span className="text-red-400">
        {ownPreviewIssues.length} validation issue{ownPreviewIssues.length === 1 ? "" : "s"} — fix the highlighted fields before saving
      </span>
    ) : issues.length > 0 ? (
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
      <span className={/ failed: /.test(saveMessage) ? "text-red-400" : "text-emerald-500"}>{saveMessage}</span>
    ) : (
      <span className="text-muted">Unsaved changes to the {SCOPE_META[scope].label.toLowerCase()} configuration</span>
    );

  return (
    <ViewShell
      pad="page"
      width="prose"
      footer={
        (dirty || shownIssues.length > 0 || saveMessage) && (
          <FormActionBar
            separated
            size="md"
            status={statusMessage}
            cancelLabel="Discard"
            onCancel={() => void discard()}
            cancelDisabled={!dirty || saving}
            submitLabel={saving ? "Saving…" : `Save to ${SCOPE_META[scope].label.toLowerCase()}`}
            onSubmit={() => void save(selectedPlugin, scope, draft)}
            loading={saving}
            disabled={!dirty || ownPreviewIssues.length > 0 || resetting}
          />
        )
      }
    >
      <div>
        <div className="mb-5">
          <h2 className="text-base font-semibold text-primary">{selectedPlugin.displayName}</h2>
          <p className="text-xs text-muted mt-0.5">
            {selectedPlugin.description}
            <span className="font-mono ml-2">
              {selectedPlugin.pluginName} v{selectedPlugin.version}
            </span>
          </p>
          <p className="text-xs text-muted mt-1">
            Editing the {SCOPE_META[scope].label.toLowerCase()} configuration, which {SCOPE_META[scope].blurb}.
          </p>
        </div>

        {selectedPlugin.pluginName === GOOGLE_PLUGIN && (
          <div
            className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 rounded-lg bg-secondary border border-primary text-xs"
            data-testid="connect-google-banner"
          >
            <span className="min-w-0 flex-1 text-primary">New to this? A step-by-step guide connects your Gmail and Google Calendar, no settings to edit.</span>
            <button
              type="button"
              onClick={() => openPane(CONNECT_GOOGLE_VIEW, {})}
              className="text-accent-soft hover:underline cursor-pointer focus-ring rounded font-medium"
            >
              Connect Google →
            </button>
          </div>
        )}

        {shadowedByWorkspace && (
          <div className="mb-4 flex items-start gap-2 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-600 text-xs">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0 mt-px" />
            <span>
              This plugin is also configured at the workspace level, which takes precedence. Values you set here may not take effect until the workspace
              override is removed.
            </span>
          </div>
        )}

        <ConfigForm
          key={`${scope}-${formGeneration}`}
          plugin={selectedPlugin}
          draft={draft}
          effective={values.data?.effective ?? {}}
          issues={shownIssues}
          savedOverrides={serverOverridesForScope ?? {}}
          onResetSaved={(path, label) => void resetSaved(path, label)}
          onDraftChange={next => {
            changeDraft(next);
            // Clear stale validation so the user can fix fields without leftover errors.
            clearValidationFeedback();
          }}
        />
      </div>
      <ConfirmDialog />
    </ViewShell>
  );
}
