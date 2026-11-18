import type { ChatAttachment } from "@tokenring-ai/agent/AgentEvents";
import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import { Check, Copy, GitBranch, Pencil } from "lucide-react";
import type { ReactNode } from "react";
import AttachmentChip from "../../../../components/chat/AttachmentChip.tsx";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard.ts";

/** The `from` the web chat sends; anything else (a bot, a workflow, another agent) is named. */
export const WEB_CHAT_SOURCE = "Chat webapp user";

const actionClass =
  "grid h-6 w-6 place-items-center rounded text-muted transition-colors hover:bg-hover hover:text-fg focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed";

/**
 * A message someone sent the agent: a quiet card aligned with the agent's text,
 * the sender and time on one line, attachments as chips, and the actions
 * (copy, edit, branch) revealed on hover or focus.
 */
export default function UserMessage({
  text,
  source,
  timestamp,
  attachments,
  body,
  onEdit,
  onBranch,
}: {
  text: string;
  source: string | null;
  timestamp: number;
  attachments: readonly ChatAttachment[];
  /** The rendered message text (markdown). */
  body: ReactNode;
  onEdit?: (() => void) | undefined;
  onBranch?: (() => void) | undefined;
}) {
  const { copy, copied } = useCopyToClipboard();
  const sender = !source || source === WEB_CHAT_SOURCE ? "You" : source;
  return (
    <div className="group px-3 py-2">
      <div className="ml-9 rounded-lg border border-line-subtle bg-raised px-3 py-2 shadow-xs" role="article" aria-label={`Message from ${sender}`}>
        <div className="flex min-w-0 items-center gap-2">
          <span className="truncate text-xs font-medium text-fg">{sender}</span>
          <span className="text-xs tabular-nums text-muted">{formatTime(timestamp)}</span>
          <span className="ml-auto flex shrink-0 items-center gap-0.5 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
            {text && (
              <button type="button" onClick={() => void copy(text)} className={actionClass} title="Copy message" aria-label="Copy message">
                {copied ? <Check className="h-3.5 w-3.5 text-success" /> : <Copy className="h-3.5 w-3.5" />}
              </button>
            )}
            {onEdit && (
              <button type="button" onClick={onEdit} className={actionClass} title="Load this message into the composer" aria-label="Edit and resend message">
                <Pencil className="h-3.5 w-3.5" />
              </button>
            )}
            {onBranch && (
              <button
                type="button"
                onClick={onBranch}
                className={actionClass}
                title="Branch: a new agent with the conversation before this message, and this message in its box to edit"
                aria-label="Branch from before this message"
              >
                <GitBranch className="h-3.5 w-3.5" />
              </button>
            )}
          </span>
        </div>
        {text && <div className="mt-1 text-sm text-fg">{body}</div>}
        {attachments.length > 0 && (
          <ul className="mt-2 flex flex-wrap gap-1.5" aria-label="Attachments">
            {attachments.map((attachment, index) => (
              <AttachmentChip key={`${attachment.name}-${index}`} attachment={attachment} variant="pill" />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
