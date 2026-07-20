import markdownList from "@tokenring-ai/utility/string/markdownList";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function MessageDetails({ details }: { details: string[] }) {
  const [isExpanded, setIsExpanded] = useState(false);
  if (details.length === 0) return null;

  return (
    <div className="not-prose my-1">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center gap-1.5 text-[11px] font-mono text-dim hover:text-muted transition-colors focus:outline-none select-none"
      >
        <ChevronDown size={10} className={`transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`} />
        {isExpanded ? "hide details" : "details"}
      </button>
      {isExpanded && (
        <div className="mt-1 prose prose-sm dark:prose-invert">
          <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdownList(details)}</ReactMarkdown>
        </div>
      )}
    </div>
  );
}
