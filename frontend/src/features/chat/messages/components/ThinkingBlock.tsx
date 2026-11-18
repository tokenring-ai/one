import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { markdownLinkComponents } from "../../../../components/chat/MarkdownLink.tsx";

interface ThinkingBlockProps {
  message: string;
}

export default function ThinkingBlock({ message }: ThinkingBlockProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="not-prose">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[13px] text-dim hover:text-muted transition-colors focus:outline-none select-none w-full text-left"
      >
        <ChevronDown size={13} className={`shrink-0 transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
        <span className="italic">{isExpanded ? "Thinking" : "Thinking ..."}</span>
        <span className="ml-auto shrink-0 tabular-nums font-mono text-xs">{message.length.toLocaleString()} chars</span>
      </button>
      {isExpanded && (
        <div className="mt-1.5 w-full max-w-none max-h-[300px] overflow-y-auto overscroll-contain">
          <div className="prose prose-sm dark:prose-invert text-secondary italic">
            <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownLinkComponents}>
              {message}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
