import { Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownLinkComponents } from "../../../components/chat/MarkdownLink.tsx";

export interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  const isEmpty = !content.trim();

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Panel label */}
      <div className="shrink-0 px-4 py-3 border-b border-primary flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted shrink-0" />
        <span className="text-sm font-semibold text-primary">Preview</span>
      </div>
      <div className="flex-1 overflow-y-auto p-5 min-h-0">
        {isEmpty ? (
          <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
            <Eye className="w-8 h-8 text-muted opacity-30" />
            <p className="text-sm text-muted">Nothing to preview</p>
            <p className="text-xs text-dim">Start writing markdown in the editor</p>
          </div>
        ) : (
          <article
            className="prose prose-sm dark:prose-invert max-w-none
            prose-headings:text-primary prose-p:text-secondary prose-code:text-primary
            prose-a:text-accent prose-strong:text-primary prose-blockquote:text-muted
            prose-code:bg-tertiary prose-code:rounded prose-code:px-1 prose-code:py-0.5
            prose-pre:bg-tertiary prose-pre:border prose-pre:border-primary"
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>
              {content}
            </ReactMarkdown>
          </article>
        )}
      </div>
    </div>
  );
}
