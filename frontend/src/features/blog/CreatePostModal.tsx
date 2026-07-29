import formatError from "@tokenring-ai/utility/error/formatError";
import { FilePlus, Loader2, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toastManager } from "../../components/ui/toast.tsx";
import { blogRPCClient } from "../../rpc.ts";
import { parseTagsInput } from "./constants.ts";

export interface CreatePostModalProps {
  provider: string;
  onClose: () => void;
  onCreated: (postId: string) => void;
}

export default function CreatePostModal({ provider, onClose, onCreated }: CreatePostModalProps) {
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [saving, setSaving] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleSubmit = async () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      toastManager.error("Title is required", { duration: 3000 });
      return;
    }
    setSaving(true);
    try {
      const parsedTags = parseTagsInput(tags);
      const result = await blogRPCClient.createPost({
        provider,
        title: trimmedTitle,
        contentInMarkdown: content.trim() || `# ${trimmedTitle}\n\n`,
        ...(parsedTags.length > 0 ? { tags: parsedTags } : {}),
      });
      toastManager.success(result.message || "Post created", { duration: 3000 });
      onCreated(result.post.id);
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4" onClick={onClose}>
      <div
        className="bg-secondary border border-primary rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="create-post-title"
      >
        <div className="flex items-center justify-between px-5 pt-5 pb-0">
          <h2 id="create-post-title" className="text-base font-bold text-primary">
            New post
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg hover:bg-hover transition-colors text-muted hover:text-primary cursor-pointer focus-ring"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          <p className="text-2xs text-muted">
            Creating on <span className="font-medium text-primary">{provider}</span>
          </p>

          <div>
            <label htmlFor="create-post-title-input" className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Title
            </label>
            <input
              id="create-post-title-input"
              ref={titleRef}
              value={title}
              onChange={e => setTitle(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleSubmit();
                }
                if (e.key === "Escape") onClose();
              }}
              placeholder="Post title…"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus-accent transition-colors"
            />
          </div>

          <div>
            <label htmlFor="create-post-content" className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Content <span className="font-normal normal-case tracking-normal">(Markdown)</span>
            </label>
            <textarea
              id="create-post-content"
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={8}
              placeholder="Write your post in Markdown…"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus-accent transition-colors resize-y min-h-32 font-mono"
            />
          </div>

          <div>
            <label htmlFor="create-post-tags" className="text-2xs font-semibold text-muted uppercase tracking-wider block mb-1">
              Tags <span className="font-normal normal-case tracking-normal">(comma-separated)</span>
            </label>
            <input
              id="create-post-tags"
              value={tags}
              onChange={e => setTags(e.target.value)}
              placeholder="news, product, launch"
              className="w-full bg-input border border-primary rounded-lg px-3 py-2 text-sm text-primary placeholder-muted focus-accent transition-colors"
            />
          </div>

          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className="flex-1 py-2 border border-primary text-muted hover:text-primary hover:bg-hover text-xs font-medium rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleSubmit()}
              disabled={saving || !title.trim()}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-accent hover:bg-accent-hover text-white text-xs font-semibold rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-button-primary"
            >
              {saving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Creating…
                </>
              ) : (
                <>
                  <FilePlus className="w-3.5 h-3.5" /> Create draft
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
