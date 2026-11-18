import type { AgentEventEnvelope, ParsedToolCallAttachment } from "@tokenring-ai/agent/AgentEvents";
import { AlertTriangle, ChevronDown, Paperclip } from "lucide-react";
import { useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import AttachmentChip from "../../../../components/chat/AttachmentChip";
import { markdownLinkComponents } from "../../../../components/chat/MarkdownLink.tsx";

/** Human-readable label for an arg key ("file_path" → "File path"). */
function argLabel(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

/** Compact one-line rendering of a JSON value for the args grid. */
function formatArgValue(value: unknown): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

/** Long values (file contents, big arrays) collapse to a toggleable block. */
function isLargeValue(rendered: string): boolean {
  return rendered.length > 120 || rendered.includes("\n");
}

function ToolArg({ name, value }: { name: string; value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const rendered = useMemo(() => formatArgValue(value), [value]);
  const large = isLargeValue(rendered);

  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-2">
      <span className="shrink-0 text-[11px] font-semibold uppercase tracking-wide text-dim sm:w-32 sm:truncate sm:text-right" title={name}>
        {argLabel(name)}
      </span>
      {large ? (
        <span className="min-w-0 flex-1">
          <button
            type="button"
            onClick={e => {
              e.stopPropagation();
              setExpanded(on => !on);
            }}
            className="text-xs font-mono text-accent hover:text-accent-soft focus-ring rounded"
            aria-expanded={expanded}
          >
            {expanded ? "Hide" : "Show"} {rendered.split("\n").length > 1 ? `${rendered.split("\n").length} lines` : `${rendered.length} chars`}
          </button>
          {expanded && (
            <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap break-words rounded bg-tertiary p-2 text-xs font-mono text-secondary border border-primary">
              {rendered}
            </pre>
          )}
        </span>
      ) : (
        <span className="min-w-0 flex-1 break-words font-mono text-xs text-secondary">{rendered}</span>
      )}
    </div>
  );
}

export default function ToolCallDisplay({ msg }: { msg: Extract<AgentEventEnvelope, { type: "toolCall" }> }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const argEntries = useMemo(() => Object.entries(msg.args), [msg.args]);
  const attachments: ParsedToolCallAttachment[] = useMemo(() => msg.attachments ?? [], [msg.attachments]);

  return (
    <div>
      {/* The button alone toggles, so selecting text in the details never collapses them. */}
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        aria-expanded={isExpanded}
        className="flex items-center gap-1.5 w-full text-left rounded hover:opacity-80 transition-opacity focus-ring"
      >
        {msg.failed && (
          <span className="flex items-center gap-1 shrink-0 rounded bg-error/10 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-error">
            <AlertTriangle className="w-3 h-3" aria-hidden="true" />
            Failed
          </span>
        )}
        <div className={`prose prose-sm dark:prose-invert ${msg.failed ? "text-error" : "text-secondary"}`}>
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={{ ...markdownLinkComponents, p: ({ children }) => <>{children}</> }}>
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
            <span className="px-1 shrink-0 text-dim">└</span>
            {action}
          </div>
        ))}
        {attachments.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <span className="flex items-center gap-1 text-[11px] text-dim">
              <Paperclip className="w-3 h-3" aria-hidden="true" />
              {attachments.length} attachment{attachments.length !== 1 ? "s" : ""}
            </span>
            {attachments.map((attachment, index) => (
              <AttachmentChip key={`${attachment.name}-${index}`} attachment={attachment} />
            ))}
          </div>
        )}
        {isExpanded && argEntries.length > 0 && (
          <div className="mt-2 space-y-1.5 rounded-md border border-primary bg-tertiary/50 p-2.5" role="group" aria-label={`Arguments for ${msg.name}`}>
            <div className="text-[10px] font-semibold uppercase tracking-widest text-dim">{msg.name} arguments</div>
            {argEntries.map(([key, value]) => (
              <ToolArg key={key} name={key} value={value} />
            ))}
          </div>
        )}
        {isExpanded && msg.result && (
          <div className="flex gap-1.5 prose-sm text-muted mt-1">
            <span className="whitespace-pre-wrap wrap-break-word">{msg.result}</span>
          </div>
        )}
      </div>
    </div>
  );
}
