import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import { Check, Copy, Download, GitBranch } from "lucide-react";
import type React from "react";
import { useCopyToClipboard } from "../../../../hooks/useCopyToClipboard.ts";
import type { TurnUsage } from "../../../../hooks/usePerTurnUsage.ts";
import type { ChatMessage } from "../../../../types/agent-events.ts";
import { getMessageDetails, getMessageText } from "../messageUtils.ts";

export default function MessageFooter({
  msg,
  onDownload,
  usage,
  onBranch,
}: {
  msg: ChatMessage;
  onDownload?: () => void;
  usage?: TurnUsage;
  /** Start a new agent from the conversation as it stands after this reply. */
  onBranch?: () => void;
}) {
  const { copy, copied } = useCopyToClipboard();

  const messageText = getMessageText(msg);
  const details = getMessageDetails(msg);
  const textToCopy = messageText && details.length > 0 ? `${messageText}\n${markdownList(details)}` : messageText;

  const handleCopy = async () => {
    if (!textToCopy) return;
    await copy(textToCopy);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleCopy();
    }
  };

  return (
    // Copy, branch and the time appear with the pointer or keyboard focus, so the transcript reads as conversation.
    // Always visible on touch-sized screens, where nothing hovers.
    <div className="flex flex-row items-center gap-3 pt-1 text-xs text-muted tabular-nums transition-opacity md:opacity-0 md:group-hover:opacity-100 md:group-focus-within:opacity-100">
      {textToCopy && (
        <button
          type="button"
          onClick={handleCopy}
          onKeyDown={handleKeyDown}
          className="relative cursor-pointer transition-colors group focus-ring rounded-md flex items-center gap-1.5 hover:text-primary"
          title={copied ? "Copied!" : "Copy message to clipboard"}
          aria-label={copied ? "Message copied to clipboard" : "Copy message to clipboard"}
        >
          {copied ? (
            <>
              <Check className="w-3.5 h-3.5 text-success" />
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-success text-primary text-xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Copied!
              </span>
            </>
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted group-hover:text-primary" />
          )}
        </button>
      )}
      {onBranch && (
        <button
          type="button"
          onClick={onBranch}
          className="flex items-center rounded-md transition-colors hover:text-primary focus-ring"
          title="Branch: a new agent with the conversation up to here"
          aria-label="Branch from here"
        >
          <GitBranch className="h-3.5 w-3.5" />
        </button>
      )}
      {onDownload && (
        <button type="button" onClick={onDownload} className="transition-colors focus-ring rounded-md" title="Download">
          <Download className="w-3.5 h-3.5 text-muted hover:text-primary" />
        </button>
      )}
      {usage && usage.costTotal > 0 && (
        <span
          className="text-muted tabular-nums"
          title={`This response cost ${usage.costTotal.toFixed(4)} USD · ${usage.totalTokens.toLocaleString()} tokens`}
        >
          ${usage.costTotal < 0.01 ? usage.costTotal.toFixed(4) : usage.costTotal.toFixed(3)} · {usage.totalTokens.toLocaleString()} tok
        </span>
      )}
      {formatTime(msg.timestamp)}
    </div>
  );
}
