import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { formatBytes } from "@tokenring-ai/utility/number/formatBytes";
import { BookOpen, ChevronDown, ChevronRight, Eye, FileText, FolderOpen, Loader2, Pencil, Plus, Search, Trash2 } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import AgentSessionBar from "../../components/AgentSessionBar.tsx";
import AgentSessionList from "../../components/AgentSessionList.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import { markdownLinkComponents } from "../../components/chat/MarkdownLink.tsx";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ConfirmModal from "../../components/ui/ConfirmModal.tsx";
import CreateItemModal from "../../components/ui/CreateItemModal.tsx";
import EditorSaveBar from "../../components/ui/EditorSaveBar.tsx";
import EmptyStateWithPrompt from "../../components/ui/EmptyStateWithPrompt.tsx";
import ListItemWithActions from "../../components/ui/ListItemWithActions.tsx";
import SaveAsModal from "../../components/ui/SaveAsModal.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import ViewModeToggle from "../../components/ui/ViewModeToggle.tsx";
import { useAppAgentSession } from "../../hooks/useAppAgentSession.tsx";
import { useAutoExpandTree } from "../../hooks/useAutoExpandTree.ts";
import { usePendingAction } from "../../hooks/usePendingAction.tsx";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { useRemoteChangeDetection } from "../../hooks/useRemoteChangeDetection.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import type { RunningAgent } from "../../lib/agentSessions.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, researchRPCClient, useItems, useResearchConfiguration, useTopics } from "../../rpc.ts";

const DEFAULT_MARKDOWN = `# Research Notes

Start writing your findings here, or launch an agent below to research a topic and save markdown items into a research topic.
`;

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const RESEARCH_ROOT = "/research";
const itemPath = (topicName: string, itemName: string) => `${RESEARCH_ROOT}/${encodeURIComponent(topicName)}/${encodeURIComponent(itemName)}`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface TopicSummary {
  name: string;
  itemCount: number;
  updatedAt: string;
}

interface ItemSummary {
  topicName: string;
  name: string;
  size: number;
  updatedAt: string;
}

interface SelectedItem {
  topicName: string;
  name: string;
}

type PendingAction = { type: "select"; topicName: string; name: string } | { type: "new"; presetTopicName: string };

// ─── TopicRow ──────────────────────────────────────────────────────────────────

function TopicRow({
  topic,
  expanded,
  onToggle,
  selected,
  refreshSignal,
  onSelectItem,
  onNewItem,
  onDeleteItem,
  onDeleteTopic,
  onItemsChange,
}: {
  topic: TopicSummary;
  expanded: boolean;
  onToggle: () => void;
  selected: SelectedItem | null;
  refreshSignal: number;
  onSelectItem: (topicName: string, name: string) => void;
  onNewItem: (topicName: string) => void;
  onDeleteItem: (topicName: string, name: string) => void;
  onDeleteTopic: (topicName: string) => void;
  onItemsChange?: ((topicName: string, items: ItemSummary[]) => void) | undefined;
}) {
  // Live stream so agent-written dossiers appear without manual refresh
  const { data: itemsData, isLoading: loadingItems, error: itemsError, mutate: refreshItems } = useItems(expanded ? topic.name : null);
  const items = itemsData?.items ?? null;

  useEffect(() => {
    if (!expanded || refreshSignal === 0) return;
    void refreshItems();
  }, [expanded, refreshSignal, refreshItems]);

  useEffect(() => {
    if (itemsError) toastManager.error(formatError(itemsError), { duration: 4000 });
  }, [itemsError]);

  useEffect(() => {
    if (items) onItemsChange?.(topic.name, items);
  }, [items, topic.name, onItemsChange]);

  return (
    <div className="border-b border-primary/50">
      <ListItemWithActions
        id={`topic:${topic.name}`}
        onPrimary={onToggle}
        className="gap-1.5 px-2 py-2 rounded-none"
        action={
          <>
            <button
              type="button"
              onClick={() => onNewItem(topic.name)}
              title="New item in this topic"
              className="p-0.5 text-muted hover:text-primary rounded transition-opacity cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteTopic(topic.name)}
              title="Delete topic"
              className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
            >
              <Trash2 className="w-3 h-3" />
            </button>
          </>
        }
      >
        <span className="flex items-center gap-1.5 min-w-0">
          {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
          <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
          <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={topic.name}>
            {topic.name}
          </span>
          <span className="text-xs text-muted shrink-0">{topic.itemCount}</span>
        </span>
      </ListItemWithActions>

      {expanded && (
        <div className="pl-5">
          {loadingItems && items === null ? (
            <div className="px-2 py-2 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : itemsError && items === null ? (
            <div className="px-2 py-2 space-y-1.5">
              <p className="text-xs text-red-500">Failed to load items</p>
              <button type="button" onClick={() => void refreshItems()} className="text-xs text-accent hover:underline cursor-pointer focus-ring rounded">
                Retry
              </button>
            </div>
          ) : items && items.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">No items yet</p>
          ) : (
            items?.map(item => {
              const isSelected = !!(selected && selected.topicName === topic.name && selected.name === item.name);
              return (
                <ListItemWithActions
                  key={item.name}
                  id={`item:${topic.name}/${item.name}`}
                  selected={isSelected}
                  onPrimary={() => onSelectItem(topic.name, item.name)}
                  className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                  action={
                    <>
                      <span className="text-xs text-muted shrink-0 tabular-nums">{formatBytes(item.size)}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteItem(topic.name, item.name)}
                        title="Delete item"
                        className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  }
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate text-xs" title={item.name}>
                      {item.name}
                    </span>
                  </span>
                </ListItemWithActions>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

// ─── Markdown dossier preview ──────────────────────────────────────────────────

function DossierPreview({ content }: { content: string }) {
  return (
    <div className="h-full overflow-y-auto bg-primary">
      <div className="p-5 sm:p-6 max-w-3xl mx-auto">
        <article
          className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:text-primary prose-p:text-secondary prose-code:text-primary
          prose-a:text-accent prose-strong:text-primary prose-blockquote:text-muted
          prose-li:text-secondary prose-th:text-primary prose-td:text-secondary
          prose-code:bg-tertiary prose-code:rounded prose-code:px-1 prose-code:py-0.5
          prose-pre:bg-tertiary prose-pre:border prose-pre:border-primary"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>
            {content}
          </ReactMarkdown>
        </article>
      </div>
    </div>
  );
}

// ─── Sidebar ───────────────────────────────────────────────────────────────────

function TopicsSidebar({
  topics,
  topicsLoading,
  topicsError,
  onRetryTopics,
  expandedTopics,
  onToggleTopic,
  selected,
  refreshSignal,
  onSelectItem,
  onNewItem,
  onDeleteItem,
  onDeleteTopic,
  onNewTopic,
  onNewItemGlobal,
  onItemsChange,
  agents,
  agentsLoading,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  onTerminateAgent,
}: {
  topics: TopicSummary[];
  topicsLoading: boolean;
  topicsError: unknown;
  onRetryTopics: () => void;
  expandedTopics: Set<string>;
  onToggleTopic: (name: string) => void;
  selected: SelectedItem | null;
  refreshSignal: number;
  onSelectItem: (topicName: string, name: string) => void;
  onNewItem: (topicName: string) => void;
  onDeleteItem: (topicName: string, name: string) => void;
  onDeleteTopic: (topicName: string) => void;
  onNewTopic: () => void;
  onNewItemGlobal: () => void;
  onItemsChange?: (topicName: string, items: ItemSummary[]) => void;
  agents: RunningAgent[];
  agentsLoading: boolean;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onTerminateAgent: (agentId: string) => void;
}) {
  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <NavigationSidebarHeader
        title="Topics"
        actions={[
          {
            icon: <FileText className="w-3.5 h-3.5" />,
            label: "New research item",
            title: "New research item",
            onClick: onNewItemGlobal,
          },
          {
            icon: <Plus className="w-3.5 h-3.5" />,
            label: "New topic",
            title: "New topic",
            onClick: onNewTopic,
          },
        ]}
      />

      <AgentSessionList
        agents={agents}
        selectedAgentId={selectedAgentId}
        isLoading={agentsLoading}
        storageKey="research"
        label="Research agents"
        onSelect={onSelectAgent}
        onCreate={onCreateAgent}
        onTerminate={onTerminateAgent}
      />

      <div className="flex-1 overflow-y-auto">
        {topicsLoading && topics.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted flex flex-col items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading topics…
          </div>
        ) : topicsError && topics.length === 0 ? (
          <div className="px-3 py-6 text-center space-y-2">
            <p className="text-xs text-red-500">Failed to load topics</p>
            <button type="button" onClick={onRetryTopics} className="text-xs text-accent hover:underline cursor-pointer focus-ring rounded">
              Retry
            </button>
          </div>
        ) : topics.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <BookOpen className="w-6 h-6 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">No topics yet</p>
            <p className="text-xs text-muted mt-1">Start a research agent or create a topic</p>
          </div>
        ) : (
          topics.map(topic => (
            <TopicRow
              key={topic.name}
              topic={topic}
              expanded={expandedTopics.has(topic.name)}
              onToggle={() => onToggleTopic(topic.name)}
              selected={selected}
              refreshSignal={refreshSignal}
              onSelectItem={onSelectItem}
              onNewItem={onNewItem}
              onDeleteItem={onDeleteItem}
              onDeleteTopic={onDeleteTopic}
              onItemsChange={onItemsChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function ResearchApp() {
  const navigate = useNavigate();
  const { topicName: routeTopicName, itemName: routeItemName } = useParams<{ topicName?: string; itemName?: string }>();
  const [theme] = useTheme();
  const { data: topicsData, mutate: refreshTopics, isLoading: topicsLoading, error: topicsError } = useTopics();
  const topics = topicsData?.topics ?? [];
  const configuration = useResearchConfiguration();
  const allowedAgentTypes = configuration.data?.agentTypes ?? ["research"];

  const seedContent = DEFAULT_MARKDOWN;
  const [markdownContent, setMarkdownContent] = useState(seedContent);
  const selected: SelectedItem | null = useMemo(
    () => (routeTopicName && routeItemName ? { topicName: routeTopicName, name: routeItemName } : null),
    [routeTopicName, routeItemName],
  );
  const selectedKey = selected ? `${selected.topicName}/${selected.name}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [savedContent, setSavedContent] = useState(seedContent);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingItem, setIsLoadingItem] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [saveModal, setSaveModal] = useState<{ mode: "create" | "saveAs"; presetTopicName: string } | null>(null);
  const [newTopicModalOpen, setNewTopicModalOpen] = useState(false);
  const [deleteItemTarget, setDeleteItemTarget] = useState<SelectedItem | null>(null);
  const [deleteTopicTarget, setDeleteTopicTarget] = useState<string | null>(null);

  const [itemsRefreshSignal, setItemsRefreshSignal] = useState(0);
  const bumpItemsRefresh = useCallback(() => setItemsRefreshSignal(n => n + 1), []);
  // Track remote item mtimes so agent writes can refresh the open dossier
  const [itemMetaByKey, setItemMetaByKey] = useState<Record<string, string>>({});
  // Bridge so load/save callbacks (defined before the hook) can update the detection baseline
  const markLoadedRef = useRef<(updatedAt: string | null) => void>(() => {});

  const {
    agentId,
    agent,
    agents,
    isLoading: agentsLoading,
    isCreating: isCreatingAgent,
    selectAgent,
    createAgent,
    terminateAgent,
    TerminateDialog,
  } = useAppAgentSession({ appName: "Research app", storageKey: "research", agentTypes: allowedAgentTypes });

  // Auto-expand topics that gain items while a research agent runs; honor manual collapses
  const {
    expandedKeys: expandedTopics,
    toggle: handleToggleTopic,
    expand: expandTopic,
    collapse: collapseTopic,
  } = useAutoExpandTree({
    items: topics,
    getKey: (t: TopicSummary) => t.name,
    getCount: (t: TopicSummary) => t.itemCount,
    agentId,
    respectUserCollapse: true,
  });

  const handleStartResearch = useCallback(
    async (query: string): Promise<boolean> => {
      // Reuse the attached agent so a second prompt continues the same conversation.
      const id = agentId ?? (await createAgent());
      if (!id) return false;
      try {
        const sendResult = await agentRPCClient.sendInput({
          agentId: id,
          input: {
            from: "Research app",
            message: `/deep research ${query}`,
          },
        });
        if (sendResult.status === "agentNotFound") {
          toastManager.error("Research agent is no longer available", { duration: 5000 });
          return false;
        }
        // Expand all topics as the agent creates them so dossiers appear live
        return true;
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        return false;
      }
    },
    [agentId, createAgent],
  );

  const isDocumentReady = selectedKey !== null ? loadedKey === selectedKey : isDraft;
  const isDirty = isDocumentReady && markdownContent !== savedContent;
  const { pendingAction, queueAction, PendingDialog } = usePendingAction<PendingAction>({ isDirty });
  // Latest selection/content after awaits (save, load, agent poll) without stale closures.
  const selectedKeyRef = useRefSync(selectedKey);
  const isDirtyRef = useRefSync(isDirty);
  const markdownContentRef = useRefSync(markdownContent);

  const handleItemsChange = useCallback((topicName: string, items: ItemSummary[]) => {
    setItemMetaByKey(prev => {
      let changed = false;
      const next = { ...prev };
      for (const item of items) {
        const key = `${topicName}/${item.name}`;
        if (next[key] !== item.updatedAt) {
          next[key] = item.updatedAt;
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, []);

  const closeDocument = useCallback(() => {
    setMarkdownContent(DEFAULT_MARKDOWN);
    setSavedContent(DEFAULT_MARKDOWN);
    setLoadedKey(null);
    setIsDraft(false);
    setLoadError(null);
    setViewMode("preview");
    markLoadedRef.current(null);
    void navigate(RESEARCH_ROOT);
  }, [navigate]);

  const openCreateModal = useCallback(
    (presetTopicName = "") => {
      closeDocument();
      setSaveModal({ mode: "create", presetTopicName });
    },
    [closeDocument],
  );

  const handleNew = useCallback(
    (presetTopicName = "") => {
      if (queueAction({ type: "new", presetTopicName })) return;
      openCreateModal(presetTopicName);
    },
    [queueAction, openCreateModal],
  );

  const handleSelectItem = useCallback(
    (topicName: string, name: string) => {
      const nextKey = `${topicName}/${name}`;
      if (selectedKey !== nextKey && queueAction({ type: "select", topicName, name })) return;
      void navigate(itemPath(topicName, name));
    },
    [queueAction, selectedKey, navigate],
  );

  const runPendingAction = useCallback(
    (action: PendingAction) => {
      if (action.type === "select") {
        void navigate(itemPath(action.topicName, action.name));
        return;
      }
      openCreateModal(action.presetTopicName);
    },
    [navigate, openCreateModal],
  );

  // Keep the agent’s current item in sync so addSelectedItem can attach it to chat input.
  useEffect(() => {
    if (!agentId || !routeTopicName || !routeItemName) return;
    toastOnReject(
      researchRPCClient.updateResearchState({
        agentId,
        selectedTopicName: routeTopicName,
        selectedItemName: routeItemName,
      }),
    );
  }, [agentId, routeTopicName, routeItemName]);

  const loadItem = useCallback(async (topicName: string, name: string, options?: { silent?: boolean }) => {
    const key = `${topicName}/${name}`;
    if (!options?.silent) {
      setIsLoadingItem(true);
      setLoadError(null);
    }
    try {
      const { item } = await researchRPCClient.getItem({ topicName, name });
      // Drop stale responses if the user navigated away or started editing mid-flight
      if (selectedKeyRef.current !== key) return false;
      if (options?.silent && isDirtyRef.current) return false;
      if (!item) {
        const message = `Item "${name}" not found in topic "${topicName}"`;
        if (!options?.silent) {
          toastManager.error(message, { duration: 4000 });
          setLoadError(message);
        }
        return false;
      }
      setMarkdownContent(item.content);
      setSavedContent(item.content);
      setLoadedKey(key);
      setIsDraft(false);
      setLoadError(null);
      markLoadedRef.current(item.updatedAt);
      setItemMetaByKey(prev => ({ ...prev, [key]: item.updatedAt }));
      // Prefer preview when opening dossiers for browsing
      if (!options?.silent) setViewMode("preview");
      return true;
    } catch (e: unknown) {
      if (selectedKeyRef.current !== key) return false;
      if (!options?.silent) {
        toastManager.error(formatError(e), { duration: 4000 });
        setLoadError(formatError(e));
      }
      return false;
    } finally {
      if (!options?.silent) setIsLoadingItem(false);
    }
  }, []);

  useEffect(() => {
    if (!routeTopicName || !routeItemName) return;
    const key = `${routeTopicName}/${routeItemName}`;
    if (key === loadedKey) return;
    void loadItem(routeTopicName, routeItemName);
  }, [routeTopicName, routeItemName, loadedKey, loadItem]);

  useEffect(() => {
    if (!routeTopicName) return;
    expandTopic(routeTopicName);
  }, [routeTopicName, expandTopic]);

  // When the agent rewrites the open item, refresh the editor if the user has no local edits.
  // Relies on TopicRow's streamItems → onItemsChange while the topic is expanded (selected topic is auto-expanded).
  const { markLoaded } = useRemoteChangeDetection({
    documentKey: selectedKey,
    isDocumentReady,
    isDirty,
    strategy: {
      type: "streaming",
      remoteMeta: selectedKey ? (itemMetaByKey[selectedKey] ?? null) : null,
      getUpdatedAt: (meta: string) => meta,
    },
    onRemoteChange: () => {
      if (!selected) return;
      void loadItem(selected.topicName, selected.name, { silent: true });
    },
  });
  markLoadedRef.current = markLoaded;

  useEffect(() => {
    if (topicsError) toastManager.error(formatError(topicsError), { duration: 4000 });
  }, [topicsError]);

  const handleSave = useCallback(async () => {
    // Allow opening the create modal even when no document is loaded yet
    if (!selected) {
      setSaveModal({ mode: "create", presetTopicName: "" });
      return;
    }
    if (!isDocumentReady) return;
    setIsSaving(true);
    try {
      const { item } = await researchRPCClient.updateItem({
        topicName: selected.topicName,
        name: selected.name,
        content: markdownContentRef.current,
      });
      setSavedContent(item.content);
      markLoadedRef.current(item.updatedAt);
      setItemMetaByKey(prev => ({ ...prev, [`${item.topicName}/${item.name}`]: item.updatedAt }));
      bumpItemsRefresh();
      void refreshTopics();
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [isDocumentReady, selected, bumpItemsRefresh, refreshTopics]);

  const handleSaveModalSubmit = useCallback(
    async (topicName: string, itemName: string) => {
      try {
        // createItem for new names; updateItem when overwriting via Save As to an existing path is not supported
        // (user must pick a unique name). createItem auto-vivifies the topic directory.
        const { item } = await researchRPCClient.createItem({
          topicName,
          name: itemName,
          content: markdownContentRef.current,
        });
        setSavedContent(item.content);
        setMarkdownContent(item.content);
        setLoadedKey(`${item.topicName}/${item.name}`);
        setIsDraft(false);
        markLoadedRef.current(item.updatedAt);
        setItemMetaByKey(prev => ({ ...prev, [`${item.topicName}/${item.name}`]: item.updatedAt }));
        setSaveModal(null);
        setViewMode("edit");
        expandTopic(topicName);
        void navigate(itemPath(item.topicName, item.name));
        bumpItemsRefresh();
        void refreshTopics();
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [navigate, bumpItemsRefresh, refreshTopics, expandTopic],
  );

  const handleDeleteItem = useCallback(
    async (topicName: string, name: string) => {
      try {
        await researchRPCClient.deleteItem({ topicName, name });
        if (selected && selected.topicName === topicName && selected.name === name) {
          closeDocument();
        }
        setDeleteItemTarget(null);
        bumpItemsRefresh();
        void refreshTopics();
        toastManager.success("Deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, bumpItemsRefresh, refreshTopics],
  );

  const handleCreateTopic = useCallback(
    async (name: string) => {
      try {
        await researchRPCClient.createTopic({ name });
        setNewTopicModalOpen(false);
        void refreshTopics();
        toastManager.success("Topic created", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [refreshTopics],
  );

  const handleDeleteTopic = useCallback(
    async (topicName: string) => {
      try {
        await researchRPCClient.deleteTopic({ name: topicName });
        if (selected?.topicName === topicName) {
          closeDocument();
        }
        collapseTopic(topicName);
        setDeleteTopicTarget(null);
        void refreshTopics();
        toastManager.success("Topic deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, refreshTopics, collapseTopic],
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "s") {
        e.preventDefault();
        void handleSave();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [handleSave]);

  // Warn on browser close / refresh with unsaved edits
  useEffect(() => {
    if (!isDirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      // oxlint-disable-next-line typescript/no-deprecated
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [isDirty]);

  const subtitle = selected ? `${selected.topicName} / ${selected.name}` : isDraft ? "Untitled" : "No item open";

  const mainPane = isDocumentReady ? (
    viewMode === "preview" ? (
      <DossierPreview content={markdownContent} />
    ) : (
      <div className="h-full bg-primary">
        <Editor
          height="100%"
          language="markdown"
          theme={theme === "light" ? "vs-light" : "vs-dark"}
          value={markdownContent}
          onChange={value => setMarkdownContent(value ?? "")}
          options={{
            minimap: { enabled: false },
            fontSize: 13,
            wordWrap: "on",
            lineNumbers: "on",
            scrollBeyondLastLine: false,
            padding: { top: 12 },
          }}
        />
      </div>
    )
  ) : selected && loadError ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-primary text-center">
      <p className="text-xs text-red-500 max-w-md">{loadError}</p>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => void loadItem(selected.topicName, selected.name)}
          className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={closeDocument}
          className="px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
        >
          Back to topics
        </button>
      </div>
    </div>
  ) : selected || isLoadingItem ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading {selected ? `${selected.topicName} / ${selected.name}` : "…"}…
    </div>
  ) : topicsLoading && topics.length === 0 ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading research topics…
    </div>
  ) : topicsError && topics.length === 0 ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-primary text-center">
      <p className="text-xs text-red-500 max-w-md">Failed to load research topics</p>
      <button
        type="button"
        onClick={() => void refreshTopics()}
        className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
      >
        Retry
      </button>
    </div>
  ) : (
    <EmptyStateWithPrompt
      icon={Search}
      iconGradient="from-indigo-500 to-violet-600"
      title="Start researching"
      descriptionWithContent={
        <>
          Select existing research from the <span className="font-medium text-secondary">Topics</span> menu on the left to view it, or describe a new topic
          below to start a research agent.
        </>
      }
      descriptionEmpty={
        <>Describe what you want to research below. A research agent will search the web and write markdown findings into topics in the menu on the left.</>
      }
      hasContent={topics.length > 0}
      agentRunningMessage="A research agent is running in the chat panel below. Select an item from the sidebar to open it, or continue the conversation with the agent."
      hasAgent={!!agentId}
      promptLabel="Research prompt"
      promptPlaceholder="e.g. Solid-state battery commercialization timeline 2024–2026"
      promptAriaLabel="Research query"
      submitLabel="Start research"
      submitAriaLabel="Start research agent"
      buttonVariant="indigo"
      onSubmit={handleStartResearch}
    />
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {saveModal && (
        <SaveAsModal
          title={saveModal.mode === "create" ? "Save Research Item" : "Save As"}
          containerField={{
            label: "Topic",
            placeholder: "solid-state-batteries",
            initialValue: saveModal.presetTopicName || selected?.topicName || "",
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: topics.map(topic => ({ value: topic.name })),
          }}
          itemField={{
            label: "Item name",
            placeholder: "summary",
            initialValue: saveModal.mode === "saveAs" && selected ? `${selected.name}-copy` : "",
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: [],
            autoFocus: true,
            selectOnFocus: true,
          }}
          onSave={handleSaveModalSubmit}
          onClose={() => setSaveModal(null)}
        />
      )}
      {newTopicModalOpen && (
        <CreateItemModal
          title="New Topic"
          placeholder="solid-state-batteries"
          pattern={NAME_PATTERN}
          validationError="Use letters, numbers, hyphens, and underscores only, starting with a letter or number."
          onCreate={handleCreateTopic}
          onClose={() => setNewTopicModalOpen(false)}
        />
      )}
      {deleteItemTarget && (
        <ConfirmModal
          title="Delete item?"
          message={`This will permanently delete "${deleteItemTarget.name}" from topic "${deleteItemTarget.topicName}".`}
          onConfirm={() => handleDeleteItem(deleteItemTarget.topicName, deleteItemTarget.name)}
          onClose={() => setDeleteItemTarget(null)}
        />
      )}
      {deleteTopicTarget && (
        <ConfirmModal
          title="Delete topic?"
          message={`This will permanently delete the topic "${deleteTopicTarget}" and all of its items.`}
          onConfirm={() => handleDeleteTopic(deleteTopicTarget)}
          onClose={() => setDeleteTopicTarget(null)}
        />
      )}
      {pendingAction && (
        <PendingDialog
          title="Discard unsaved changes?"
          message="You have unsaved edits. Leave this item and lose those changes?"
          confirmLabel="Discard"
          onConfirm={runPendingAction}
        />
      )}
      <TerminateDialog />

      <AppPageHeader title="Research" subtitle={subtitle} icon={<Search className="w-4 h-4" />} iconGradient="from-indigo-500 to-violet-600" size="compact">
        {isDocumentReady && (
          <>
            <ViewModeToggle
              aria-label="View mode"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: "preview", label: "Preview", title: "Preview markdown", icon: Eye },
                { value: "edit", label: "Edit", title: "Edit markdown source", icon: Pencil },
              ]}
            />

            <EditorSaveBar
              isDirty={isDirty}
              isSaving={isSaving}
              hasItem={!!selected}
              onSave={handleSave}
              onSaveAs={selected ? () => setSaveModal({ mode: "saveAs", presetTopicName: selected.topicName }) : undefined}
              variant="accent"
              actions={
                selected ? (
                  <button
                    type="button"
                    onClick={() => setDeleteItemTarget(selected)}
                    className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors focus-ring cursor-pointer"
                    title="Delete item"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                ) : undefined
              }
            />

            <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
          </>
        )}

        <button
          type="button"
          onClick={() => handleNew()}
          title="New research item"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted hover:bg-accent-muted-hover text-accent text-xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" />
          New
        </button>

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        <AgentSessionBar
          agentTypes={allowedAgentTypes}
          currentAgent={agent}
          busy={isCreatingAgent}
          buttonClassName="bg-indigo-600 hover:bg-indigo-500 text-white shadow-button-primary"
          onCreate={agentType => void createAgent(agentType)}
          onTerminate={() => void terminateAgent()}
        />
      </AppPageHeader>

      <WorkspaceShell
        appId="research"
        title="Research"
        navigationLabel="Research topics"
        hasSelection={selected !== null}
        className="flex-1"
        navigation={
          <TopicsSidebar
            topics={topics}
            topicsLoading={topicsLoading}
            topicsError={topicsError}
            onRetryTopics={() => void refreshTopics()}
            expandedTopics={expandedTopics}
            onToggleTopic={handleToggleTopic}
            selected={selected}
            refreshSignal={itemsRefreshSignal}
            onSelectItem={handleSelectItem}
            onNewItem={topicName => handleNew(topicName)}
            onDeleteItem={(topicName, name) => setDeleteItemTarget({ topicName, name })}
            onDeleteTopic={name => setDeleteTopicTarget(name)}
            onNewTopic={() => setNewTopicModalOpen(true)}
            onNewItemGlobal={() => handleNew()}
            onItemsChange={handleItemsChange}
            agents={agents}
            agentsLoading={agentsLoading}
            selectedAgentId={agentId}
            onSelectAgent={selectAgent}
            onCreateAgent={() => void createAgent()}
            onTerminateAgent={id => void terminateAgent(id)}
          />
        }
      >
        <ChatDock agentId={agentId} storageKey="research" initialRatio={0.65} headerTitle={agent?.displayName ?? "Research Agent"}>
          {mainPane}
        </ChatDock>
      </WorkspaceShell>
    </div>
  );
}
