import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

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
      </button>
      {isExpanded && (
        <div className="mt-1.5 ml-5 pl-2 border-l border-primary/20 prose prose-sm dark:prose-invert text-secondary italic">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{message}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
