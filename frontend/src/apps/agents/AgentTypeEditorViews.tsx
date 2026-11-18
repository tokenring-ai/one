import formatError from "@tokenring-ai/utility/error/formatError";
import { Cpu, X } from "lucide-react";
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewShell from "../../components/ui/ViewShell.tsx";
import AgentTypeEditor from "../../features/agents/AgentTypeEditor.tsx";
import {
  type AgentBody,
  type AgentDraft,
  emptyDraft,
  fromDraft,
  isSameDraft,
  isValidAgentName,
  toDraft,
  uniqueCloneName,
} from "../../features/agents/agentDraft.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { useKeyboardShortcuts } from "../../hooks/useKeyboardShortcuts.ts";
import type { ViewProps } from "../../layout/define.ts";
import { usePaneLink, usePanel } from "../../layout/hooks.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, useAgentTypeDetail } from "../../rpc.ts";
import { usePanelBadge, usePanelTitle } from "../panelHooks.ts";
import { clearAgentDraft, getAgentDraft, NEW_DRAFT_KEY, setAgentDraft, setNewAgentName, useAgentDraftStore } from "./agentDraftStore.ts";
import {
  AGENT_TYPE_CREATE_VIEW,
  AGENT_TYPE_DETAIL_VIEW,
  AGENTS_START_VIEW,
  LAUNCH_SHORTCUT,
  RunningAgentCard,
  sortRunningAgents,
  sourceOf,
  typeName,
} from "./shared.tsx";
import { useAgentActions } from "./useAgentActions.ts";

const SYSTEM_PROMPT_REQUIRED = "A system prompt is required.";

type WorkspaceDefinition = { name: string; updatedAt: string };

/** Blank prompts omit chat.systemPrompt, which ChatService.attach cannot parse. Keep the saved prompt, or refuse the save. */
function draftWithPrompt(draft: AgentDraft, previousPrompt: string | undefined): AgentDraft | null {
  if (draft.systemPrompt.trim() !== "") return draft;
  const previous = previousPrompt?.trim() ?? "";
  if (previous === "") return null;
  return { ...draft, systemPrompt: previous };
}

/** Always includes a chat slice ChatService can parse, even when the form has no tools. */
function agentBodyForSave(draft: AgentDraft): AgentBody {
  const agent = fromDraft(draft);
  const prompt = draft.systemPrompt.trim();
  const chat: Record<string, unknown> = typeof agent.chat === "object" && agent.chat !== null ? { ...(agent.chat as Record<string, unknown>) } : {};
  if (typeof chat.systemPrompt !== "string" || chat.systemPrompt.trim() === "") chat.systemPrompt = prompt;
  agent.chat = chat;
  return agent;
}

/** YAML directory plus the definitions stored there. The type list is only a summary of registered types. */
function useWorkspaceAgentFiles() {
  const [directory, setDirectory] = useState<string | null>(null);
  const [definitions, setDefinitions] = useState<WorkspaceDefinition[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = useCallback(() => setReloadToken(token => token + 1), []);

  useEffect(() => {
    const live = { current: true };
    void (async () => {
      try {
        const [dir, defs] = await Promise.all([agentRPCClient.getAgentDirectory({}), agentRPCClient.listAgentDefinitions({})]);
        if (!live.current) return;
        setDirectory(dir.directory);
        setDefinitions(defs.map(definition => ({ name: definition.name, updatedAt: definition.updatedAt })));
        setError(null);
      } catch (err) {
        if (live.current) setError(formatError(err));
      }
    })();
    return () => {
      live.current = false;
    };
  }, [reloadToken]);

  return { directory, definitions, error, reload };
}

function AgentYamlDirectory({ directory, definitions, error }: { directory: string | null; definitions: WorkspaceDefinition[] | null; error: string | null }) {
  return (
    <div className="shrink-0 border-b border-primary bg-secondary px-4 py-2 space-y-0.5" role="region" aria-label="Agent YAML directory">
      <p className="text-xs text-muted break-all">
        YAML directory {directory ? <code className="font-mono text-secondary">{directory}</code> : error ? null : <span>Loading…</span>}
      </p>
      {definitions && (
        <p className="text-xs text-muted break-all">
          {definitions.length === 0 ? "No agent definitions in this directory." : `Definitions: ${definitions.map(definition => definition.name).join(", ")}`}
        </p>
      )}
      {error && <p className="text-xs text-error">{error}</p>}
    </div>
  );
}

function EditorFrame({
  directory,
  definitions,
  error,
  children,
}: {
  directory: string | null;
  definitions: WorkspaceDefinition[] | null;
  error: string | null;
  children: ReactNode;
}) {
  return (
    <ViewShell scroll={false}>
      <AgentYamlDirectory directory={directory} definitions={definitions} error={error} />
      <div className="flex-1 min-h-0">{children}</div>
    </ViewShell>
  );
}

/** Warning dot on the panel's tab while its draft has unsaved edits; cleared on unmount. */
function useDirtyBadge(dirty: boolean, label: string) {
  usePanelBadge(dirty ? { tone: "warning", label } : null);
}

function useCategories(agentTypes: { category?: string }[]): string[] {
  return useMemo(() => [...new Set(agentTypes.map(t => t.category).filter((c): c is string => !!c))].sort(), [agentTypes]);
}

/** View or edit one configured agent type; bundled types are read-only and offer a clone instead. */
export function AgentTypeDetailView({ params }: ViewProps) {
  const type = params.agentType ?? "";
  const panel = usePanel();
  const openPane = usePaneLink();
  const openOverview = useCallback(() => openPane(AGENTS_START_VIEW), [openPane]);
  const openCreate = useCallback(() => openPane(AGENT_TYPE_CREATE_VIEW), [openPane]);
  const { agentTypes, agentTypeList, agentList, openAgent, launch, launchingType, refreshAgentTypes, confirmOpen, ConfirmDialog } = useAgentActions();
  const { openConfirm, isOpen: deleteConfirmOpen, Dialog: DeleteDialog } = useConfirmDialog();
  const [saving, setSaving] = useState(false);
  const workspaceFiles = useWorkspaceAgentFiles();

  const selected = useMemo(() => agentTypeList.find(t => t.type === type) ?? null, [agentTypeList, type]);
  // Only fetched once the type is open — the list endpoint carries a summary, not the full agent body.
  const detail = useAgentTypeDetail(selected ? type : null);
  const { drafts, newName } = useAgentDraftStore();
  const savedDraft = useMemo(() => (detail.data ? toDraft(detail.data.agent as Record<string, unknown>) : null), [detail.data]);
  const draft = drafts[type] ?? savedDraft;
  const isDirty = draft !== null && savedDraft !== null && !isSameDraft(draft, savedDraft);
  const categories = useCategories(agentTypeList);
  const typeAgents = useMemo(() => sortRunningAgents(agentList.filter(agent => agent.agentType === type)), [agentList, type]);

  usePanelTitle(selected ? typeName(selected) : type);
  useDirtyBadge(isDirty, "Unsaved changes");

  const handleSave = useCallback(async () => {
    if (!draft) return;
    const sent = draftWithPrompt(draft, savedDraft?.systemPrompt);
    if (!sent) {
      toastManager.error(SYSTEM_PROMPT_REQUIRED, { duration: 4000 });
      return;
    }
    if (sent !== draft) setAgentDraft(type, sent);
    setSaving(true);
    try {
      await agentRPCClient.updateAgentDefinition({ name: type, agent: agentBodyForSave(sent) });
      toastManager.success(`Agent "${type}" saved`, { duration: 3000 });
      refreshAgentTypes();
      workspaceFiles.reload();
      // Keep the saved values in the form until the refreshed definition arrives,
      // so the stale server copy never flashes in; the refresh is best-effort.
      try {
        await detail.mutate();
      } catch {
        // A failed refresh leaves the draft in place below; the save itself succeeded.
      }
      // Edits made while the save was in flight stay as the draft.
      const current = getAgentDraft(type);
      if (current && isSameDraft(current, sent)) clearAgentDraft(type);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [detail, draft, refreshAgentTypes, savedDraft, type, workspaceFiles.reload]);

  const handleDelete = useCallback(async () => {
    if (!selected) return;
    const confirmed = await openConfirm({
      id: "agents:delete-agent-type",
      title: "Delete agent",
      message: `Delete "${typeName(selected)}"? Its YAML file will be removed from disk.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    try {
      const { success } = await agentRPCClient.deleteAgentDefinition({ name: type });
      if (!success) throw new Error(`Agent "${type}" could not be deleted`);
      clearAgentDraft(type);
      toastManager.success(`Agent "${type}" deleted`, { duration: 3000 });
      refreshAgentTypes();
      // Close first: closing the focused panel moves the URL to a neighbour, and the overview must win.
      panel.close();
      openOverview();
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    }
  }, [openConfirm, openOverview, panel, refreshAgentTypes, selected, type]);

  /** Opens the create form pre-filled from this agent — the only way to edit a bundled one. */
  const handleClone = useCallback(async () => {
    if (!draft) return;
    // Cloning seeds the create form; never overwrite a new agent the user has started.
    const pending = drafts[NEW_DRAFT_KEY];
    if ((pending && !isSameDraft(pending, emptyDraft())) || newName.trim() !== "") {
      const confirmed = await openConfirm({
        id: "agents:replace-new-agent-draft",
        title: "Replace new agent type draft",
        message: "You have an unsaved new agent type in progress. Replace it with a copy of this one?",
        confirmText: "Replace",
        variant: "warning",
      });
      if (!confirmed) return;
    }
    const baseDisplay = draft.displayName.trim();
    setAgentDraft(NEW_DRAFT_KEY, { ...draft, displayName: baseDisplay ? `${baseDisplay} (copy)` : "" });
    setNewAgentName(
      uniqueCloneName(
        type,
        agentTypeList.map(agentType => agentType.type),
      ),
    );
    openCreate();
  }, [agentTypeList, draft, drafts, newName, openConfirm, openCreate, type]);

  // Ctrl/⌘+Enter starts the agent type on screen (not Ctrl/⌘+L: that is the browser's address bar).
  useKeyboardShortcuts([
    {
      key: "Enter",
      allowInEditable: true,
      enabled: panel.isActive && !confirmOpen && !deleteConfirmOpen && selected !== null,
      handler: () => toastOnReject(launch(type)),
    },
  ]);

  if (!selected) {
    // Type route while types are still loading — avoid flashing not-found.
    if (agentTypes.isLoading || (!agentTypes.error && agentTypeList.length === 0 && !agentTypes.data)) {
      return <LoadingState message="Loading agent type…" className="h-full" />;
    }
    if (agentTypes.error) {
      return <ErrorState title="Failed to load agent types" error={agentTypes.error} onRetry={() => void agentTypes.mutate()} variant="page" />;
    }
    return (
      <EmptyState
        variant="page"
        className="h-full"
        icon={Cpu}
        title="Agent type not found"
        hint={`"${type}" is not configured (it may have been deleted). Close this panel or pick another type.`}
        ctaLabel="Close panel"
        ctaIcon={X}
        onCta={() => panel.close()}
      />
    );
  }

  if (detail.error) {
    return <ErrorState title={`Failed to load "${type}"`} error={detail.error} onRetry={() => void detail.mutate()} variant="page" />;
  }

  return (
    <EditorFrame directory={workspaceFiles.directory} definitions={workspaceFiles.definitions} error={workspaceFiles.error}>
      <AgentTypeEditor
        mode={sourceOf(selected)}
        agentType={type}
        nameValue=""
        onNameChange={() => {}}
        draft={draft ?? emptyDraft()}
        onDraftChange={next => setAgentDraft(type, next)}
        isDirty={isDirty}
        loading={draft === null}
        installedFrom={selected.installedFrom}
        updatedAt={detail.data?.updatedAt ?? null}
        categories={categories}
        runningCount={typeAgents.length}
        runningAgents={
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {typeAgents.map(agent => (
              <RunningAgentCard key={agent.id} agent={agent} onOpen={() => openAgent(agent.id)} />
            ))}
          </div>
        }
        saving={saving}
        launching={launchingType === type}
        launchShortcut={LAUNCH_SHORTCUT}
        onSave={() => void handleSave()}
        onRevert={() => clearAgentDraft(type)}
        onDelete={() => void handleDelete()}
        onClone={() => void handleClone()}
        onLaunch={() => toastOnReject(launch(type))}
        onCancelCreate={() => {}}
        onBack={openOverview}
      />
      <ConfirmDialog />
      <DeleteDialog />
    </EditorFrame>
  );
}

/** Create a workspace agent type. Cloning another type seeds this form. */
export function AgentTypeCreateView(_props: ViewProps) {
  const panel = usePanel();
  const openPane = usePaneLink();
  const openOverview = useCallback(() => openPane(AGENTS_START_VIEW), [openPane]);
  const openType = useCallback((agentType: string) => openPane(AGENT_TYPE_DETAIL_VIEW, { agentType }), [openPane]);
  const { agentTypeList, refreshAgentTypes } = useAgentActions();
  const { drafts, newName } = useAgentDraftStore();
  const [saving, setSaving] = useState(false);
  const workspaceFiles = useWorkspaceAgentFiles();
  const blank = useMemo(() => emptyDraft(), []);
  const draft = drafts[NEW_DRAFT_KEY] ?? blank;
  const isDirty = !isSameDraft(draft, blank);
  const categories = useCategories(agentTypeList);

  useDirtyBadge(isDirty || newName.trim() !== "", "Unsaved new agent type");

  const finish = useCallback(() => {
    clearAgentDraft(NEW_DRAFT_KEY);
    setNewAgentName("");
  }, []);

  const handleSave = useCallback(async () => {
    const name = newName.trim();
    // Also rejects the reserved route names (`new`, `marketplace`); the form shows why.
    if (!isValidAgentName(name)) return;
    if (agentTypeList.some(agentType => agentType.type === name) || workspaceFiles.definitions?.some(definition => definition.name === name)) {
      toastManager.error(`An agent type named "${name}" already exists`, { duration: 4000 });
      return;
    }
    const sent = draftWithPrompt(draft, undefined);
    if (!sent) {
      toastManager.error(SYSTEM_PROMPT_REQUIRED, { duration: 4000 });
      return;
    }
    setSaving(true);
    try {
      await agentRPCClient.createAgentDefinition({ name, agent: agentBodyForSave(sent) });
      finish();
      toastManager.success(`Agent "${name}" saved`, { duration: 3000 });
      refreshAgentTypes();
      // Close first: closing the focused panel moves the URL to a neighbour, and the new type must win.
      panel.close();
      openType(name);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  }, [agentTypeList, draft, finish, newName, openType, panel, refreshAgentTypes, workspaceFiles.definitions]);

  const handleCancel = useCallback(() => {
    finish();
    panel.close();
    openOverview();
  }, [finish, openOverview, panel]);

  return (
    <EditorFrame directory={workspaceFiles.directory} definitions={workspaceFiles.definitions} error={workspaceFiles.error}>
      <AgentTypeEditor
        mode="create"
        agentType={null}
        nameValue={newName}
        onNameChange={setNewAgentName}
        draft={draft}
        onDraftChange={next => setAgentDraft(NEW_DRAFT_KEY, next)}
        isDirty={isDirty}
        loading={false}
        categories={categories}
        runningCount={0}
        saving={saving}
        launching={false}
        onSave={() => void handleSave()}
        onRevert={() => clearAgentDraft(NEW_DRAFT_KEY)}
        onDelete={() => {}}
        onClone={() => {}}
        onLaunch={() => {}}
        onCancelCreate={handleCancel}
        onBack={handleCancel}
      />
    </EditorFrame>
  );
}
