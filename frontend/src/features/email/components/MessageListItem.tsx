import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { cn } from "../../../lib/utils.ts";
import { messageTimestamp, senderName } from "../utils.ts";

export default function MessageListItem({ msg, selected, onClick }: { msg: EmailMessage; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "relative w-full flex flex-col gap-1 px-3 py-3 text-left border-b border-primary hover:bg-hover transition-colors focus-ring cursor-pointer border-l-2",
        selected ? "bg-active border-l-red-500" : "border-l-transparent",
      )}
      aria-current={selected ? "true" : undefined}
    >
      <div className="flex items-center justify-between gap-2 pr-3">
        <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
        <span className="text-xs text-muted shrink-0">{formatDate(messageTimestamp(msg))}</span>
      </div>
      <span className={cn("text-xs truncate", msg.isRead ? "text-muted" : "text-secondary font-medium")}>{msg.subject || "(no subject)"}</span>
      {msg.snippet && <span className="text-xs text-muted truncate">{msg.snippet}</span>}
      {!msg.isRead && <span className="w-1.5 h-1.5 rounded-full bg-blue-500 absolute right-3 top-3" aria-hidden="true" />}
    </button>
  );
}
