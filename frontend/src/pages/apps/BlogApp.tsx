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
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs from "../../components/ui/FilterTabs.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import CreatePostModal from "../../features/blog/CreatePostModal.tsx";
import { BLOG_AGENT_TYPES, parseTagsInput, STATUS_FILTERS } from "../../features/blog/constants.ts";
import StatusBadge from "../../features/blog/StatusBadge.tsx";
import type { PostStatus, StatusFilter } from "../../features/blog/types.ts";
import { POST_STATUSES } from "../../features/blog/types.ts";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { sanitizeBlogHtml } from "../../lib/sanitizeHtml.ts";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, blogRPCClient, useBlogPost, useBlogPosts, useBlogState } from "../../rpc.ts";

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
  const [open, setOpen] = useState(false);
  const [switching, setSwitching] = useState(false);

  const switchProvider = async (name: string) => {
    setOpen(false);
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
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        disabled={switching}
        className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer disabled:opacity-50"
      >
        <BookOpen className="w-4 h-4 shrink-0 text-rose-400" />
        <span className="text-sm font-medium text-primary">{provider ?? "Select blog"}</span>
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
        ) : (
          <ChevronDown className={cn("w-3.5 h-3.5 text-muted transition-transform", open && "rotate-180")} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-primary">
              <p className="text-xs font-semibold text-muted uppercase tracking-wider">Select Blog</p>
            </div>
            <nav className="py-1">
              {availableProviders.map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => void switchProvider(p)}
                  className={cn(
                    "w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring",
                    p === provider ? "text-primary font-medium bg-active" : "text-muted hover:text-primary",
                  )}
                >
                  <BookOpen className={cn("w-4 h-4 shrink-0", p === provider ? "text-rose-400" : "text-muted")} />
                  {p}
                  {p === provider && <span className="ml-auto w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />}
                </button>
              ))}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Post list item ───────────────────────────────────────────────────────────

function PostListItem({ post, selected, onClick }: { post: BlogPostListItem; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "w-full flex flex-col gap-1 px-3 py-3 text-left border-b border-primary hover:bg-hover transition-colors focus-ring cursor-pointer border-l-2",
        selected ? "bg-active border-l-accent" : "border-l-transparent",
      )}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={cn("text-sm font-medium leading-tight flex-1 min-w-0", selected ? "text-primary" : "text-secondary")}>
          {post.title || <em className="text-muted">Untitled</em>}
        </span>
        <StatusBadge status={post.status} />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted">
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
      </div>
    </button>
  );
}

// ─── Post editor (inline) ─────────────────────────────────────────────────────

function PostEditor({ post, provider, onCancel, onSaved }: { post: BlogPost; provider: string; onCancel: () => void; onSaved: (updated: BlogPost) => void }) {
  const [title, setTitle] = useState(post.title);
  const [html, setHtml] = useState(post.html);
  const [tags, setTags] = useState((post.tags ?? []).join(", "));
  const [status, setStatus] = useState<PostStatus>(post.status);
  const [saving, setSaving] = useState(false);

  // Parent should remount via key={post.id}; this guards against stale form state if it does not.
  useEffect(() => {
    setTitle(post.title);
    setHtml(post.html);
    setTags((post.tags ?? []).join(", "));
    setStatus(post.status);
  }, [post.id]);

  const handleSave = async () => {
    if (saving) return;
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastManager.error("Title is required", { duration: 3000 });
      return;
    }
    setSaving(true);
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
    } finally {
      setSaving(false);
    }
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
  const [starting, setStarting] = useState(false);
  const [statusBusy, setStatusBusy] = useState(false);
  const [editing, setEditing] = useState(false);
  const sanitizedHtml = useMemo(() => (post.html ? sanitizeBlogHtml(post.html) : ""), [post.html]);

  // Leaving a post must exit edit mode so form state cannot spill onto another post.
  useEffect(() => {
    setEditing(false);
  }, [post.id]);

  const handleWorkOnPost = async () => {
    if (starting) return;
    setStarting(true);
    try {
      await onWorkOnPost(post.id);
    } finally {
      setStarting(false);
    }
  };

  const setStatus = async (status: PostStatus) => {
    if (post.status === status || statusBusy) return;
    setStatusBusy(true);
    try {
      const result = await blogRPCClient.updatePost({ provider, id: post.id, updatedData: { status } });
      const label = status === "published" ? "Post published!" : status === "draft" ? "Post unpublished (draft)" : `Status set to ${status}`;
      toastManager.success(result.message || label, { duration: 3000 });
      // Keep optimistic override; onUpdated revalidates list/detail without clearing it.
      onUpdated(result.post);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setStatusBusy(false);
    }
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
          <StatusBadge status={post.status} />
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
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-tertiary border border-primary rounded-full text-xs text-muted">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
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
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <BookOpen className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">
              {search ? `No posts matching "${search}"` : statusFilter === "all" ? "No posts found" : `No ${statusFilter} posts`}
            </p>
            {!search && (
              <button type="button" onClick={onNewPost} className="text-xs text-accent hover:text-accent-soft cursor-pointer transition-colors focus-ring">
                Create your first post →
              </button>
            )}
          </div>
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
  if (!agentId) {
    return <LoadingState message="Connecting to blog service…" className="h-full" />;
  }

  if (availableProviders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <WifiOff className="w-10 h-10 text-muted opacity-30" />
        <div>
          <h2 className="text-base font-semibold text-primary mb-1">No blog providers configured</h2>
          <p className="text-sm text-muted max-w-sm">Configure a Ghost or WordPress provider in settings to manage posts here.</p>
        </div>
      </div>
    );
  }

  if (!provider) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
        <WifiOff className="w-10 h-10 text-muted opacity-30" />
        <div>
          <h2 className="text-base font-semibold text-primary mb-1">No provider selected</h2>
          <p className="text-sm text-muted max-w-xs">Select a blog provider from the dropdown to get started.</p>
        </div>
      </div>
    );
  }

  if (selectedPostId) {
    if (selectedPost) {
      return (
        <PostViewer key={selectedPost.id} post={selectedPost} provider={provider} onWorkOnPost={onWorkOnPost} onRefresh={onRefresh} onUpdated={onUpdated} />
      );
    }
    if (selectedPostError) {
      return <ErrorState title="Failed to load post" error={selectedPostError} onRetry={onRetryPost} variant="page" />;
    }
    // Selected but not yet loaded (or still resolving after a provider/id change)
    return <LoadingState message="Loading post…" className="h-full" />;
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
        <BookOpen className="w-8 h-8 text-white" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-primary mb-1">No post selected</h2>
        <p className="text-sm text-muted max-w-xs">Select a post from the list to view and edit it, or create a new draft.</p>
      </div>
      <button
        type="button"
        onClick={onNewPost}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors cursor-pointer focus-ring shadow-button-primary"
      >
        <FilePlus className="w-4 h-4" /> New post
      </button>
    </div>
  );
}

// ─── Main BlogApp ─────────────────────────────────────────────────────────────

export default function BlogApp() {
  const navigate = useNavigate();
  const { blogId: routeBlogId } = useParams<{ blogId?: string }>();
  // URL is the source of truth for which post is open (params are already decoded).
  const selectedPostId = routeBlogId ?? null;

  const {
    agentId,
    initialising,
    error: initError,
  } = useHeadlessAgent({
    appName: "Blog app",
    preferredTypes: [...BLOG_AGENT_TYPES],
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  /** Optimistic override after local mutations until SWR revalidates */
  const [postOverride, setPostOverride] = useState<BlogPost | null>(null);

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

  // Clear selection and override when provider changes
  const handleProviderChange = useCallback(
    (p: string) => {
      setProvider(p);
      setPostOverride(null);
      setSearch("");
      clearPost();
    },
    [clearPost],
  );

  // Keep the chat agent’s current post in sync so addSelectedPost can attach it to chat input.
  useEffect(() => {
    if (!chatAgentId || (!provider && !selectedPostId)) return;
    blogRPCClient
      .updateBlogState({
        agentId: chatAgentId,
        ...(provider !== null && { selectedProvider: provider }),
        ...(selectedPostId !== null && { selectedPostId }),
      })
      .catch(() => {});
  }, [chatAgentId, provider, selectedPostId]);

  // Drop stale override when selection changes
  useEffect(() => {
    setPostOverride(null);
  }, [selectedPostId, provider]);

  const allPosts = useMemo(() => (posts.data?.posts ?? []) as BlogPostListItem[], [posts.data]);

  const postCounts = useMemo(
    () => ({
      all: allPosts.length,
      draft: allPosts.filter(p => p.status === "draft").length,
      published: allPosts.filter(p => p.status === "published").length,
    }),
    [allPosts],
  );

  const filteredPosts = useMemo(() => {
    let list = allPosts;
    if (statusFilter !== "all") {
      list = list.filter(p => p.status === statusFilter);
    }
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(p => p.title.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
    }
    return list;
  }, [allPosts, statusFilter, search]);

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

  const launchChatAgent = async (agentType: string, postId?: string) => {
    const { id } = await agentRPCClient.createAgent({ agentType, headless: false });
    if (postId && provider) {
      try {
        await blogRPCClient.updateBlogState({ agentId: id, selectedPostId: postId, selectedProvider: provider });
      } catch {
        // Non-fatal — agent still usable
      }
    } else if (provider) {
      try {
        await blogRPCClient.updateBlogState({ agentId: id, selectedProvider: provider });
      } catch {
        // Non-fatal
      }
    }
    setChatAgentId(id);
  };

  const handleWorkOnPost = async (postId: string) => {
    try {
      const types = await agentRPCClient.getAgentTypes({});
      const preferred = types.find(t => (BLOG_AGENT_TYPES as readonly string[]).includes(t.type)) ?? types[0];
      if (!preferred) {
        toastManager.error("No blog agent type available", { duration: 4000 });
        return;
      }
      await launchChatAgent(preferred.type, postId || undefined);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    }
  };

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
        <AppPageHeader
          title="Blog"
          subtitle="Manage posts across your providers"
          icon={<BookOpen className="w-4 h-4" />}
          iconGradient="from-rose-500 to-pink-600"
        />
        <ErrorState title="Blog Unavailable" error={initError} onRetry={() => window.location.reload()} variant="page" />
      </div>
    );
  }

  if (initialising && !agentId) {
    return (
      <div className="w-full h-full flex flex-col bg-primary">
        <AppPageHeader
          title="Blog"
          subtitle="Manage posts across your providers"
          icon={<BookOpen className="w-4 h-4" />}
          iconGradient="from-rose-500 to-pink-600"
        />
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
      <AppPageHeader
        title={
          <BlogSelector
            agentId={agentId}
            provider={provider}
            availableProviders={availableProviders}
            loading={blogState.isLoading || (!!agentId && !blogState.data)}
            onProviderChange={handleProviderChange}
          />
        }
        subtitle={provider ? `Managing ${provider}` : "Manage posts across your providers"}
        icon={<BookOpen className="w-4 h-4" />}
        iconGradient="from-rose-500 to-pink-600"
        size="compact"
      >
        <button
          type="button"
          onClick={openCreate}
          disabled={!provider}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-accent hover:bg-accent-hover text-white shadow-button-primary transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <FilePlus className="w-3.5 h-3.5" />
          New post
        </button>
        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
        <AgentLauncherBar
          buttonLabel="Agent"
          buttonClassName="bg-secondary border border-primary text-primary hover:bg-hover"
          onLaunch={id => {
            if (provider) {
              void blogRPCClient.updateBlogState({ agentId: id, selectedProvider: provider, ...(selectedPostId ? { selectedPostId } : {}) }).catch(() => {});
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
          className="p-2 text-muted hover:text-primary border border-primary rounded-lg hover:bg-hover transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (posts.isValidating || blogState.isValidating) && "animate-spin")} />
        </button>
      </AppPageHeader>

      <div className="flex-1 min-h-0">
        <ChatDock agentId={chatAgentId} storageKey="blog" initialRatio={0.6} headerTitle="Blog Agent">
          {body}
        </ChatDock>
      </div>

      {showCreateModal && provider && <CreatePostModal provider={provider} onClose={() => setShowCreateModal(false)} onCreated={handlePostCreated} />}
    </div>
  );
}
