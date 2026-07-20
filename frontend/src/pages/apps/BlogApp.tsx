import type { BlogPost, BlogPostListItem } from "@tokenring-ai/blog/BlogProvider";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import formatError from "@tokenring-ai/utility/error/formatError";
import { BookOpen, Calendar, ChevronDown, ExternalLink, FilePlus, Globe, Image, Loader2, Pencil, RefreshCw, Tag, WifiOff } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import AgentLauncherBar from "../../components/AgentLauncherBar.tsx";
import ChatPanel from "../../components/chat/ChatPanel.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import ResizableSplit from "../../components/ui/ResizableSplit.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useHeadlessAgent } from "../../hooks/useHeadlessAgent.ts";
import { sanitizeBlogHtml } from "../../lib/sanitizeHtml.ts";
import { agentRPCClient, blogRPCClient, useBlogPost, useBlogPosts, useBlogState } from "../../rpc.ts";

// ─── Types ───────────────────────────────────────────────────────────────────

type PostStatus = "draft" | "published" | "scheduled" | "pending" | "private";
type StatusFilter = "all" | "draft" | "published";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<PostStatus, { label: string; dot: string; badge: string }> = {
  draft: { label: "Draft", dot: "bg-amber-400", badge: "bg-amber-400/10 text-amber-600 dark:text-amber-400 border-amber-400/30" },
  published: { label: "Published", dot: "bg-emerald-500", badge: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" },
  scheduled: { label: "Scheduled", dot: "bg-blue-400", badge: "bg-blue-400/10 text-blue-600 dark:text-blue-400 border-blue-400/30" },
  pending: { label: "Pending", dot: "bg-orange-400", badge: "bg-orange-400/10 text-orange-600 dark:text-orange-400 border-orange-400/30" },
  private: { label: "Private", dot: "bg-violet-400", badge: "bg-violet-400/10 text-violet-600 dark:text-violet-400 border-violet-400/30" },
};

function StatusBadge({ status }: { status: PostStatus }) {
  const s = STATUS_STYLES[status];
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border ${s.badge}`}>
      <span className={`w-1 h-1 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

// ─── Blog selector ────────────────────────────────────────────────────────────

function BlogSelector({
  agentId,
  provider,
  availableProviders,
  onProviderChange,
}: {
  agentId: string | null;
  provider: string | null;
  availableProviders: string[];
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

  const label = provider ?? "No blog selected";

  if (!agentId || availableProviders.length === 0) {
    return (
      <span className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium text-muted">
        {switching ? <Loader2 className="w-4 h-4 animate-spin" /> : <BookOpen className="w-4 h-4 shrink-0" />}
        {label}
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
        <span className="text-sm font-medium text-primary">{label}</span>
        {switching ? (
          <Loader2 className="w-3.5 h-3.5 text-muted animate-spin" />
        ) : (
          <ChevronDown className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`} />
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 w-56 bg-secondary border border-primary rounded-xl shadow-card z-50 overflow-hidden">
            <div className="px-3 py-2 border-b border-primary">
              <p className="text-2xs font-semibold text-muted uppercase tracking-wider">Select Blog</p>
            </div>
            <nav className="py-1">
              {availableProviders.map(p => (
                <button
                  type="button"
                  key={p}
                  onClick={() => void switchProvider(p)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 text-xs hover:bg-hover transition-colors cursor-pointer text-left focus-ring ${
                    p === provider ? "text-primary font-medium bg-active" : "text-muted hover:text-primary"
                  }`}
                >
                  <BookOpen className={`w-4 h-4 shrink-0 ${p === provider ? "text-rose-400" : "text-muted"}`} />
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
      className={`w-full flex flex-col gap-1 px-3 py-3 text-left border-b border-primary hover:bg-hover transition-colors focus-ring cursor-pointer ${
        selected ? "bg-active border-l-2 border-l-accent" : "border-l-2 border-l-transparent"
      }`}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-start justify-between gap-2">
        <span className={`text-sm font-medium leading-tight flex-1 min-w-0 ${selected ? "text-primary" : "text-secondary"}`}>
          {post.title || <em className="text-muted">Untitled</em>}
        </span>
        <StatusBadge status={post.status} />
      </div>
      <div className="flex items-center gap-2 text-2xs text-muted">
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

// ─── Post viewer ──────────────────────────────────────────────────────────────

function PostViewer({
  post,
  provider,
  onWorkOnPost,
  onRefresh,
}: {
  post: BlogPost;
  provider: string;
  onWorkOnPost: (postId: string) => Promise<void>;
  onRefresh: () => void;
}) {
  const [starting, setStarting] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const sanitizedHtml = useMemo(() => (post.html ? sanitizeBlogHtml(post.html) : ""), [post.html]);

  const handleWorkOnPost = async () => {
    setStarting(true);
    try {
      await onWorkOnPost(post.id);
    } finally {
      setStarting(false);
    }
  };

  const handlePublish = async () => {
    if (post.status === "published") return;
    setPublishing(true);
    try {
      await blogRPCClient.updatePost({ provider, id: post.id, updatedData: { status: "published" } });
      toastManager.success("Post published!", { duration: 3000 });
      onRefresh();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Post header */}
      <div className="shrink-0 px-6 pt-6 pb-4 border-b border-primary space-y-4">
        {post.feature_image?.url && (
          <div className="w-full h-40 rounded-xl overflow-hidden bg-tertiary">
            <img src={post.feature_image.url} alt="Feature" className="w-full h-full object-cover" />
          </div>
        )}

        <div className="flex items-start justify-between gap-3">
          <h2 className="text-xl font-bold text-primary leading-tight flex-1">{post.title || <em className="text-muted font-normal">Untitled</em>}</h2>
          <StatusBadge status={post.status} />
        </div>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-2xs text-muted">
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
              <span key={tag} className="flex items-center gap-1 px-2 py-0.5 bg-tertiary border border-primary rounded-full text-2xs text-muted">
                <Tag className="w-2.5 h-2.5" />
                {tag}
              </span>
            ))}
          </div>
        )}

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={handleWorkOnPost}
            disabled={starting}
            className="flex items-center gap-2 px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring shadow-button-primary"
          >
            {starting ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Opening...
              </>
            ) : (
              <>
                <Pencil className="w-3.5 h-3.5" /> Work on this post
              </>
            )}
          </button>
          {post.status !== "published" && (
            <button
              type="button"
              onClick={handlePublish}
              disabled={publishing}
              className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-medium rounded-lg transition-colors cursor-pointer disabled:opacity-50 focus-ring"
            >
              {publishing ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Publishing...
                </>
              ) : (
                <>
                  <Globe className="w-3.5 h-3.5" /> Publish
                </>
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

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        {sanitizedHtml ? (
          <article className="prose prose-sm dark:prose-invert max-w-none text-primary" dangerouslySetInnerHTML={{ __html: sanitizedHtml }} />
        ) : (
          <div className="flex flex-col items-center justify-center h-48 text-center gap-3 text-muted">
            <BookOpen className="w-8 h-8 opacity-30" />
            <p className="text-sm">
              No content preview available.
              <br />
              Click <strong className="text-primary">Work on this post</strong> to start editing.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Post list sidebar ────────────────────────────────────────────────────────

const FILTERS: FilterTabOption<StatusFilter>[] = [
  { id: "all", label: "All" },
  { id: "draft", label: "Drafts" },
  { id: "published", label: "Published" },
];

function PostListSidebar({
  filteredPosts,
  postsData,
  statusFilter,
  postCounts,
  selectedPostId,
  search,
  launchingNew,
  provider,
  onStatusFilter,
  onSearch,
  onSelectPost,
  onNewPost,
  onRefresh,
}: {
  filteredPosts: BlogPostListItem[];
  postsData: { count: number; posts: BlogPostListItem[] } | undefined;
  statusFilter: StatusFilter;
  postCounts: Record<StatusFilter, number>;
  selectedPostId: string | null;
  search: string;
  launchingNew: boolean;
  provider: string | null;
  onStatusFilter: (f: StatusFilter) => void;
  onSearch: (q: string) => void;
  onSelectPost: (id: string) => void;
  onNewPost: () => void;
  onRefresh: () => void;
}) {
  return (
    <>
      <FilterTabs tabs={FILTERS.map(tab => ({ ...tab, count: postCounts[tab.id] }))} value={statusFilter} onChange={onStatusFilter} />

      <div className="px-3 py-2 border-b border-primary shrink-0">
        <input
          type="text"
          placeholder="Search posts..."
          value={search}
          onChange={e => onSearch(e.target.value)}
          className="w-full bg-input border border-primary rounded-lg py-1.5 px-3 text-xs text-primary placeholder-muted focus-accent transition-all"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {!provider || !postsData ? (
          <div className="flex justify-center py-10">
            <Loader2 className="w-5 h-5 text-muted animate-spin" />
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 gap-3 text-center px-4">
            <Image className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">{search ? `No posts matching "${search}"` : "No posts found"}</p>
            {!search && (
              <button
                type="button"
                onClick={onNewPost}
                disabled={launchingNew}
                className="text-xs text-accent hover:text-accent-soft cursor-pointer transition-colors"
              >
                Create your first post →
              </button>
            )}
          </div>
        ) : (
          filteredPosts.map(post => <PostListItem key={post.id} post={post} selected={post.id === selectedPostId} onClick={() => onSelectPost(post.id)} />)
        )}
      </div>

      {postsData && (
        <div className="shrink-0 border-t border-primary px-3 py-2 flex items-center justify-between">
          <span className="text-2xs text-muted">
            {filteredPosts.length} of {postsData.count} posts
          </span>
          <button
            type="button"
            onClick={onRefresh}
            className="p-1 text-muted hover:text-primary transition-colors cursor-pointer rounded focus-ring"
            title="Refresh"
          >
            <RefreshCw className="w-3 h-3" />
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
  selectedPost,
  launchingNew,
  onWorkOnPost,
  onRefresh,
  onNewPost,
}: {
  agentId: string | null;
  provider: string | null;
  selectedPost: BlogPost | null;
  launchingNew: boolean;
  onWorkOnPost: (postId: string) => Promise<void>;
  onRefresh: () => void;
  onNewPost: () => void;
}) {
  if (!agentId) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-sm">Connecting to blog service...</span>
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
  if (selectedPost) {
    return <PostViewer post={selectedPost} provider={provider} onWorkOnPost={onWorkOnPost} onRefresh={onRefresh} />;
  }
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 text-center px-6">
      <div className="w-16 h-16 rounded-2xl bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-lg">
        <BookOpen className="w-8 h-8 text-white" />
      </div>
      <div>
        <h2 className="text-base font-semibold text-primary mb-1">No post selected</h2>
        <p className="text-sm text-muted max-w-xs">Select a post from the list to view and edit it, or create a new one with an AI agent.</p>
      </div>
      <button
        type="button"
        onClick={onNewPost}
        disabled={launchingNew}
        className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-xl transition-colors cursor-pointer disabled:opacity-50 focus-ring shadow-button-primary"
      >
        {launchingNew ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" /> Starting...
          </>
        ) : (
          <>
            <FilePlus className="w-4 h-4" /> New post with agent
          </>
        )}
      </button>
    </div>
  );
}

// ─── Main BlogApp ─────────────────────────────────────────────────────────────

export default function BlogApp() {
  const { agentId, error: initError } = useHeadlessAgent({
    appName: "Blog app",
    preferredTypes: ["blog", "writer", "contentWriter", "content-writer", "managingEditor"],
    noTypesMessage: "No agent types available.",
  });
  const [chatAgentId, setChatAgentId] = useState<string | null>(null);
  const [provider, setProvider] = useState<string | null>(null);
  const [availableProviders, setAvailableProviders] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [launchingNew, setLaunchingNew] = useState(false);

  const blogState = useBlogState(agentId ?? undefined);
  const blogStateData = blogState.data?.status === "success" ? blogState.data : null;
  const posts = useBlogPosts(provider ?? undefined, statusFilter, 100);
  const selectedPost = useBlogPost(provider ?? undefined, selectedPostId ?? undefined);

  // Sync provider and available providers from blog state
  useEffect(() => {
    if (!blogStateData) return;
    const { selectedProvider, availableProviders: ap } = blogStateData;
    setAvailableProviders(ap);
    const newProvider = selectedProvider ?? ap[0];
    if (!provider && newProvider) {
      setProvider(newProvider);
    }
  }, [blogStateData, provider]);

  // Fetch blog state once agentId is ready
  useEffect(() => {
    if (!agentId) return;
    void blogState.mutate();
  }, [agentId, blogState.mutate]);

  const filteredPosts = useMemo(() => {
    const all = (posts.data?.posts ?? []) as BlogPostListItem[];
    if (!search.trim()) return all;
    const q = search.toLowerCase();
    return all.filter(p => p.title.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));
  }, [posts.data, search]);

  const launchChatAgent = async (agentType: string, postId?: string) => {
    const { id } = await agentRPCClient.createAgent({ agentType, headless: false });
    if (postId && provider) {
      try {
        await blogRPCClient.updateBlogState({ agentId: id, selectedPostId: postId, selectedProvider: provider });
      } catch {
        // Non-fatal
      }
    }
    setChatAgentId(id);
  };

  const handleWorkOnPost = async (postId: string) => {
    const types = await agentRPCClient.getAgentTypes({});
    const preferred = types.find(t => ["blog", "writer", "contentWriter", "content-writer", "managingEditor"].includes(t.type)) ?? types[0];
    if (!preferred) {
      toastManager.error("No blog agent type available", { duration: 4000 });
      return;
    }
    await launchChatAgent(preferred.type, postId);
  };

  const handleNewPost = async () => {
    setLaunchingNew(true);
    try {
      await handleWorkOnPost("");
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setLaunchingNew(false);
    }
  };

  const postCounts = useMemo(() => {
    const all = (posts.data?.posts ?? []) as BlogPostListItem[];
    return {
      all: all.length,
      draft: all.filter(p => p.status === "draft").length,
      published: all.filter(p => p.status === "published").length,
    };
  }, [posts.data]);

  if (initError) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-primary gap-4 p-6 text-center">
        <BookOpen className="w-10 h-10 text-muted opacity-40" />
        <div>
          <h2 className="text-sm font-semibold text-primary mb-1">Blog Unavailable</h2>
          <p className="text-xs text-muted max-w-sm">{initError}</p>
        </div>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="px-4 py-2 bg-accent hover:bg-accent-hover text-white text-sm font-medium rounded-lg cursor-pointer focus-ring"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      {/* App header */}
      <div className="shrink-0 h-11 border-b border-primary bg-secondary flex items-center gap-2 px-3">
        <div className="w-7 h-7 rounded-lg bg-linear-to-br from-rose-500 to-pink-600 flex items-center justify-center shadow-sm shrink-0">
          <BookOpen className="w-4 h-4 text-white" />
        </div>

        <BlogSelector
          agentId={agentId}
          provider={provider}
          availableProviders={availableProviders}
          onProviderChange={p => {
            setProvider(p);
            void posts.mutate();
          }}
        />

        <div className="flex-1" />

        <div className="w-px h-5 bg-primary/70 mx-0.5 shrink-0" aria-hidden="true" />
        <AgentLauncherBar
          buttonLabel="New post"
          buttonClassName="bg-accent hover:bg-accent-hover text-white shadow-button-primary"
          onLaunch={id => setChatAgentId(id)}
        />
      </div>

      {/* Body */}
      <div className="flex-1 min-h-0">
        {chatAgentId ? (
          <ResizableSplit direction="vertical" initialRatio={0.6} minFirst={200} minSecond={120} className="h-full">
            <div className="flex h-full min-h-0">
              <div className="w-72 shrink-0 border-r border-primary flex flex-col min-h-0 bg-secondary">
                <PostListSidebar
                  filteredPosts={filteredPosts}
                  postsData={posts.data ?? undefined}
                  statusFilter={statusFilter}
                  postCounts={postCounts}
                  selectedPostId={selectedPost.data?.post.id ?? null}
                  search={search}
                  launchingNew={launchingNew}
                  provider={provider}
                  onStatusFilter={setStatusFilter}
                  onSearch={setSearch}
                  onSelectPost={setSelectedPostId}
                  onNewPost={handleNewPost}
                  onRefresh={() => posts.mutate()}
                />
              </div>
              <div className="flex-1 min-w-0 overflow-hidden">
                <PostViewerArea
                  agentId={agentId}
                  provider={provider}
                  selectedPost={selectedPost.data?.post ?? null}
                  onWorkOnPost={handleWorkOnPost}
                  onRefresh={() => posts.mutate()}
                  onNewPost={handleNewPost}
                  launchingNew={launchingNew}
                />
              </div>
            </div>
            <div className="h-full overflow-hidden bg-primary">
              <ChatPanel agentId={chatAgentId} />
            </div>
          </ResizableSplit>
        ) : (
          <div className="flex h-full min-h-0">
            <div className="w-72 shrink-0 border-r border-primary flex flex-col min-h-0 bg-secondary">
              <PostListSidebar
                filteredPosts={filteredPosts}
                postsData={posts.data ?? undefined}
                statusFilter={statusFilter}
                postCounts={postCounts}
                selectedPostId={selectedPost.data?.post.id ?? null}
                search={search}
                launchingNew={launchingNew}
                provider={provider}
                onStatusFilter={setStatusFilter}
                onSearch={setSearch}
                onSelectPost={setSelectedPostId}
                onNewPost={handleNewPost}
                onRefresh={() => posts.mutate()}
              />
            </div>
            <div className="flex-1 min-w-0 overflow-hidden">
              <PostViewerArea
                agentId={agentId}
                provider={provider}
                selectedPost={selectedPost.data?.post ?? null}
                onWorkOnPost={handleWorkOnPost}
                onRefresh={() => posts.mutate()}
                onNewPost={handleNewPost}
                launchingNew={launchingNew}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
