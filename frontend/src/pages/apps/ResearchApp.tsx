import Editor from "@monaco-editor/react";
import formatError from "@tokenring-ai/utility/error/formatError";
import { BookOpen, ChevronDown, ChevronRight, Eye, FileText, FolderOpen, Loader2, Pencil, Plus, Save, Search, Send, Trash2, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { useNavigate, useParams } from "react-router-dom";
import remarkGfm from "remark-gfm";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import { markdownLinkComponents } from "../../components/chat/MarkdownLink.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useOwnedAgent } from "../../hooks/useOwnedAgent.ts";
import { useTheme } from "../../hooks/useTheme.ts";
import { agentRPCClient, researchRPCClient, useItems, useTopics } from "../../rpc.ts";

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

// ─── SaveModal ─────────────────────────────────────────────────────────────────

function SaveModal({
  title,
  initialTopicName,
  initialItemName,
  topics,
  onSave,
  onClose,
}: {
  title: string;
  initialTopicName: string;
  initialItemName: string;
  topics: TopicSummary[];
  onSave: (topicName: string, itemName: string) => Promise<void>;
  onClose: () => void;
}) {
  const [topicValue, setTopicValue] = useState(initialTopicName);
  const [itemValue, setItemValue] = useState(initialItemName);
  const [saving, setSaving] = useState(false);
  const itemInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    itemInputRef.current?.focus();
    itemInputRef.current?.select();
  }, []);

  const trimmedTopic = topicValue.trim();
  const trimmedItem = itemValue.trim();
  const isValid = NAME_PATTERN.test(trimmedTopic) && NAME_PATTERN.test(trimmedItem);

  const handleSubmit = async () => {
    if (!isValid || saving) return;
    setSaving(true);
    try {
      await onSave(trimmedTopic, trimmedItem);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-96 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">{title}</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Topic</label>
            <input
              type="text"
              list="research-topic-options"
              value={topicValue}
              onChange={e => setTopicValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Escape") onClose();
              }}
              placeholder="solid-state-batteries"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
            <datalist id="research-topic-options">
              {topics.map(topic => (
                <option key={topic.name} value={topic.name} />
              ))}
            </datalist>
            {trimmedTopic && !NAME_PATTERN.test(trimmedTopic) && (
              <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
            )}
          </div>
          <div className="space-y-1">
            <label className="text-2xs font-semibold text-muted uppercase tracking-wide">Item name</label>
            <input
              ref={itemInputRef}
              type="text"
              value={itemValue}
              onChange={e => setItemValue(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !saving) void handleSubmit();
                if (e.key === "Escape") onClose();
              }}
              placeholder="summary"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
            />
            {trimmedItem && !NAME_PATTERN.test(trimmedItem) && (
              <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
            )}
          </div>
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || saving}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Save
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── NewTopicModal ─────────────────────────────────────────────────────────────

function NewTopicModal({ onCreate, onClose }: { onCreate: (name: string) => Promise<void>; onClose: () => void }) {
  const [nameValue, setNameValue] = useState("");
  const [creating, setCreating] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const trimmed = nameValue.trim();
  const isValid = NAME_PATTERN.test(trimmed);

  const handleSubmit = async () => {
    if (!isValid || creating) return;
    setCreating(true);
    try {
      await onCreate(trimmed);
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="bg-secondary border border-primary rounded-xl p-5 w-80 shadow-xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-primary">New Topic</h2>
          <button type="button" onClick={onClose} className="p-1 text-muted hover:text-primary focus-ring rounded">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="space-y-3">
          <input
            ref={inputRef}
            type="text"
            value={nameValue}
            onChange={e => setNameValue(e.target.value)}
            onKeyDown={e => {
              if (e.key === "Enter" && !creating) void handleSubmit();
              if (e.key === "Escape") onClose();
            }}
            placeholder="solid-state-batteries"
            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-xs text-primary placeholder-muted focus-accent"
          />
          {trimmed && !isValid && (
            <p className="text-2xs text-red-500">Use letters, numbers, hyphens, and underscores only, starting with a letter or number.</p>
          )}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!isValid || creating}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Create
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── ConfirmModal ──────────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  message,
  confirmLabel = "Delete",
  variant = "danger",
  onConfirm,
  onClose,
}: {
  title: string;
  message: string;
  confirmLabel?: string;
  variant?: "danger" | "warning";
  onConfirm: () => void | Promise<void>;
  onClose: () => void;
}) {
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = async () => {
    setConfirming(true);
    try {
      await onConfirm();
    } finally {
      setConfirming(false);
    }
  };

  const confirmClasses = variant === "warning" ? "bg-amber-600 hover:bg-amber-500 text-white" : "bg-red-600 hover:bg-red-500 text-white";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div
        className="bg-secondary border border-primary rounded-xl p-5 w-80 shadow-xl"
        role="dialog"
        aria-modal="true"
        aria-labelledby="research-confirm-title"
      >
        <h2 id="research-confirm-title" className="text-sm font-semibold text-primary mb-2">
          {title}
        </h2>
        <p className="text-xs text-muted mb-4">{message}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => void handleConfirm()}
            disabled={confirming}
            className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed ${confirmClasses}`}
          >
            {confirming ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : variant === "danger" ? <Trash2 className="w-3.5 h-3.5" /> : null}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
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
      <div className="group flex items-center gap-1.5 px-2 py-2 cursor-pointer hover:bg-hover transition-colors" onClick={onToggle}>
        {expanded ? <ChevronDown className="w-3.5 h-3.5 shrink-0 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 shrink-0 text-muted" />}
        <FolderOpen className="w-3.5 h-3.5 shrink-0 opacity-70" />
        <span className="flex-1 min-w-0 truncate text-xs font-medium text-primary" title={topic.name}>
          {topic.name}
        </span>
        <span className="text-2xs text-muted shrink-0">{topic.itemCount}</span>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onNewItem(topic.name);
          }}
          title="New item in this topic"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-primary rounded transition-opacity shrink-0 cursor-pointer"
        >
          <Plus className="w-3 h-3" />
        </button>
        <button
          type="button"
          onClick={e => {
            e.stopPropagation();
            onDeleteTopic(topic.name);
          }}
          title="Delete topic"
          className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-500 rounded transition-opacity shrink-0 cursor-pointer"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>

      {expanded && (
        <div className="pl-5">
          {loadingItems && items === null ? (
            <div className="px-2 py-2 text-2xs text-muted flex items-center gap-1.5">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading…
            </div>
          ) : itemsError && items === null ? (
            <div className="px-2 py-2 space-y-1.5">
              <p className="text-2xs text-red-500">Failed to load items</p>
              <button type="button" onClick={() => void refreshItems()} className="text-2xs text-accent hover:underline cursor-pointer focus-ring rounded">
                Retry
              </button>
            </div>
          ) : items && items.length === 0 ? (
            <p className="px-2 py-2 text-2xs text-muted">No items yet</p>
          ) : (
            items?.map(item => {
              const isSelected = selected && selected.topicName === topic.name && selected.name === item.name;
              return (
                <div
                  key={item.name}
                  className={`group flex items-center gap-1.5 px-2 py-1.5 cursor-pointer transition-colors ${
                    isSelected ? "bg-accent-muted text-accent" : "hover:bg-hover text-primary"
                  }`}
                  onClick={() => onSelectItem(topic.name, item.name)}
                >
                  <FileText className="w-3 h-3 shrink-0 opacity-70" />
                  <span className="flex-1 min-w-0 truncate text-xs" title={item.name}>
                    {item.name}
                  </span>
                  <span className="text-2xs text-muted shrink-0 opacity-0 group-hover:opacity-100 tabular-nums">{formatBytes(item.size)}</span>
                  <button
                    type="button"
                    onClick={e => {
                      e.stopPropagation();
                      onDeleteItem(topic.name, item.name);
                    }}
                    title="Delete item"
                    className="opacity-0 group-hover:opacity-100 p-0.5 text-muted hover:text-red-500 rounded transition-opacity shrink-0 cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}

function formatBytes(size: number): string {
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`;
  return `${(size / (1024 * 1024)).toFixed(1)} MB`;
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
}) {
  return (
    <div className="h-full flex flex-col bg-secondary border-r border-primary">
      <div className="flex items-center gap-1 px-2 py-2 border-b border-primary">
        <span className="flex-1 text-2xs font-bold text-muted uppercase tracking-widest px-1">Topics</span>
        <button
          type="button"
          onClick={onNewItemGlobal}
          title="New research item"
          className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
        >
          <FileText className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={onNewTopic}
          title="New topic"
          className="p-1 text-muted hover:text-primary rounded transition-colors cursor-pointer focus-ring"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto">
        {topicsLoading && topics.length === 0 ? (
          <div className="px-3 py-6 text-center text-2xs text-muted flex flex-col items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            Loading topics…
          </div>
        ) : topicsError && topics.length === 0 ? (
          <div className="px-3 py-6 text-center space-y-2">
            <p className="text-2xs text-red-500">Failed to load topics</p>
            <button type="button" onClick={onRetryTopics} className="text-2xs text-accent hover:underline cursor-pointer focus-ring rounded">
              Retry
            </button>
          </div>
        ) : topics.length === 0 ? (
          <div className="px-3 py-6 text-center">
            <BookOpen className="w-6 h-6 text-muted mx-auto mb-2" />
            <p className="text-2xs text-muted">No topics yet</p>
            <p className="text-2xs text-muted mt-1">Start a research agent or create a topic</p>
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

// ─── EmptyState ────────────────────────────────────────────────────────────────

function EmptyState({ hasTopics, hasAgent, onStartResearch }: { hasTopics: boolean; hasAgent: boolean; onStartResearch: (query: string) => Promise<boolean> }) {
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!hasAgent) textareaRef.current?.focus();
  }, [hasAgent]);

  const handleSubmit = async () => {
    const trimmed = query.trim();
    if (!trimmed || submitting) return;
    setSubmitting(true);
    try {
      const ok = await onStartResearch(trimmed);
      if (ok) setQuery("");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="h-full flex flex-col items-center justify-center gap-6 p-6 sm:p-8 bg-primary">
      <div className="w-full max-w-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 rounded-2xl bg-linear-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg mx-auto">
            <Search className="w-7 h-7 text-white" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-primary">Start researching</h2>
            <p className="text-sm text-muted mt-1.5 max-w-md mx-auto leading-relaxed">
              {hasTopics ? (
                <>
                  Select existing research from the <span className="font-medium text-secondary">Topics</span> menu on the left to view it, or describe a new
                  topic below to start a research agent.
                </>
              ) : (
                <>
                  Describe what you want to research below. A research agent will search the web and write markdown findings into topics in the menu on the
                  left.
                </>
              )}
            </p>
          </div>
        </div>

        {hasAgent ? (
          <div className="bg-secondary border border-primary rounded-xl px-4 py-3 text-center">
            <p className="text-xs text-muted leading-relaxed">
              A research agent is running in the chat panel below. Select an item from the sidebar to open it, or continue the conversation with the agent.
            </p>
          </div>
        ) : (
          <div className="bg-secondary border border-primary rounded-xl p-4 shadow-sm space-y-3">
            <label htmlFor="research-landing-query" className="text-2xs font-semibold text-muted uppercase tracking-wide">
              Research prompt
            </label>
            <textarea
              id="research-landing-query"
              ref={textareaRef}
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  e.preventDefault();
                  void handleSubmit();
                }
              }}
              rows={4}
              placeholder="e.g. Solid-state battery commercialization timeline 2024–2026"
              disabled={submitting}
              className="w-full bg-input border border-primary rounded-xl px-3 py-2.5 text-sm text-primary placeholder-muted focus-accent resize-y min-h-[96px] disabled:opacity-60"
              aria-label="Research query"
            />
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-2xs text-muted">⌘/Ctrl + Enter to send</p>
              <button
                type="button"
                onClick={() => void handleSubmit()}
                disabled={submitting || !query.trim()}
                className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus-ring shadow-button-primary"
                aria-label="Start research agent"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" /> Starting…
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" /> Start research
                  </>
                )}
              </button>
            </div>
          </div>
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
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);

  const [expandedTopics, setExpandedTopics] = useState<Set<string>>(new Set());
  const [itemsRefreshSignal, setItemsRefreshSignal] = useState(0);
  const bumpItemsRefresh = useCallback(() => setItemsRefreshSignal(n => n + 1), []);
  // Track remote item mtimes so agent writes can refresh the open dossier
  const [itemMetaByKey, setItemMetaByKey] = useState<Record<string, string>>({});
  const loadedUpdatedAtRef = useRef<string | null>(null);
  const selectedKeyRef = useRef<string | null>(null);
  const isDirtyRef = useRef(false);

  const { agentId, assignAgent: handleAgentLaunched } = useOwnedAgent("Research app");

  const handleStartResearch = useCallback(
    async (query: string): Promise<boolean> => {
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: "research", headless: false });
        handleAgentLaunched(id);
        await agentRPCClient.sendInput({
          agentId: id,
          input: {
            from: "Research app",
            message: `/deep research ${query}`,
          },
        });
        // Expand all topics as the agent creates them so dossiers appear live
        return true;
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
        return false;
      }
    },
    [handleAgentLaunched],
  );

  const isDocumentReady = selectedKey !== null ? loadedKey === selectedKey : isDraft;
  const isDirty = isDocumentReady && markdownContent !== savedContent;
  selectedKeyRef.current = selectedKey;
  isDirtyRef.current = isDirty;

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

  const handleToggleTopic = useCallback((name: string) => {
    setExpandedTopics(prev => {
      const next = new Set(prev);
      if (next.has(name)) {
        next.delete(name);
      } else {
        next.add(name);
      }
      return next;
    });
  }, []);

  const closeDocument = useCallback(() => {
    setMarkdownContent(DEFAULT_MARKDOWN);
    setSavedContent(DEFAULT_MARKDOWN);
    setLoadedKey(null);
    setIsDraft(false);
    setLoadError(null);
    setViewMode("preview");
    loadedUpdatedAtRef.current = null;
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
      if (isDirty) {
        setPendingAction({ type: "new", presetTopicName });
        return;
      }
      openCreateModal(presetTopicName);
    },
    [isDirty, openCreateModal],
  );

  const handleSelectItem = useCallback(
    (topicName: string, name: string) => {
      const nextKey = `${topicName}/${name}`;
      if (isDirty && selectedKey !== nextKey) {
        setPendingAction({ type: "select", topicName, name });
        return;
      }
      void navigate(itemPath(topicName, name));
    },
    [isDirty, selectedKey, navigate],
  );

  const confirmPendingAction = useCallback(() => {
    const action = pendingAction;
    setPendingAction(null);
    if (!action) return;
    if (action.type === "select") {
      void navigate(itemPath(action.topicName, action.name));
      return;
    }
    openCreateModal(action.presetTopicName);
  }, [pendingAction, navigate, openCreateModal]);

  // Keep the agent’s current item in sync so addSelectedItem can attach it to chat input.
  useEffect(() => {
    if (!agentId || !routeTopicName || !routeItemName) return;
    researchRPCClient
      .updateResearchState({
        agentId,
        selectedTopicName: routeTopicName,
        selectedItemName: routeItemName,
      })
      .catch(() => {});
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
      loadedUpdatedAtRef.current = item.updatedAt;
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

    let cancelled = false;
    setIsLoadingItem(true);
    setLoadError(null);
    researchRPCClient
      .getItem({ topicName: routeTopicName, name: routeItemName })
      .then(({ item }) => {
        if (cancelled) return;
        if (!item) {
          const message = `Item "${routeItemName}" not found in topic "${routeTopicName}"`;
          toastManager.error(message, { duration: 4000 });
          setLoadError(message);
          return;
        }
        setMarkdownContent(item.content);
        setSavedContent(item.content);
        setLoadedKey(key);
        setIsDraft(false);
        loadedUpdatedAtRef.current = item.updatedAt;
        setItemMetaByKey(prev => ({ ...prev, [key]: item.updatedAt }));
        setViewMode("preview");
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        toastManager.error(formatError(e), { duration: 4000 });
        setLoadError(formatError(e));
      })
      .finally(() => {
        if (!cancelled) setIsLoadingItem(false);
      });
    return () => {
      cancelled = true;
    };
  }, [routeTopicName, routeItemName, loadedKey]);

  useEffect(() => {
    if (!routeTopicName) return;
    setExpandedTopics(prev => (prev.has(routeTopicName) ? prev : new Set(prev).add(routeTopicName)));
  }, [routeTopicName]);

  // When the agent rewrites the open item, refresh the editor if the user has no local edits.
  // Relies on TopicRow's streamItems → onItemsChange while the topic is expanded (selected topic is auto-expanded).
  useEffect(() => {
    if (!selected || !selectedKey || loadedKey !== selectedKey) return;
    const remoteUpdatedAt = itemMetaByKey[selectedKey];
    if (!remoteUpdatedAt || remoteUpdatedAt === loadedUpdatedAtRef.current) return;
    if (isDirty) return;
    void loadItem(selected.topicName, selected.name, { silent: true });
  }, [selected, selectedKey, loadedKey, itemMetaByKey, isDirty, loadItem]);

  // Auto-expand topics that gain items while a research agent is running so dossiers stream in live
  useEffect(() => {
    if (!agentId) return;
    setExpandedTopics(prev => {
      let changed = false;
      const next = new Set(prev);
      for (const topic of topics) {
        if (topic.itemCount > 0 && !next.has(topic.name)) {
          next.add(topic.name);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [agentId, topics]);

  useEffect(() => {
    if (topicsError) toastManager.error(formatError(topicsError), { duration: 4000 });
  }, [topicsError]);

  const handleSave = useCallback(async () => {
    if (!isDocumentReady) return;
    if (!selected) {
      setSaveModal({ mode: "create", presetTopicName: "" });
      return;
    }
    setIsSaving(true);
    try {
      const { item } = await researchRPCClient.updateItem({
        topicName: selected.topicName,
        name: selected.name,
        content: markdownContent,
      });
      setSavedContent(item.content);
      loadedUpdatedAtRef.current = item.updatedAt;
      setItemMetaByKey(prev => ({ ...prev, [`${item.topicName}/${item.name}`]: item.updatedAt }));
      bumpItemsRefresh();
      void refreshTopics();
      toastManager.success("Saved", { duration: 2000 });
    } catch (e: unknown) {
      toastManager.error(formatError(e), { duration: 4000 });
    } finally {
      setIsSaving(false);
    }
  }, [isDocumentReady, selected, markdownContent, bumpItemsRefresh, refreshTopics]);

  const handleSaveModalSubmit = useCallback(
    async (topicName: string, itemName: string) => {
      try {
        // createItem for new names; updateItem when overwriting via Save As to an existing path is not supported
        // (user must pick a unique name). createItem auto-vivifies the topic directory.
        const { item } = await researchRPCClient.createItem({ topicName, name: itemName, content: markdownContent });
        setSavedContent(item.content);
        setMarkdownContent(item.content);
        setLoadedKey(`${item.topicName}/${item.name}`);
        setIsDraft(false);
        loadedUpdatedAtRef.current = item.updatedAt;
        setItemMetaByKey(prev => ({ ...prev, [`${item.topicName}/${item.name}`]: item.updatedAt }));
        setSaveModal(null);
        setViewMode("edit");
        setExpandedTopics(prev => new Set(prev).add(topicName));
        void navigate(itemPath(item.topicName, item.name));
        bumpItemsRefresh();
        void refreshTopics();
        toastManager.success("Saved", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [markdownContent, navigate, bumpItemsRefresh, refreshTopics],
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
        setExpandedTopics(prev => {
          const next = new Set(prev);
          next.delete(topicName);
          return next;
        });
        setDeleteTopicTarget(null);
        void refreshTopics();
        toastManager.success("Topic deleted", { duration: 2000 });
      } catch (e: unknown) {
        toastManager.error(formatError(e), { duration: 4000 });
      }
    },
    [selected, closeDocument, refreshTopics],
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
    <EmptyState hasTopics={topics.length > 0} hasAgent={!!agentId} onStartResearch={handleStartResearch} />
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary overflow-hidden">
      {saveModal && (
        <SaveModal
          title={saveModal.mode === "create" ? "Save Research Item" : "Save As"}
          initialTopicName={saveModal.presetTopicName || selected?.topicName || ""}
          initialItemName={saveModal.mode === "saveAs" && selected ? `${selected.name}-copy` : ""}
          topics={topics}
          onSave={handleSaveModalSubmit}
          onClose={() => setSaveModal(null)}
        />
      )}
      {newTopicModalOpen && <NewTopicModal onCreate={handleCreateTopic} onClose={() => setNewTopicModalOpen(false)} />}
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
        <ConfirmModal
          title="Discard unsaved changes?"
          message="You have unsaved edits. Leave this item and lose those changes?"
          confirmLabel="Discard"
          variant="warning"
          onConfirm={confirmPendingAction}
          onClose={() => setPendingAction(null)}
        />
      )}

      <AppPageHeader title="Research" subtitle={subtitle} icon={<Search className="w-4 h-4" />} iconGradient="from-indigo-500 to-violet-600" size="compact">
        {isDocumentReady && (
          <>
            <div className="flex items-center rounded-lg border border-primary p-0.5 shrink-0" role="group" aria-label="View mode">
              <button
                type="button"
                onClick={() => setViewMode("preview")}
                className={`flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-md transition-colors cursor-pointer focus-ring ${
                  viewMode === "preview" ? "bg-accent text-white" : "text-muted hover:text-primary hover:bg-hover"
                }`}
                aria-pressed={viewMode === "preview"}
                title="Preview markdown"
              >
                <Eye className="w-3 h-3" />
                Preview
              </button>
              <button
                type="button"
                onClick={() => setViewMode("edit")}
                className={`flex items-center gap-1 px-2 py-1 text-2xs font-medium rounded-md transition-colors cursor-pointer focus-ring ${
                  viewMode === "edit" ? "bg-accent text-white" : "text-muted hover:text-primary hover:bg-hover"
                }`}
                aria-pressed={viewMode === "edit"}
                title="Edit markdown source"
              >
                <Pencil className="w-3 h-3" />
                Edit
              </button>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 shrink-0" title="Unsaved changes" />}
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={isSaving || (!isDirty && !!selected)}
                title={selected ? "Save (Ctrl/⌘+S)" : "Save…"}
                className="flex items-center gap-1.5 px-2.5 py-1.5 bg-accent hover:bg-accent-hover text-white text-2xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                {selected ? (isDirty ? "Save" : "Saved") : "Save…"}
              </button>
              {selected && (
                <button
                  type="button"
                  onClick={() => setSaveModal({ mode: "saveAs", presetTopicName: selected.topicName })}
                  title="Save As…"
                  className="px-2 py-1 text-2xs text-muted hover:text-primary hover:bg-hover rounded-lg transition-colors focus-ring cursor-pointer"
                >
                  Save As…
                </button>
              )}
              {selected && (
                <button
                  type="button"
                  onClick={() => setDeleteItemTarget(selected)}
                  className="p-1.5 text-muted hover:text-red-500 rounded-lg transition-colors focus-ring cursor-pointer"
                  title="Delete item"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
          </>
        )}

        <button
          type="button"
          onClick={() => handleNew()}
          title="New research item"
          className="flex items-center gap-1.5 px-2.5 py-1 bg-accent-muted hover:bg-accent-muted-hover text-accent text-2xs font-medium rounded-lg transition-colors cursor-pointer focus-ring shrink-0"
        >
          <Plus className="w-3 h-3" />
          New
        </button>

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />

        {!agentId && (
          <AgentLauncherBar
            defaultAgentType="research"
            buttonLabel="Start Agent"
            buttonClassName="bg-indigo-600 hover:bg-indigo-500 text-white shadow-button-primary"
            onLaunch={handleAgentLaunched}
          />
        )}
      </AppPageHeader>

      <ResizableSplit direction="horizontal" initialRatio={0.18} minFirst={180} minSecond={320} className="flex-1 min-h-0">
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
        />

        <ChatDock agentId={agentId} storageKey="research" initialRatio={0.65} headerTitle="Research Agent">
          {mainPane}
        </ChatDock>
      </ResizableSplit>
    </div>
  );
}
