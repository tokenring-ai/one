import type { AgentEventEnvelope } from "@tokenring-ai/agent/AgentEvents";
import { ChevronDown } from "lucide-react";
import { useState } from "react";

export default function ToolCallDisplay({ msg }: { msg: Extract<AgentEventEnvelope, { type: "toolCall" }> }) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <div className="cursor-pointer" onClick={() => setIsExpanded(!isExpanded)}>
      <button type="button" className="flex items-center gap-1.5 w-full text-left hover:opacity-80 transition-opacity">
        <span className="text-primary font-medium">{msg.summary}</span>
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
            <span className="text-secondary whitespace-pre-wrap wrap-break-word">{msg.result}</span>
          </div>
        )}
      </div>
    </div>
  );
}
