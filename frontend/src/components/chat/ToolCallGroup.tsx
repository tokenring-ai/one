import { ChevronRight, Wrench } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "../../lib/utils.ts";
import type { ChatMessage } from "../../types/agent-events.ts";

type ToolCallMessage = Extract<ChatMessage, { type: "toolCall" }>;

/** Shortest run of consecutive tool calls folded into one row. */
export const TOOL_GROUP_MIN = 3;

/**
 * A run of consecutive tool calls as one row ("Ran 12 tools"), so the
 * assistant's prose isn't buried. A finished run starts collapsed; the run
 * still in progress starts open so you can watch it.
 */
export default function ToolCallGroup({
  calls,
  live,
  renderCall,
}: {
  calls: ToolCallMessage[];
  live: boolean;
  renderCall: (call: ToolCallMessage) => ReactNode;
}) {
  const [open, setOpen] = useState(live);
  const failed = calls.filter(call => call.failed).length;
  const names = [...new Set(calls.map(call => call.name))];
  const summary = `Ran ${calls.length} tools${failed ? ` · ${failed} failed` : ""}`;
  return (
    <div className="px-3 py-1">
      <button
        type="button"
        onClick={() => setOpen(on => !on)}
        aria-expanded={open}
        className="flex w-full min-w-0 items-center gap-3 rounded py-1 text-left text-sm text-secondary hover:text-primary focus-ring"
      >
        <span className="flex w-6 shrink-0 justify-center text-dim" aria-hidden="true">
          <Wrench className="h-3.5 w-3.5" />
        </span>
        <ChevronRight className={cn("h-3.5 w-3.5 shrink-0 text-dim transition-transform", open && "rotate-90")} aria-hidden="true" />
        <span className={cn("shrink-0", failed && "text-error")}>{summary}</span>
        <span className="min-w-0 truncate text-xs text-dim">
          {names.slice(0, 4).join(", ")}
          {names.length > 4 ? ", …" : ""}
        </span>
      </button>
      {open && <div className="ml-3 border-l border-line-subtle">{calls.map(call => renderCall(call))}</div>}
    </div>
  );
}
