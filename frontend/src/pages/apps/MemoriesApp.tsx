import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { formatBytes } from "@tokenring-ai/utility/number/formatBytes";
import { Brain, ChevronDown, ChevronRight, Eye, FileText, FolderOpen, Loader2, Pencil, Plus, Search, Trash2, X } from "lucide-react";
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
import { useDebounce } from "../../hooks/useDebounce.ts";
import { usePendingAction } from "../../hooks/usePendingAction.tsx";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { useRemoteChangeDetection } from "../../hooks/useRemoteChangeDetection.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import type { RunningAgent } from "../../lib/agentSessions.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, memoryRPCClient, useMemories, useMemoryCategories, useMemoryConfiguration } from "../../rpc.ts";

const DEFAULT_MARKDOWN = `# Memory

Write the thing worth remembering here, or launch an agent below to curate memories for you.
`;

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;

const MEMORIES_ROOT = "/memories";
const memoryPath = (category: string, memoryName: string) => `${MEMORIES_ROOT}/${encodeURIComponent(category)}/${encodeURIComponent(memoryName)}`;

// ─── Types ─────────────────────────────────────────────────────────────────────

interface CategorySummary {
  name: string;
  memoryCount: number;
  updatedAt: string;
}

interface MemorySummary {
  category: string;
  name: string;
  size: number;
  updatedAt: string;
}

interface MemorySearchMatch extends MemorySummary {
  score: number;
  matchType: "name" | "content" | "both";
  lineMatches: Array<{ line: number; content: string }>;
}

interface SelectedMemory {
  category: string;
  name: string;
}

type PendingAction = { type: "select"; category: string; name: string } | { type: "new"; presetCategory: string };

// ─── CategoryRow ───────────────────────────────────────────────────────────────

function CategoryRow({
  category,
  expanded,
  onToggle,
  selected,
  refreshSignal,
  onSelectMemory,
  onNewMemory,
  onDeleteMemory,
  onDeleteCategory,
  onMemoriesChange,
}: {
  category: CategorySummary;
  expanded: boolean;
  onToggle: () => void;
  selected: SelectedMemory | null;
  refreshSignal: number;
  onSelectMemory: (category: string, name: string) => void;
  onNewMemory: (category: string) => void;
  onDeleteMemory: (category: string, name: string) => void;
  onDeleteCategory: (category: string) => void;
  onMemoriesChange?: ((category: string, memories: MemorySummary[]) => void) | undefined;
}) {
  // Live stream so agent-written memories appear without manual refresh
  const { data: memoriesData, isLoading: loadingMemories, error: memoriesError, mutate: refreshMemories } = useMemories(expanded ? category.name : null);
  const memories = memoriesData?.memories ?? null;

  useEffect(() => {
    if (!expanded || refreshSignal === 0) return;
    void refreshMemories();
  }, [expanded, refreshSignal, refreshMemories]);

  useEffect(() => {
    if (memoriesError) toastManager.error(formatError(memoriesError), { duration: 4000 });
  }, [memoriesError]);

  useEffect(() => {
    if (memories) onMemoriesChange?.(category.name, memories);
  }, [memories, category.name, onMemoriesChange]);

  return (
    <div className="border-b border-primary/50">
      <ListItemWithActions
        id={`category:${category.name}`}
        onPrimary={onToggle}
        className="gap-1.5 px-2 py-2 rounded-none"
        action={
          <>
            <button
              type="button"
              onClick={() => onNewMemory(category.name)}
              title="New memory in this category"
              className="p-0.5 text-muted hover:text-primary rounded transition-opacity cursor-pointer"
            >
              <Plus className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => onDeleteCategory(category.name)}
              title="Delete category"
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
          <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={category.name}>
            {category.name}
          </span>
          <span className="text-xs text-muted shrink-0">{category.memoryCount}</span>
        </span>
      </ListItemWithActions>

      {expanded && (
        <div className="pl-5">
          {loadingMemories && memories === null ? (
            <div className="px-2 py-2 text-xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : memoriesError && memories === null ? (
            <div className="px-2 py-2 space-y-1.5">
              <p className="text-xs text-red-500">Failed to load memories</p>
              <button type="button" onClick={() => void refreshMemories()} className="text-xs text-accent hover:underline cursor-pointer focus-ring rounded">
                Retry
              </button>
            </div>
          ) : memories && memories.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted">No memories yet</p>
          ) : (
            memories?.map(memory => {
              const isSelected = !!(selected && selected.category === category.name && selected.name === memory.name);
              return (
                <ListItemWithActions
                  key={memory.name}
                  id={`memory:${category.name}/${memory.name}`}
                  selected={isSelected}
                  onPrimary={() => onSelectMemory(category.name, memory.name)}
                  className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
                  action={
                    <>
                      <span className="text-xs text-muted shrink-0 tabular-nums">{formatBytes(memory.size)}</span>
                      <button
                        type="button"
                        onClick={() => onDeleteMemory(category.name, memory.name)}
                        title="Delete memory"
                        className="p-0.5 text-muted hover:text-red-500 rounded transition-opacity cursor-pointer"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </>
                  }
                >
                  <span className="flex items-center gap-1.5 min-w-0">
                    <FileText className="w-3 h-3 shrink-0 opacity-70" />
                    <span className="flex-1 min-w-0 truncate text-xs" title={memory.name}>
                      {memory.name}
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

// ─── Search results ────────────────────────────────────────────────────────────

function SearchResults({
  matches,
  isSearching,
  selected,
  onSelectMemory,
}: {
  matches: MemorySearchMatch[] | null;
  isSearching: boolean;
  selected: SelectedMemory | null;
  onSelectMemory: (category: string, name: string) => void;
}) {
  if (isSearching && matches === null) {
    return (
      <div className="px-3 py-6 text-center text-xs text-muted flex flex-col items-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin" />
        Searching…
      </div>
    );
  }

  if (!matches || matches.length === 0) {
    return (
      <div className="px-3 py-6 text-center">
        <Search className="w-6 h-6 text-muted mx-auto mb-2" />
        <p className="text-xs text-muted">No memories matched</p>
      </div>
    );
  }

  return (
    <>
      {matches.map(match => {
        const isSelected = !!(selected && selected.category === match.category && selected.name === match.name);
        return (
          <div key={`${match.category}/${match.name}`} className="border-b border-primary/50">
            <ListItemWithActions
              id={`match:${match.category}/${match.name}`}
              selected={isSelected}
              onPrimary={() => onSelectMemory(match.category, match.name)}
              className={`gap-1.5 px-2 py-1.5 rounded-none ${isSelected ? "bg-accent-muted text-accent" : "text-primary"}`}
            >
              <span className="flex items-center gap-1.5 min-w-0">
                <FileText className="w-3 h-3 shrink-0 opacity-70" />
                <span className="flex-1 min-w-0 truncate text-xs" title={`${match.category}/${match.name}`}>
                  <span className="text-muted">{match.category}/</span>
                  {match.name}
                </span>
              </span>
            </ListItemWithActions>
            {match.lineMatches.length > 0 && (
              <div className="pl-7 pr-2 pb-1.5 space-y-0.5">
                {match.lineMatches.slice(0, 3).map(lineMatch => (
                  <p key={lineMatch.line} className="text-xs text-muted truncate" title={lineMatch.content}>
                    {lineMatch.content.trim()}
                  </p>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
}

// ─── Markdown preview ──────────────────────────────────────────────────────────

function MemoryPreview({ content }: { content: string }) {
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

function CategoriesSidebar({
  categories,
  categoriesLoading,
  categoriesError,
  onRetryCategories,
  expandedCategories,
  onToggleCategory,
  selected,
  refreshSignal,
  onSelectMemory,
  onNewMemory,
  onDeleteMemory,
  onDeleteCategory,
  onNewCategory,
  onNewMemoryGlobal,
  onMemoriesChange,
  searchQuery,
  onSearchQueryChange,
  searchMatches,
  isSearching,
  agents,
  agentsLoading,
  selectedAgentId,
  onSelectAgent,
  onCreateAgent,
  onTerminateAgent,
}: {
  categories: CategorySummary[];
  categoriesLoading: boolean;
  categoriesError: unknown;
  onRetryCategories: () => void;
  expandedCategories: Set<string>;
  onToggleCategory: (name: string) => void;
  selected: SelectedMemory | null;
  refreshSignal: number;
  onSelectMemory: (category: string, name: string) => void;
  onNewMemory: (category: string) => void;
  onDeleteMemory: (category: string, name: string) => void;
  onDeleteCategory: (category: string) => void;
  onNewCategory: () => void;
  onNewMemoryGlobal: () => void;
  onMemoriesChange?: (category: string, memories: MemorySummary[]) => void;
  searchQuery: string;
  onSearchQueryChange: (query: string) => void;
  searchMatches: MemorySearchMatch[] | null;
  isSearching: boolean;
  agents: RunningAgent[];
  agentsLoading: boolean;
  selectedAgentId: string | null;
  onSelectAgent: (agentId: string) => void;
  onCreateAgent: () => void;
  onTerminateAgent: (agentId: string) => void;
}) {
  const isSearchActive = searchQuery.trim().length > 0;

  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <NavigationSidebarHeader
        title="Categories"
        actions={[
          {
            icon: <FileText className="w-3.5 h-3.5" />,
            label: "New memory",
            title: "New memory",
            onClick: onNewMemoryGlobal,
          },
          {
            icon: <Plus className="w-3.5 h-3.5" />,
            label: "New category",
            title: "New category",
            onClick: onNewCategory,
          },
        ]}
      />

      <AgentSessionList
        agents={agents}
        selectedAgentId={selectedAgentId}
        isLoading={agentsLoading}
        storageKey="memories"
        label="Memory agents"
        onSelect={onSelectAgent}
        onCreate={onCreateAgent}
        onTerminate={onTerminateAgent}
      />

      <div className="shrink-0 px-2 py-2 border-b border-primary">
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-muted pointer-events-none" />
          <input
            type="search"
            value={searchQuery}
            onChange={e => onSearchQueryChange(e.target.value)}
            placeholder="Search memories…"
            aria-label="Search memories"
            className="w-full pl-7 pr-7 py-1 bg-primary border border-primary rounded text-xs text-primary placeholder:text-muted focus-ring"
          />
          {isSearchActive && (
            <button
              type="button"
              onClick={() => onSearchQueryChange("")}
              title="Clear search"
              className="absolute right-1.5 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-primary rounded cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span className="sr-only">Clear search</span>
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {isSearchActive ? (
          <SearchResults matches={searchMatches} isSearching={isSearching} selected={selected} onSelectMemory={onSelectMemory} />
        ) : categoriesLoading && categories.length === 0 ? (
          <div className="px-3 py-6 text-center text-xs text-muted flex flex-col items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading categories…
          </div>
        ) : categoriesError && categories.length === 0 ? (
          <div className="px-3 py-6 text-center space-y-2">
            <p className="text-xs text-red-500">Failed to load categories</p>
            <button type="button" onClick={onRetryCategories} className="text-xs text-accent hover:underline cursor-pointer focus-ring rounded">
              Retry
            </button>
          </div>
        ) : categories.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <Brain className="w-6 h-6 text-muted mx-auto mb-2" />
            <p className="text-xs text-muted">No memories yet</p>
            <p className="text-xs text-muted mt-1">Start a memory agent or create a category</p>
          </div>
        ) : (
          categories.map(category => (
            <CategoryRow
              key={category.name}
              category={category}
              expanded={expandedCategories.has(category.name)}
              onToggle={() => onToggleCategory(category.name)}
              selected={selected}
              refreshSignal={refreshSignal}
              onSelectMemory={onSelectMemory}
              onNewMemory={onNewMemory}
              onDeleteMemory={onDeleteMemory}
              onDeleteCategory={onDeleteCategory}
              onMemoriesChange={onMemoriesChange}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Root component ────────────────────────────────────────────────────────────

export default function MemoriesApp() {
  const navigate = useNavigate();
  const { category: routeCategory, memoryName: routeMemoryName } = useParams<{ category?: string; memoryName?: string }>();
  const [theme] = useTheme();
  const { data: categoriesData, mutate: refreshCategories, isLoading: categoriesLoading, error: categoriesError } = useMemoryCategories();
  const categories = categoriesData?.categories ?? [];
  const configuration = useMemoryConfiguration();
  const allowedAgentTypes = configuration.data?.agentTypes ?? ["memory"];

  const [markdownContent, setMarkdownContent] = useState(DEFAULT_MARKDOWN);
  const selected: SelectedMemory | null = useMemo(
    () => (routeCategory && routeMemoryName ? { category: routeCategory, name: routeMemoryName } : null),
    [routeCategory, routeMemoryName],
  );
  const selectedKey = selected ? `${selected.category}/${selected.name}` : null;
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [isDraft, setIsDraft] = useState(false);
  const [savedContent, setSavedContent] = useState(DEFAULT_MARKDOWN);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingMemory, setIsLoadingMemory] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<"preview" | "edit">("preview");
  const [saveModal, setSaveModal] = useState<{ mode: "create" | "saveAs"; presetCategory: string } | null>(null);
  const [newCategoryModalOpen, setNewCategoryModalOpen] = useState(false);
  const [deleteMemoryTarget, setDeleteMemoryTarget] = useState<SelectedMemory | null>(null);
  const [deleteCategoryTarget, setDeleteCategoryTarget] = useState<string | null>(null);

  const [memoriesRefreshSignal, setMemoriesRefreshSignal] = useState(0);
  const bumpMemoriesRefresh = useCallback(() => setMemoriesRefreshSignal(n => n + 1), []);
  // Track remote memory mtimes so agent writes can refresh the open memory
  const [memoryMetaByKey, setMemoryMetaByKey] = useState<Record<string, string>>({});
  // Bridge so load/save callbacks (defined before the hook) can update the detection baseline
  const markLoadedRef = useRef<(updatedAt: string | null) => void>(() => {});

  // Sidebar search
  const [searchQuery, setSearchQuery] = useState("");
  const debouncedSearchQuery = useDebounce(searchQuery, 300);
  const [searchMatches, setSearchMatches] = useState<MemorySearchMatch[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);

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
  } = useAppAgentSession({ appName: "Memories app", storageKey: "memories", agentTypes: allowedAgentTypes });

  // Auto-expand categories that gain memories while a memory agent runs; honor manual collapses
  const {
    expandedKeys: expandedCategories,
    toggle: handleToggleCategory,
    expand: expandCategory,
    collapse: collapseCategory,
  } = useAutoExpandTree({
    items: categories,
    getKey: (c: CategorySummary) => c.name,
    getCount: (c: CategorySummary) => c.memoryCount,
    agentId,
    respectUserCollapse: true,
  });

  const handleStartMemoryAgent = useCallback(
    async (prompt: string): Promise<boolean> => {
      // Reuse the attached agent so a second prompt continues the same conversation.
      const id = agentId ?? (await createAgent());
      if (!id) return false;
      try {
        const sendResult = await agentRPCClient.sendInput({
          agentId: id,
          input: {
            from: "Memories app",
            message: `/memorize ${prompt}`,
          },
        });
        if (sendResult.status === "agentNotFound") {
          toastManager.error("Memory agent is no longer available", { duration: 5000 });
          return false;
        }
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

  // Run the debounced sidebar search
  useEffect(() => {
    const query = debouncedSearchQuery.trim();
    if (query.length === 0) {
      setSearchMatches(null);
      setIsSearching(false);
      return;
    }

    let cancelled = false;
    setIsSearching(true);
    memoryRPCClient
      .searchMemories({ query })
      .then(({ matches }) => {
        if (!cancelled) setSearchMatches(matches);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toastManager.error(formatError(e), { duration: 4000 });
        setSearchMatches([]);
      })
      .finally(() => {
        if (!cancelled) setIsSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedSearchQuery]);

  const handleMemoriesChange = useCallback((category: string, memories: MemorySummary[]) => {
    setMemoryMetaByKey(prev => {
      let changed = false;
      const next = { ...prev };
      for (const memory of memories) {
        const key = `${category}/${memory.name}`;
        if (next[key] !== memory.updatedAt) {
          next[key] = memory.updatedAt;
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
    void navigate(MEMORIES_ROOT);
  }, [navigate]);

  const openCreateModal = useCallback(
    (presetCategory = "") => {
      closeDocument();
      setSaveModal({ mode: "create", presetCategory });
    },
    [closeDocument],
  );

  const handleNew = useCallback(
    (presetCategory = "") => {
      if (queueAction({ type: "new", presetCategory })) return;
      openCreateModal(presetCategory);
    },
    [queueAction, openCreateModal],
  );

  const handleSelectMemory = useCallback(
    (category: string, name: string) => {
      const nextKey = `${category}/${name}`;
      if (selectedKey !== nextKey && queueAction({ type: "select", category, name })) return;
      void navigate(memoryPath(category, name));
    },
    [queueAction, selectedKey, navigate],
  );

  const runPendingAction = useCallback(
    (action: PendingAction) => {
      if (action.type === "select") {
        void navigate(memoryPath(action.category, action.name));
        return;
      }
      openCreateModal(action.presetCategory);
    },
    [navigate, openCreateModal],
  );

  // Keep the agent's current memory in sync so addSelectedMemory can attach it to chat input.
  useEffect(() => {
    if (!agentId || !routeCategory || !routeMemoryName) return;
    toastOnReject(
      memoryRPCClient.updateMemoryState({
        agentId,
        selectedCategory: routeCategory,
        selectedMemoryName: routeMemoryName,
      }),
    );
  }, [agentId, routeCategory, routeMemoryName]);

  const loadMemory = useCallback(async (category: string, name: string, options?: { silent?: boolean }) => {
    const key = `${category}/${name}`;
    if (!options?.silent) {
      setIsLoadingMemory(true);
      setLoadError(null);
    }
    try {
      const { memory } = await memoryRPCClient.getMemory({ category, name });
      // Drop stale responses if the user navigated away or started editing mid-flight
      if (selectedKeyRef.current !== key) return false;
      if (options?.silent && isDirtyRef.current) return false;
      if (!memory) {
        const message = `Memory "${name}" not found in category "${category}"`;
        if (!options?.silent) {
          toastManager.error(message, { duration: 4000 });
          setLoadError(message);
        }
        return false;
      }
      setMarkdownContent(memory.content);
      setSavedContent(memory.content);
      setLoadedKey(key);
      setIsDraft(false);
      setLoadError(null);
      markLoadedRef.current(memory.updatedAt);
      setMemoryMetaByKey(prev => ({ ...prev, [key]: memory.updatedAt }));
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
      if (!options?.silent) setIsLoadingMemory(false);
    }
  }, []);

  useEffect(() => {
    if (!routeCategory || !routeMemoryName) return;
    const key = `${routeCategory}/${routeMemoryName}`;
    if (key === loadedKey) return;
    void loadMemory(routeCategory, routeMemoryName);
  }, [routeCategory, routeMemoryName, loadedKey, loadMemory]);

  useEffect(() => {
    if (!routeCategory) return;
    expandCategory(routeCategory);
  }, [routeCategory, expandCategory]);

  // When an agent rewrites the open memory, refresh the editor if the user has no local edits.
  // Relies on CategoryRow's streamMemories → onMemoriesChange while the category is expanded.
  const { markLoaded } = useRemoteChangeDetection({
    documentKey: selectedKey,
    isDocumentReady,
    isDirty,
    strategy: {
      type: "streaming",
      remoteMeta: selectedKey ? (memoryMetaByKey[selectedKey] ?? null) : null,
      getUpdatedAt: (meta: string) => meta,
    },
    onRemoteChange: () => {
      if (!selected) return;
      void loadMemory(selected.category, selected.name, { silent: true });
    },
  });
  markLoadedRef.current = markLoaded;

  useEffect(() => {
    if (categoriesError) toastManager.error(formatError(categoriesError), { duration: 4000 });
  }, [categoriesError]);

  const handleSave = useCallback(async () => {
    // Allow opening the create modal even when no document is loaded yet
    if (!selected) {
      setSaveModal({ mode: "create", presetCategory: "" });
      return;
    }
    if (!isDocumentReady) return;
    setIsSaving(true);
    try {
      const { memory } = await memoryRPCClient.updateMemory({
        category: selected.category,
        name: selected.name,
        content: markdownContentRef.current,
      });
      setSavedContent(memory.content);
      markLoadedRef.current(memory.updatedAt);
      setMemoryMetaByKey(prev => ({ ...prev, [`${memory.category}/${memory.name}`]: memory.updatedAt }));
      bumpMemoriesRefresh();
      void refreshCategories();
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [isDocumentReady, selected, bumpMemoriesRefresh, refreshCategories]);

  const handleSaveModalSubmit = useCallback(
    async (category: string, memoryName: string) => {
      try {
        // createMemory auto-vivifies the category directory
        const { memory } = await memoryRPCClient.createMemory({
          category,
          name: memoryName,
          content: markdownContentRef.current,
        });
        setSavedContent(memory.content);
        setMarkdownContent(memory.content);
        setLoadedKey(`${memory.category}/${memory.name}`);
        setIsDraft(false);
        markLoadedRef.current(memory.updatedAt);
        setMemoryMetaByKey(prev => ({ ...prev, [`${memory.category}/${memory.name}`]: memory.updatedAt }));
        setSaveModal(null);
        setViewMode("edit");
        expandCategory(category);
        void navigate(memoryPath(memory.category, memory.name));
        bumpMemoriesRefresh();
        void refreshCategories();
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [navigate, bumpMemoriesRefresh, refreshCategories, expandCategory],
  );

  const handleDeleteMemory = useCallback(
    async (category: string, name: string) => {
      try {
        await memoryRPCClient.deleteMemory({ category, name });
        if (selected && selected.category === category && selected.name === name) {
          closeDocument();
        }
        setDeleteMemoryTarget(null);
        bumpMemoriesRefresh();
        void refreshCategories();
        toastManager.success("Deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, bumpMemoriesRefresh, refreshCategories],
  );

  const handleCreateCategory = useCallback(
    async (name: string) => {
      try {
        await memoryRPCClient.createCategory({ name });
        setNewCategoryModalOpen(false);
        void refreshCategories();
        toastManager.success("Category created", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [refreshCategories],
  );

  const handleDeleteCategory = useCallback(
    async (category: string) => {
      try {
        await memoryRPCClient.deleteCategory({ name: category });
        if (selected?.category === category) {
          closeDocument();
        }
        collapseCategory(category);
        setDeleteCategoryTarget(null);
        void refreshCategories();
        toastManager.success("Category deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, refreshCategories, collapseCategory],
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

  const subtitle = selected ? `${selected.category} / ${selected.name}` : isDraft ? "Untitled" : "No memory open";

  const mainPane = isDocumentReady ? (
    viewMode === "preview" ? (
      <MemoryPreview content={markdownContent} />
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
          onClick={() => void loadMemory(selected.category, selected.name)}
          className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
        >
          Retry
        </button>
        <button
          type="button"
          onClick={closeDocument}
          className="px-3 py-1.5 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
        >
          Back to memories
        </button>
      </div>
    </div>
  ) : selected || isLoadingMemory ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading {selected ? `${selected.category} / ${selected.name}` : "…"}…
    </div>
  ) : categoriesLoading && categories.length === 0 ? (
    <div className="h-full flex items-center justify-center gap-2 bg-primary text-xs text-muted">
      <Loader2 className="w-4 h-4 animate-spin" />
      Loading memory categories…
    </div>
  ) : categoriesError && categories.length === 0 ? (
    <div className="h-full flex flex-col items-center justify-center gap-3 p-6 bg-primary text-center">
      <p className="text-xs text-red-500 max-w-md">Failed to load memory categories</p>
      <button
        type="button"
        onClick={() => void refreshCategories()}
        className="px-3 py-1.5 bg-accent hover:bg-accent-hover text-white text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
      >
        Retry
      </button>
    </div>
  ) : (
    <EmptyStateWithPrompt
      icon={Brain}
      iconGradient="from-teal-500 to-emerald-600"
      title="Remember what matters"
      descriptionWithContent={
        <>
          Open a memory from the <span className="font-medium text-secondary">Categories</span> menu on the left to read or edit it, or describe something worth
          remembering below and a memory agent will file it for you.
        </>
      }
      descriptionEmpty={
        <>
          Describe a fact, preference, decision, or constraint worth remembering. A memory agent will file it as markdown under a category, where every agent
          can find it later.
        </>
      }
      hasContent={categories.length > 0}
      agentRunningMessage="A memory agent is running in the chat panel below. Memories it writes appear in the Categories sidebar — select one to open it."
      hasAgent={!!agentId}
      promptLabel="Memory prompt"
      promptPlaceholder="e.g. The user prefers 2-space indent and no semicolons"
      promptAriaLabel="Thing to remember"
      submitLabel="Remember this"
      submitAriaLabel="Start memory agent"
      buttonVariant="emerald"
      onSubmit={handleStartMemoryAgent}
    />
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {saveModal && (
        <SaveAsModal
          title={saveModal.mode === "create" ? "Save Memory" : "Save As"}
          containerField={{
            label: "Category",
            placeholder: "coding",
            initialValue: saveModal.presetCategory || selected?.category || "",
            pattern: NAME_PATTERN,
            validationError: "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.",
            options: categories.map(category => ({ value: category.name })),
          }}
          itemField={{
            label: "Memory name",
            placeholder: "style-preferences",
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
      {newCategoryModalOpen && (
        <CreateItemModal
          title="New Category"
          placeholder="coding"
          pattern={NAME_PATTERN}
          validationError="Use letters, numbers, hyphens, and underscores only, starting with a letter or number."
          onCreate={handleCreateCategory}
          onClose={() => setNewCategoryModalOpen(false)}
        />
      )}
      {deleteMemoryTarget && (
        <ConfirmModal
          title="Delete memory?"
          message={`This will permanently delete "${deleteMemoryTarget.name}" from category "${deleteMemoryTarget.category}".`}
          onConfirm={() => handleDeleteMemory(deleteMemoryTarget.category, deleteMemoryTarget.name)}
          onClose={() => setDeleteMemoryTarget(null)}
        />
      )}
      {deleteCategoryTarget && (
        <ConfirmModal
          title="Delete category?"
          message={`This will permanently delete the category "${deleteCategoryTarget}" and all of its memories.`}
          onConfirm={() => handleDeleteCategory(deleteCategoryTarget)}
          onClose={() => setDeleteCategoryTarget(null)}
        />
      )}
      {pendingAction && (
        <PendingDialog
          title="Discard unsaved changes?"
          message="You have unsaved edits. Leave this memory and lose those changes?"
          confirmLabel="Discard"
          onConfirm={runPendingAction}
        />
      )}
      <TerminateDialog />

      <AppPageHeader title="Memories" subtitle={subtitle} icon={<Brain className="w-4 h-4" />} iconGradient="from-teal-500 to-emerald-600" size="compact">
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
              onSaveAs={selected ? () => setSaveModal({ mode: "saveAs", presetCategory: selected.category }) : undefined}
              variant="accent"
              actions={
                selected ? (
                  <button
                    type="button"
                    onClick={() => setDeleteMemoryTarget(selected)}
                    className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors focus-ring cursor-pointer"
                    title="Delete memory"
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
          title="New memory"
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
          buttonClassName="bg-teal-600 hover:bg-teal-500 text-white shadow-button-primary"
          onCreate={agentType => void createAgent(agentType)}
          onTerminate={() => void terminateAgent()}
        />
      </AppPageHeader>

      <WorkspaceShell
        appId="memories"
        title="Memories"
        navigationLabel="Memory categories"
        hasSelection={selected !== null}
        className="flex-1"
        navigation={
          <CategoriesSidebar
            categories={categories}
            categoriesLoading={categoriesLoading}
            categoriesError={categoriesError}
            onRetryCategories={() => void refreshCategories()}
            expandedCategories={expandedCategories}
            onToggleCategory={handleToggleCategory}
            selected={selected}
            refreshSignal={memoriesRefreshSignal}
            onSelectMemory={handleSelectMemory}
            onNewMemory={category => handleNew(category)}
            onDeleteMemory={(category, name) => setDeleteMemoryTarget({ category, name })}
            onDeleteCategory={name => setDeleteCategoryTarget(name)}
            onNewCategory={() => setNewCategoryModalOpen(true)}
            onNewMemoryGlobal={() => handleNew()}
            onMemoriesChange={handleMemoriesChange}
            searchQuery={searchQuery}
            onSearchQueryChange={setSearchQuery}
            searchMatches={searchMatches}
            isSearching={isSearching}
            agents={agents}
            agentsLoading={agentsLoading}
            selectedAgentId={agentId}
            onSelectAgent={selectAgent}
            onCreateAgent={() => void createAgent()}
            onTerminateAgent={id => void terminateAgent(id)}
          />
        }
      >
        <ChatDock agentId={agentId} storageKey="memories" initialRatio={0.65} headerTitle={agent?.displayName ?? "Memory Agent"}>
          {mainPane}
        </ChatDock>
      </WorkspaceShell>
    </div>
  );
}
