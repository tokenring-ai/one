import type { BlogPost, BlogPostListItem } from "@tokenring-ai/blog/BlogProvider";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import formatError from "@tokenring-ai/utility/error/formatError";
import { BookOpen, Calendar, ChevronDown, ExternalLink, FilePlus, Globe, Loader2, Pencil, RefreshCw, Save, Tag, WifiOff, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatDock from "../../components/chat/ChatDock.tsx";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import ContentListItem from "../../components/ui/ContentListItem.tsx";
import DetailViewerArea from "../../components/ui/DetailViewerArea.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import InlineDropdown, { InlineDropdownItem } from "../../components/ui/InlineDropdown.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import PanelToolbar from "../../components/ui/PanelToolbar.tsx";
import TagChip from "../../components/ui/TagChip.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import CreatePostModal from "../../features/blog/CreatePostModal.tsx";
import { parseTagsInput, STATUS_FILTERS } from "../../features/blog/constants.ts";
import BlogStatusBadge from "../../features/blog/StatusBadge.tsx";
import type { PostStatus, StatusFilter } from "../../features/blog/types.ts";
import { POST_STATUSES } from "../../features/blog/types.ts";
import { useBusyAction } from "../../hooks/useBusyAction.ts";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { useRefSync } from "../../hooks/useRefSync.ts";
import { useSearchFilter } from "../../hooks/useSearchFilter.ts";
import { sanitizeBlogHtml } from "../../lib/sanitizeHtml.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, blogRPCClient, useBlogConfiguration, useBlogPost, useBlogPosts, useBlogState } from "../../rpc.ts";

// ─── Blog selector ────────────────────────────────────────────────────────────

function BlogSelector({
  agentId,
  provider,
  availableProviders,
  loading,
  onProviderChange,
}: {
  agentId: string | null;
  provider: string | null;
  availableProviders: string[];
  loading: boolean;
  onProviderChange: (p: string) => void;
}) {
  const [switching, setSwitching] = useState(false);

  const switchProvider = async (name: string) => {
    if (!agentId || name === provider) return;
    setSwitching(true);
    try {
      await blogRPCClient.updateBlogState({ agentId, selectedProvider: name });
      onProviderChange(name);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 4000 });
    } finally {
      setSwitching(false);
    }
  };

  if (loading && availableProviders.length === 0) {
    return (
      <span className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-muted">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading blogs…
      </span>
    );
  }

  if (!agentId || availableProviders.length === 0) {
    return (
      <span className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-muted">
        <WifiOff className="w-4 h-4 shrink-0" />
        No blog selected
      </span>
    );
  }

  return (
    <InlineDropdown
      header="Select Blog"
      width="w-56"
      align="left"
      closeOnSelect
      disabled={switching}
      triggerClassName="gap-2 bg-transparent border-transparent hover:bg-hover text-primary"
      trigger={open => (
        <>
          <BookOpen className="w-4 h-4 shrink-0 text-rose-400" />
          <span className="text-sm font-medium text-primary">{provider ?? "Select blog"}</span>
          {switching ? (
            <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
          ) : (
            <ChevronDown className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")} />
          )}
        </>
      )}
    >
      <nav className="py-1">
        {availableProviders.map(p => {
          const isActive = p === provider;
          return (
            <InlineDropdownItem
              key={p}
              active={isActive}
              onClick={() => void switchProvider(p)}
              className={cn("gap-2.5", isActive && "bg-active")}
              activeColor="bg-rose-500"
              leading={<BookOpen className={cn("w-4 h-4 shrink-0", isActive ? "text-rose-400" : "text-muted")} />}
            >
              {p}
            </InlineDropdownItem>
          );
        })}
      </nav>
    </InlineDropdown>
  );
}

// ─── Post list item ───────────────────────────────────────────────────────────

function PostListItem({ post, selected, onClick }: { post: BlogPostListItem; selected: boolean; onClick: () => void }) {
  return (
    <ContentListItem
      selected={selected}
      onClick={onClick}
      title={post.title || <em className="text-muted">Untitled</em>}
      status={<BlogStatusBadge status={post.status} />}
      metadata={
        <>
          <Calendar className="w-3 h-3 shrink-0" />
          <span>{formatDate(post.updated_at)}</span>
          {post.tags && post.tags.length > 0 && (
            <>
              <span>·</span>
              <Tag className="w-3 h-3 shrink-0" />
              <span className="truncate">
                {post.tags.slice(0, 2).join(", ")}
                {post.tags.length > 2 ? ` +${post.tags.length - 2}` : ""}
              </span>
            </>
          )}
        </>
      }
    />
  );
}

// ─── Post editor (inline) ─────────────────────────────────────────────────────

function PostEditor({ post, provider, onCancel, onSaved }: { post: BlogPost; provider: string; onCancel: () => void; onSaved: (updated: BlogPost) => void }) {
  const [title, setTitle] = useState(post.title);
  const [html, setHtml] = useState(post.html);
  const [tags, setTags] = useState((post.tags ?? []).join(", "));
  const [status, setStatus] = useState<PostStatus>(post.status);
  const { busy: saving, execute: executeSave } = useBusyAction();

  // Parent should remount via key={post.id}; this guards against stale form state if it does not.
  useEffect(() => {
    setTitle(post.title);
    setHtml(post.html);
    setTags((post.tags ?? []).join(", "));
    setStatus(post.status);
  }, [post.id]);

  const handleSave = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastManager.error("Title is required", { duration: 3000 });
      return;
    }
    await executeSave(async () => {
      try {
        const result = await blogRPCClient.updatePost({
          provider,
          id: post.id,
          updatedData: {
            title: trimmedTitle,
            html,
            tags: parseTagsInput(tags),
            status,
          },
        });
        toastManager.success(result.message || "Post saved", { duration: 3000 });
        onSaved(result.post);
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-5 pb-4 border-b border-primary space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-semibold text-primary">Edit post</h2>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 text-muted hover:text-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer"
            aria-label="Cancel editing"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div>
          <label htmlFor="edit-post-title" className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
            Title
          </label>
          <input
            id="edit-post-title"
            value={title}
            onChange={e => setTitle(e.target.value)}
            className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary focus-accent"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label htmlFor="edit-post-status" className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Status
            </label>
            <select
              id="edit-post-status"
              value={status}
              onChange={e => setStatus(e.target.value as PostStatus)}
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary focus-accent cursor-pointer"
            >
              {POST_STATUSES.map(s => (
                <option key={s} value={s}>
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="edit-post-tags" className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Tags
            </label>
            <input
              id="edit-post-tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="comma, separated"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus-accent"
            />
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !title.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring shadow-button-primary"
          >
            {saving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Saving…
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5" /> Save changes
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="px-4 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            Cancel
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        <label htmlFor="edit-post-html" className="text-xs font-semibold text-muted uppercase tracking-wider block mb-1">
          Content <span className="font-normal normal-case tracking-normal">(HTML)</span>
        </label>
        <textarea
          id="edit-post-html"
          value={html}
          onChange={e => setHtml(e.target.value)}
          className="w-full h-[min(28rem,calc(100%-1.5rem))] min-h-48 bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary font-mono focus-accent resize-y"
          spellCheck={false}
        />
      </div>
    </div>
  );
}

// ─── Post viewer ──────────────────────────────────────────────────────────────

function PostViewer({
  post,
  provider,
  onWorkOnPost,
  onRefresh,
  onUpdated,
}: {
  post: BlogPost;
  provider: string;
  onWorkOnPost: (postId: string) => Promise<void>;
  onRefresh: () => void;
  onUpdated: (post: BlogPost) => void;
}) {
  const { busy: starting, execute: executeWork } = useBusyAction();
  const { busy: statusBusy, execute: executeStatus } = useBusyAction();
  const [editing, setEditing] = useState(false);
  const sanitizedHtml = useMemo(() => (post.html ? sanitizeBlogHtml(post.html) : ""), [post.html]);

  // Leaving a post must exit edit mode so form state cannot spill onto another post.
  useEffect(() => {
    setEditing(false);
  }, [post.id]);

  const handleWorkOnPost = async () => {
    await executeWork(() => onWorkOnPost(post.id));
  };

  const setStatus = async (status: PostStatus) => {
    if (post.status === status) return;
    await executeStatus(async () => {
      try {
        const result = await blogRPCClient.updatePost({ provider, id: post.id, updatedData: { status } });
        const label = status === "published" ? "Post published!" : status === "draft" ? "Post unpublished (draft)" : `Status set to ${status}`;
        toastManager.success(result.message || label, { duration: 3000 });
        // Keep optimistic override; onUpdated revalidates list/detail without clearing it.
        onUpdated(result.post);
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  if (editing) {
    return (
      <PostEditor
        key={post.id}
        post={post}
        provider={provider}
        onCancel={() => setEditing(false)}
        onSaved={updated => {
          setEditing(false);
          onUpdated(updated);
        }}
      />
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-primary space-y-4">
        {post.feature_image?.url && (
          <div className="w-full h-40 rounded-xl overflow-hidden bg-tertiary">
            <img src={post.feature_image.url} alt="" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-primary leading-tight flex-1">{post.title || <em className="text-muted font-normal">Untitled</em>}</h2>
          <BlogStatusBadge status={post.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs text-muted">
          <span className="flex items-center gap-1">
            <Calendar className="w-3 h-3" />
            Updated {formatDate(post.updated_at)}
          </span>
          {post.published_at && (
            <span className="flex items-center gap-1">
              <Globe className="w-3 h-3" />
              Published {formatDate(post.published_at)}
            </span>
          )}
          {post.url && (
            <a href={post.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 hover:text-primary transition-colors">
              <ExternalLink className="w-3 h-3" /> View live
            </a>
          )}
        </div>

        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {post.tags.map(tag => (
              <TagChip key={tag} label={tag} />
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer focus-ring shadow-button-primary"
          >
            <Pencil className="w-3.5 h-3.5" /> Edit
          </button>
          <button
            type="button"
            onClick={() => void handleWorkOnPost()}
            disabled={starting}
            className="flex items-center gap-2 px-4 py-2 border border-primary text-primary hover:bg-hover text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
          >
            {starting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening…
              </>
            ) : (
              <>
                <BookOpen className="w-3.5 h-3.5" /> Work with agent
              </>
            )}
          </button>
          {post.status !== "published" ? (
            <button
              type="button"
              onClick={() => void setStatus("published")}
              disabled={statusBusy}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
            >
              {statusBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Publishing…
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" /> Publish
                </>
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => void setStatus("draft")}
              disabled={statusBusy}
              className="flex items-center gap-2 px-4 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
            >
              {statusBusy ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Updating…
                </>
              ) : (
                "Unpublish"
              )}
            </button>
          )}
          <button
            type="button"
            onClick={onRefresh}
            className="p-2 text-muted hover:text-primary border border-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer"
            title="Refresh"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-6">
        {sanitizedHtml ? (
          <article className="prose prose-sm dark:prose-invert max-w-none text-primary" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-3 text-muted">
            <BookOpen className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              No content preview available.
              <br />
              Click <strong className="text-primary">Edit</strong> to add content, or work with an agent.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post list sidebar ────────────────────────────────────────────────────────

function PostListSidebar({
  filteredPosts,
  postsLoading,
  postsError,
  totalCount,
  statusFilter,
  postCounts,
  selectedPostId,
  search,
  provider,
  isValidating,
  onStatusFilter,
  onSearch,
  onSelectPost,
  onNewPost,
  onRefresh,
}: {
  filteredPosts: BlogPostListItem[];
  postsLoading: boolean;
  postsError: unknown;
  totalCount: number;
  statusFilter: StatusFilter;
  postCounts: Record<StatusFilter, number>;
  selectedPostId: string | null;
  search: string;
  provider: string | null;
  isValidating: boolean;
  onStatusFilter: (f: StatusFilter) => void;
  onSearch: (q: string) => void;
  onSelectPost: (id: string) => void;
  onNewPost: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <NavigationSidebarHeader
        title="Posts"
        actions={[
          {
            icon: <FilePlus className="w-3.5 h-3.5" />,
            label: "New post",
            title: "New post",
            onClick: onNewPost,
          },
        ]}
      />

      <FilterTabs tabs={STATUS_FILTERS.map(tab => ({ ...tab, count: postCounts[tab.id] }))} value={statusFilter} onChange={onStatusFilter} showZeroCounts />

      <div className="px-3 py-2 border-b border-primary shrink-0">
        <input
          type="search"
          placeholder="Search posts…"
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-xs text-primary placeholder-muted focus-accent transition-all"
          aria-label="Search posts"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!provider ? (
          <div className="flex flex-col items-center justify-center py-10 gap-2 text-center px-4">
            <WifiOff className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">Select a blog provider to load posts</p>
          </div>
        ) : postsLoading ? (
          <LoadingState message="Loading posts…" size="sm" className="py-10" />
        ) : postsError ? (
          <ErrorState title="Failed to load posts" error={postsError} onRetry={onRefresh} variant="inline" className="py-6" />
        ) : filteredPosts.length === 0 ? (
          <EmptyState
            variant="compact"
            icon={BookOpen}
            title={search ? `No posts matching "${search}"` : statusFilter === "all" ? "No posts found" : `No ${statusFilter} posts`}
            action={
              search ? null : (
                <button type="button" onClick={onNewPost} className="text-xs text-accent hover:text-accent-soft cursor-pointer transition-colors focus-ring">
                  Create your first post →
                </button>
              )
            }
          />
        ) : (
          filteredPosts.map(post => <PostListItem key={post.id} post={post} selected={post.id === selectedPostId} onClick={() => onSelectPost(post.id)} />)
        )}
      </div>

      {provider && !postsLoading && !postsError && (
        <div className="shrink-0 border-t border-primary px-3 py-2 flex items-center justify-between gap-2">
          <span
            className="text-xs text-muted min-w-0 truncate"
            title={totalCount > filteredPosts.length ? `${filteredPosts.length} shown of ${totalCount} total` : undefined}
          >
            {statusFilter === "all" && !search && filteredPosts.length < totalCount
              ? `Showing first ${filteredPosts.length} of ${totalCount}`
              : `${filteredPosts.length} of ${totalCount} posts`}
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-muted hover:text-primary transition-colors cursor-pointer rounded focus-ring shrink-0"
            title="Refresh"
          >
            <RefreshCw className={cn("w-3 h-3", isValidating && "animate-spin")} />
          </button>
        </div>
      )}
    </>
  );
}

// ─── Post viewer area ─────────────────────────────────────────────────────────

function PostViewerArea({
  agentId,
  provider,
  selectedPostId,
  selectedPost,
  selectedPostError,
  availableProviders,
  onWorkOnPost,
  onRefresh,
  onNewPost,
  onUpdated,
  onRetryPost,
}: {
  agentId: string | null;
  provider: string | null;
  selectedPostId: string | null;
  selectedPost: BlogPost | null;
  selectedPostError: unknown;
  availableProviders: string[];
  onWorkOnPost: (postId: string) => Promise<void>;
  onRefresh: () => void;
  onNewPost: () => void;
  onUpdated: (post: BlogPost) => void;
  onRetryPost: () => void;
}) {
  const ready = Boolean(agentId && provider && availableProviders.length > 0);

  // Distinguish connecting (spinner) from misconfiguration (empty) via notReady.
  const notReady =
    agentId && availableProviders.length === 0
      ? {
          icon: WifiOff,
          title: "No blog providers configured",
          hint: "Configure a Ghost or WordPress provider in settings to manage posts here.",
        }
      : agentId && !provider
        ? {
            icon: WifiOff,
            title: "No provider selected",
            hint: "Select a blog provider from the dropdown to get started.",
          }
        : undefined;

  return (
    <DetailViewerArea
      ready={ready}
      readyLoadingMessage="Connecting to blog service…"
      {...(notReady != null ? { notReady } : {})}
      hasSelection={selectedPostId != null}
      data={selectedPost}
      {...(selectedPostError != null ? { error: selectedPostError } : {})}
      loading={selectedPostId != null && selectedPost == null && selectedPostError == null}
      loadingMessage="Loading post…"
      errorTitle="Failed to load post"
      onRetry={onRetryPost}
      emptyState={{
        icon: BookOpen,
        iconBadgeClassName: "bg-linear-to-br from-rose-500 to-pink-600",
        title: "No post selected",
        hint: "Select a post from the list to view and edit it, or create a new draft.",
        ctaLabel: "New post",
        ctaIcon: FilePlus,
        onCta: onNewPost,
      }}
      renderContent={post => (
        <PostViewer key={post.id} post={post} provider={provider as string} onWorkOnPost={onWorkOnPost} onRefresh={onRefresh} onUpdated={onUpdated} />
      )}
    />
  );
}

// ─── Main BlogApp ─────────────────────────────────────────────────────────────

export default function BlogApp() {
  const navigate = useNavigate();
  const { blogId: routeBlogId } = useParams<{ blogId?: string }>();
  // URL is the source of truth for which post is open (params are already decoded).
  const selectedPostId = routeBlogId ?? null;

  const configuration = useBlogConfiguration();
  // Fallback matches BlogConfigSchema.agentTypes default so headless agent init
  // can resolve a preferred type before the configuration RPC returns.
  const allowedAgentTypes = configuration.data?.agentTypes ?? ["blog", "writer", "contentWriter", "content-writer", "managingEditor"];
  const defaultAgentType = allowedAgentTypes[0] ?? "blog";

  const {
    agentId,
    initialising,
    error: initError,
  } = useHeadlessAgent({
    appName: "Blog app",
    preferredTypes: allowedAgentTypes,
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [showCreateModal, setShowCreateModal] = useState(false);
  /** Optimistic override after local mutations until SWR revalidates */
  const [postOverride, setPostOverride] = useState<BlogPost | null>(null);

  // Always read the latest provider after awaits (avoids stale closure in launchChatAgent).
  const providerRef = useRefSync(provider);
  const allowedAgentTypesRef = useRefSync(allowedAgentTypes);

  const blogState = useBlogState(agentId ?? undefined);
  const blogStateData = blogState.data?.status === "success" ? blogState.data : null;
  // Always fetch all statuses so counts and client-side filters stay accurate
  const posts = useBlogPosts(provider ?? undefined, "all", 200);
  const selectedPostQuery = useBlogPost(provider ?? undefined, selectedPostId ?? undefined);

  const openPost = useCallback(
    (id: string, options?: { replace?: boolean }) => {
      void navigate(`/blog/${encodeURIComponent(id)}`, options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  const clearPost = useCallback(
    (options?: { replace?: boolean }) => {
      void navigate("/blog", options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  // Sync provider and available providers from blog state
  useEffect(() => {
    if (!blogStateData) return;
    const { selectedProvider, availableProviders: ap } = blogStateData;
    setAvailableProviders(ap);
    if (ap.length === 0) {
      setProvider(null);
      return;
    }
    if (provider && ap.includes(provider)) return;
    const next = selectedProvider && ap.includes(selectedProvider) ? selectedProvider : ap[0]!;
    setProvider(next);
  }, [blogStateData, provider]);

  const allPosts = useMemo(() => (posts.data?.posts ?? []) as BlogPostListItem[], [posts.data]);

  const postCounts = useMemo(
    () => ({
      all: allPosts.length,
      draft: allPosts.filter(p => p.status === "draft").length,
      published: allPosts.filter(p => p.status === "published").length,
    }),
    [allPosts],
  );

  const {
    query: search,
    setQuery: setSearch,
    filtered: filteredPosts,
    clear: clearSearch,
  } = useSearchFilter({
    items: allPosts,
    searchFields: p => `${p.title} ${(p.tags ?? []).join(" ")}`,
    predicate: p => statusFilter === "all" || p.status === statusFilter,
  });

  // Clear selection and override when provider changes
  const handleProviderChange = useCallback(
    (p: string) => {
      setProvider(p);
      setPostOverride(null);
      clearSearch();
      clearPost();
    },
    [clearPost, clearSearch],
  );

  // Keep the chat agent’s current post in sync so addSelectedPost can attach it to chat input.
  useEffect(() => {
    if (!chatAgentId || (!provider && !selectedPostId)) return;
    toastOnReject(
      blogRPCClient.updateBlogState({
        agentId: chatAgentId,
        ...(provider !== null && { selectedProvider: provider }),
        ...(selectedPostId !== null && { selectedPostId }),
      }),
    );
  }, [chatAgentId, provider, selectedPostId]);

  // Drop stale override when selection changes
  useEffect(() => {
    setPostOverride(null);
  }, [selectedPostId, provider]);

  const selectedPost =
    postOverride && postOverride.id === selectedPostId
      ? postOverride
      : selectedPostQuery.data?.post && selectedPostQuery.data.post.id === selectedPostId
        ? selectedPostQuery.data.post
        : null;

  const refreshPosts = useCallback(() => {
    void posts.mutate();
  }, [posts.mutate]);

  const refreshSelected = useCallback(() => {
    // Drop optimistic override so revalidated server data can surface
    setPostOverride(null);
    void selectedPostQuery.mutate();
    void posts.mutate();
  }, [selectedPostQuery.mutate, posts.mutate]);

  const launchChatAgent = useCallback(async (agentType: string, postId?: string) => {
    const { id } = await agentRPCClient.createAgent({ agentType, headless: false });
    // Read current provider after the await so a mid-flight provider switch is respected.
    const currentProvider = providerRef.current;
    if (currentProvider) {
      try {
        await blogRPCClient.updateBlogState({
          agentId: id,
          selectedProvider: currentProvider,
          ...(postId ? { selectedPostId: postId } : {}),
        });
      } catch (error: unknown) {
        // Non-fatal — agent still usable, but tools may lack the selection.
        toastManager.warning(`Agent started, but blog selection could not be synced: ${formatError(error)}`, {
          duration: 4000,
        });
      }
    }
    setChatAgentId(id);
  }, []);

  const handleWorkOnPost = useCallback(
    async (postId: string) => {
      try {
        const preferredTypes = allowedAgentTypesRef.current;
        const types = await agentRPCClient.getAgentTypes({});
        const preferred = types.find(t => preferredTypes.includes(t.type)) ?? types[0];
        if (!preferred) {
          toastManager.error("No blog agent type available", { duration: 4000 });
          return;
        }
        await launchChatAgent(preferred.type, postId || undefined);
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    },
    [launchChatAgent],
  );

  const handlePostCreated = (postId: string) => {
    setShowCreateModal(false);
    openPost(postId);
    setPostOverride(null);
    void posts.mutate();
  };

  const handlePostUpdated = (updated: BlogPost) => {
    setPostOverride(updated);
    void posts.mutate();
    void selectedPostQuery.mutate();
  };

  const openCreate = () => {
    if (!provider) {
      toastManager.error("Select a blog provider first", { duration: 3000 });
      return;
    }
    setShowCreateModal(true);
  };

  if (initError) {
    return (
      <div className="w-full h-full flex flex-col bg-primary">
        <PanelToolbar icon={BookOpen} iconGradient="from-rose-500 to-pink-600" title="Blog" actions={null} showDivider={false} />
        <ErrorState title="Blog Unavailable" error={initError} onRetry={() => window.location.reload()} variant="page" />
      </div>
    );
  }

  if (initialising && !agentId) {
    return (
      <div className="w-full h-full flex flex-col bg-primary">
        <PanelToolbar icon={BookOpen} iconGradient="from-rose-500 to-pink-600" title="Blog" actions={null} showDivider={false} />
        <LoadingState message="Starting blog app…" className="flex-1" />
      </div>
    );
  }

  const blogStateError = blogState.error ?? (blogState.data?.status === "agentNotFound" ? new Error("Blog agent not found") : null);

  const body = (
    <WorkspaceShell
      appId="blog"
      title="Blog"
      navigationLabel="Blog posts"
      hasSelection={selectedPostId !== null}
      navigation={
        <div className="h-full flex flex-col min-h-0 bg-secondary">
          <PostListSidebar
            filteredPosts={filteredPosts}
            postsLoading={!!provider && posts.isLoading && !posts.data}
            postsError={posts.error}
            totalCount={posts.data?.count ?? allPosts.length}
            statusFilter={statusFilter}
            postCounts={postCounts}
            selectedPostId={selectedPostId}
            search={search}
            provider={provider}
            isValidating={posts.isValidating}
            onStatusFilter={setStatusFilter}
            onSearch={setSearch}
            onSelectPost={openPost}
            onNewPost={openCreate}
            onRefresh={refreshPosts}
          />
        </div>
      }
    >
      <div className="flex-1 min-w-0 overflow-hidden">
        {blogStateError && !blogStateData ? (
          <ErrorState title="Failed to load blog state" error={blogStateError} onRetry={() => void blogState.mutate()} variant="page" />
        ) : (
          <PostViewerArea
            agentId={agentId}
            provider={provider}
            selectedPostId={selectedPostId}
            selectedPost={selectedPost}
            selectedPostError={selectedPostQuery.error}
            availableProviders={availableProviders}
            onWorkOnPost={handleWorkOnPost}
            onRefresh={refreshSelected}
            onNewPost={openCreate}
            onUpdated={handlePostUpdated}
            onRetryPost={() => void selectedPostQuery.mutate()}
          />
        )}
      </div>
    </WorkspaceShell>
  );

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <PanelToolbar
        icon={BookOpen}
        iconGradient="from-rose-500 to-pink-600"
        middle={
          <BlogSelector
            agentId={agentId}
            provider={provider}
            availableProviders={availableProviders}
            loading={blogState.isLoading || (!!agentId && !blogState.data)}
            onProviderChange={handleProviderChange}
          />
        }
        actions={
          <>
            <button
              type="button"
              onClick={openCreate}
              disabled={!provider}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hover text-white shadow-button-primary transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              <FilePlus className="w-3.5 h-3.5" />
              New post
            </button>
            <AgentLauncherBar
              buttonLabel="Agent"
              buttonClassName="bg-secondary border border-primary text-primary hover:bg-hover"
              defaultAgentType={defaultAgentType}
              allowedAgentTypes={allowedAgentTypes}
              onLaunch={id => {
                if (provider) {
                  toastOnReject(
                    blogRPCClient.updateBlogState({
                      agentId: id,
                      selectedProvider: provider,
                      ...(selectedPostId ? { selectedPostId } : {}),
                    }),
                  );
                }
                setChatAgentId(id);
              }}
            />
            <button
              type="button"
              onClick={() => {
                setPostOverride(null);
                void blogState.mutate();
                refreshPosts();
                if (selectedPostId) void selectedPostQuery.mutate();
              }}
              className="p-2 text-muted hover:text-primary border border-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer shrink-0"
              title="Refresh"
            >
              <RefreshCw className={cn("w-3.5 h-3.5", (posts.isValidating || blogState.isValidating) && "animate-spin")} />
            </button>
          </>
        }
      />

      <div className="flex-1 min-h-0">
        <ChatDock agentId={chatAgentId} storageKey="blog" initialRatio={0.6} headerTitle="Blog Agent">
          {body}
        </ChatDock>
      </div>

      {showCreateModal && provider && <CreatePostModal provider={provider} onClose={() => setShowCreateModal(false)} onCreated={handlePostCreated} />}
    </div>
  );
}
