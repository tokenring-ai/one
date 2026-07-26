import type { AgentEventEnvelope } from "@tokenring-ai/agent/AgentEvents";
import { ChevronDown } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

export default function ToolCallDisplay({ msg }: { msg: Extract<AgentEventEnvelope, { type: "toolCall" }> }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
      <button type="button" className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity">
        <div className={`text-primary font-medium prose prose-sm dark:prose-invert ${msg.failed ? "text-error" : "text-success"}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ p: ({ children }) => <>{children}</> }}>
            {msg.message}
          </ReactMarkdown>
        </div>
        <div className={`mr-auto transition-transform duration-150 ${isExpanded ? "rotate-0" : "-rotate-90"}`}>
          <ChevronDown size={13} className="text-dim" />
        </div>
      </button>
      <div className="mb-2 space-y-1">
        {msg.actions?.map((action, i) => (
          <div key={i} className="text-xs text-secondary">
            <span className="px-1 shrink-0 text-stone-400 dark:text-neutral-500">└</span>
            {action}
          </div>
        ))}
        {isExpanded && msg.result && (
          <div className="flex gap-1.5 prose-sm text-muted mt-1">
            <span className="whitespace-pre-wrap wrap-break-word">{msg.result}</span>
          </div>
        )}
      </div>
    </div>
  );
}
