import { ChevronLeft, ChevronRight, Copy, Cpu, RotateCcw, Save, SlidersHorizontal, Store, Trash2, X } from "lucide-react";
import { useId } from "react";
import { Link } from "react-router-dom";
import LaunchButton from "../../components/ui/LaunchButton.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import ViewHeader from "../../components/ui/ViewHeader.tsx";
import Button from "../../ui/button.tsx";
import { controlClassName } from "../../ui/control.ts";
import AutoResizeTextarea from "../workflows/AutoResizeTextarea.tsx";
import { type AgentDraft, agentNameError, DEFAULT_AGENT_CATEGORY, isDraftComplete, isValidAgentName } from "./agentDraft.ts";
import StringListEditor from "./StringListEditor.tsx";

export type AgentEditorMode = "bundled" | "workspace" | "create";

/** Provenance recorded when an agent was installed from a community registry. */
export interface AgentInstallSource {
  registry: string;
  id: string;
  version: string;
  author: string;
  installedAt: string;
}

const NUMBER_FIELDS = [
  { key: "idleTimeout", label: "Idle timeout", unit: "seconds", hint: "Shut idle agents of this type down after this long (0 disables)" },
  { key: "maxRunTime", label: "Max run time", unit: "seconds", hint: "Hard limit on how long an agent of this type runs (0 disables)" },
  { key: "minimumRunning", label: "Minimum running", unit: "agents", hint: "Keep at least this many agents of this type running" },
] as const satisfies ReadonlyArray<{ key: keyof AgentDraft & ("idleTimeout" | "maxRunTime" | "minimumRunning"); label: string; unit: string; hint: string }>;

/**
 * Detail and edit surface for a single agent type.
 *
 * Bundled agents come from configuration and have no file to write, so the whole form is read-only
 * and the way forward is Clone, which materialises an editable copy in the agent directory.
 */
export default function AgentTypeEditor({
  mode,
  agentType,
  nameValue,
  onNameChange,
  draft,
  onDraftChange,
  isDirty,
  loading,
  installedFrom,
  updatedAt,
  categories,
  runningCount,
  runningAgents,
  saving,
  launching,
  launchShortcut,
  onSave,
  onRevert,
  onDelete,
  onClone,
  onLaunch,
  onCancelCreate,
  onBack,
}: {
  mode: AgentEditorMode;
  /** The agent type being viewed; null while creating. */
  agentType: string | null;
  /** Agent type for the agent being created; ignored outside create mode. */
  nameValue: string;
  onNameChange: (value: string) => void;
  draft: AgentDraft;
  onDraftChange: (draft: AgentDraft) => void;
  isDirty: boolean;
  /** The full agent body is fetched separately from the type list; true while that is in flight. */
  loading: boolean;
  installedFrom?: AgentInstallSource | undefined;
  updatedAt?: string | null;
  categories: string[];
  runningCount: number;
  /** Cards for the agents currently running this type, rendered by the app that owns the list. */
  runningAgents?: React.ReactNode;
  saving: boolean;
  launching: boolean;
  /** Keyboard shortcut for launching, shown as a hint beside the button. */
  launchShortcut?: string;
  onSave: () => void;
  onRevert: () => void;
  onDelete: () => void;
  onClone: () => void;
  onLaunch: () => void;
  onCancelCreate: () => void;
  onBack: () => void;
}) {
  // Unique per editor: tabbed layouts keep several editors mounted at once, and shared ids
  // would point every label at the first editor's fields.
  const uid = useId();
  const creating = mode === "create";
  const readOnly = mode === "bundled";
  const trimmedName = nameValue.trim();
  const nameError = creating ? agentNameError(trimmedName) : null;
  const canSave = !saving && isDraftComplete(draft) && (creating ? isValidAgentName(trimmedName) : isDirty);

  const title = creating ? "New agent" : draft.displayName || agentType || "";

  if (loading) {
    return (
      <div className="h-full flex flex-col bg-primary">
        <LoadingState message="Loading agent…" className="flex-1" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-primary">
      <ViewHeader
        title={title}
        subtitle={
          creating ? (
            "Define a new agent type in your workspace"
          ) : (
            <span className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
              <nav aria-label="Breadcrumb" className="flex items-center gap-1 min-w-0">
                <button type="button" onClick={onBack} className="hover:text-primary transition-colors cursor-pointer focus-ring rounded">
                  Agents
                </button>
                <ChevronRight className="w-3 h-3 text-dim shrink-0" aria-hidden="true" />
                <span className="text-secondary truncate" aria-current="page">
                  {title}
                </span>
              </nav>
              <span aria-hidden="true">·</span>
              <code className="font-mono">{agentType}</code>
              <span>· {readOnly ? "Bundled" : "Workspace"}</span>
              {updatedAt && <span>· updated {new Date(updatedAt).toLocaleString()}</span>}
              {isDirty && <span className="text-amber-600 dark:text-amber-500 font-medium">· unsaved changes</span>}
              {runningCount > 0 && <span className="text-amber-600 dark:text-amber-500 font-medium">· {runningCount} running</span>}
            </span>
          )
        }
        icon={<Cpu />}
        iconGradient="from-amber-500 to-orange-600"
      >
        {creating ? (
          <button
            type="button"
            onClick={onCancelCreate}
            className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
          >
            <X className="w-3.5 h-3.5" /> Cancel
          </button>
        ) : (
          <>
            {/* Phones keep the control (icon only) — it is their only way back to the overview. */}
            <button
              type="button"
              onClick={onBack}
              aria-label="Back to overview"
              title="Back to overview"
              className="inline-flex items-center gap-1 px-1.5 sm:px-2.5 py-1.5 text-xs font-medium text-secondary hover:text-primary hover:bg-hover rounded-lg transition-colors cursor-pointer focus-ring"
            >
              <ChevronLeft className="w-3.5 h-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Overview</span>
            </button>
            {launchShortcut && (
              <kbd className="hidden md:inline-flex items-center px-1.5 py-0.5 bg-tertiary border border-primary rounded-md text-xs text-muted font-mono">
                {launchShortcut}
              </kbd>
            )}
            <LaunchButton
              loading={launching}
              onClick={onLaunch}
              title={launchShortcut ? `Start a new agent of this type (${launchShortcut})` : "Start a new agent of this type"}
            />
            <button
              type="button"
              onClick={onClone}
              title={readOnly ? "Create an editable copy in your workspace" : "Clone this agent as a new draft"}
              className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring"
            >
              <Copy className="w-3.5 h-3.5" /> {readOnly ? "Clone to workspace" : "Clone"}
            </button>
            {!readOnly && (
              <>
                <button
                  type="button"
                  onClick={onRevert}
                  disabled={!isDirty}
                  title="Discard unsaved changes"
                  className="flex items-center gap-1.5 px-2.5 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Revert
                </button>
                <button
                  type="button"
                  onClick={onDelete}
                  title="Delete this agent"
                  className="p-1.5 text-muted hover:text-red-500 border border-primary rounded-lg transition-colors cursor-pointer focus-ring"
                  aria-label={`Delete agent ${title}`}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </>
            )}
          </>
        )}
        {!readOnly && (
          <Button type="button" icon={Save} busy={saving} disabled={!canSave} onClick={onSave}>
            {creating ? "Create" : "Save"}
          </Button>
        )}
      </ViewHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-5">
        <div className="max-w-3xl mx-auto space-y-5">
          {readOnly && (
            <div className="flex flex-wrap items-center justify-between gap-3 bg-secondary border border-primary rounded-lg px-3 py-2.5">
              <p className="text-xs text-muted min-w-0">
                This agent ships with TokenRing and is read-only here. Clone it to get an editable copy in your workspace, or change it in the Configuration
                app.
              </p>
              <Link
                to="/configuration"
                className="inline-flex items-center gap-1.5 px-2.5 py-1.5 bg-secondary border border-primary text-xs font-medium text-secondary hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring shrink-0"
              >
                <SlidersHorizontal className="w-3.5 h-3.5" aria-hidden="true" />
                Edit in Configuration
              </Link>
            </div>
          )}

          {runningCount > 0 && runningAgents && (
            <div className="space-y-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Running agents of this type</span>
              {runningAgents}
            </div>
          )}

          {installedFrom && (
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <Store className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
              Installed from <code className="font-mono text-secondary">{installedFrom.registry}</code>
              {installedFrom.version && <span>· v{installedFrom.version}</span>}
              {installedFrom.author && <span>· by {installedFrom.author}</span>}
            </p>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <label htmlFor={`${uid}-agent-type`} className="text-xs font-semibold text-muted uppercase tracking-wide">
                Agent type {creating ? "" : "(fixed)"}
              </label>
              <input
                id={`${uid}-agent-type`}
                type="text"
                value={creating ? nameValue : (agentType ?? "")}
                onChange={event => onNameChange(event.target.value)}
                disabled={!creating}
                placeholder="code-reviewer"
                spellCheck={false}
                className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs font-mono text-primary placeholder-muted focus-accent disabled:opacity-60 disabled:cursor-not-allowed"
              />
              {nameError && <p className="text-xs text-red-500">{nameError}</p>}
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-agent-display-name`} className="text-xs font-semibold text-muted uppercase tracking-wide">
                Display name
              </label>
              <input
                id={`${uid}-agent-display-name`}
                type="text"
                value={draft.displayName}
                onChange={event => onDraftChange({ ...draft, displayName: event.target.value })}
                disabled={readOnly}
                placeholder="Code Reviewer"
                className={controlClassName()}
              />
            </div>
            <div className="space-y-1">
              <label htmlFor={`${uid}-agent-category`} className="text-xs font-semibold text-muted uppercase tracking-wide">
                Category
              </label>
              <input
                id={`${uid}-agent-category`}
                type="text"
                list={`${uid}-agent-category-options`}
                value={draft.category}
                onChange={event => onDraftChange({ ...draft, category: event.target.value })}
                disabled={readOnly}
                placeholder={DEFAULT_AGENT_CATEGORY}
                className={controlClassName()}
              />
              <datalist id={`${uid}-agent-category-options`}>
                {categories.map(category => (
                  <option key={category} value={category} />
                ))}
              </datalist>
            </div>
          </div>

          <div className="space-y-1">
            <label htmlFor={`${uid}-agent-description`} className="text-xs font-semibold text-muted uppercase tracking-wide">
              Description
            </label>
            <AutoResizeTextarea
              id={`${uid}-agent-description`}
              value={draft.description}
              onChange={event => onDraftChange({ ...draft, description: event.target.value })}
              disabled={readOnly}
              minRows={2}
              maxRows={8}
              placeholder="What this agent type is for"
              className={controlClassName()}
            />
          </div>

          <div className="space-y-1">
            <label htmlFor={`${uid}-agent-system-prompt`} className="text-xs font-semibold text-muted uppercase tracking-wide">
              System prompt
            </label>
            <AutoResizeTextarea
              id={`${uid}-agent-system-prompt`}
              value={draft.systemPrompt}
              onChange={event => onDraftChange({ ...draft, systemPrompt: event.target.value })}
              disabled={readOnly}
              minRows={6}
              maxRows={40}
              placeholder="Instructions given to the agent at the start of every conversation"
              className={controlClassName({ mono: true })}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Enabled tools</span>
              <span className="text-xs text-muted">Names or prefixes, e.g. file_*</span>
            </div>
            <StringListEditor
              values={draft.enabledTools}
              onChange={enabledTools => onDraftChange({ ...draft, enabledTools })}
              label="tool"
              placeholder="file_*"
              addLabel="Add tool"
              disabled={readOnly}
              mono
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold text-muted uppercase tracking-wide">Initial commands</span>
              <span className="text-xs text-muted">Run automatically when an agent of this type starts</span>
            </div>
            <StringListEditor
              values={draft.initialCommands}
              onChange={initialCommands => onDraftChange({ ...draft, initialCommands })}
              label="command"
              placeholder="/model set anthropic:claude-opus-5"
              addLabel="Add command"
              disabled={readOnly}
              mono
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {NUMBER_FIELDS.map(field => (
              <div key={field.key} className="space-y-1">
                <label className="text-xs font-semibold text-muted uppercase tracking-wide" htmlFor={`${uid}-agent-${field.key}`}>
                  {field.label} <span className="font-normal lowercase tracking-normal">({field.unit})</span>
                </label>
                <input
                  id={`${uid}-agent-${field.key}`}
                  type="number"
                  min={0}
                  value={draft[field.key]}
                  onChange={event => onDraftChange({ ...draft, [field.key]: Number(event.target.value) || 0 })}
                  disabled={readOnly}
                  title={field.hint}
                  className="w-full bg-input border border-control rounded-lg px-3 py-2 text-xs text-primary focus-accent disabled:opacity-60"
                />
              </div>
            ))}
          </div>

          {Object.keys(draft.rest).length > 0 && (
            <p className="text-xs text-muted">
              This agent also configures{" "}
              {Object.keys(draft.rest)
                .map(key => key)
                .join(", ")}
              . Those settings are preserved when you save, but are only editable in the YAML file or the Configuration app.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
