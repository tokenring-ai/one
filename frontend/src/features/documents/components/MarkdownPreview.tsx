import { Eye } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export interface MarkdownPreviewProps {
  content: string;
}

export default function MarkdownPreview({ content }: MarkdownPreviewProps) {
  return (
    <div className="flex-1 overflow-y-auto">
      {/* Panel label */}
      <div className="shrink-0 px-4 py-3 border-b border-primary flex items-center gap-2">
        <Eye className="w-4 h-4 text-muted shrink-0" />
        <span className="text-sm font-semibold text-primary">Preview</span>
      </div>
      <div className="p-5">
        <article
          className="prose prose-sm dark:prose-invert max-w-none
          prose-headings:text-primary prose-p:text-secondary prose-code:text-primary
          prose-a:text-accent prose-strong:text-primary prose-blockquote:text-muted
          prose-code:bg-tertiary prose-code:rounded prose-code:px-1 prose-code:py-0.5
          prose-pre:bg-tertiary prose-pre:border prose-pre:border-primary"
        >
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
        </article>
      </div>
    </div>
  );
}
