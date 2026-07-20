import { formatTime } from "@tokenring-ai/utility/date/formatTime";
import markdownList from "@tokenring-ai/utility/string/markdownList";
import { Check, Copy, Download } from "lucide-react";
import type React from "react";
import { useState } from "react";
import type { ChatMessage } from "../../../../types/agent-events.ts";
import { getMessageDetails, getMessageText } from "../messageUtils.ts";

export default function MessageFooter({ msg, onDownload }: { msg: ChatMessage; onDownload?: () => void }) {
  const [copied, setCopied] = useState(false);

  const messageText = getMessageText(msg);
  const details = getMessageDetails(msg);
  const copyText = messageText && details.length > 0 ? `${messageText}\n${markdownList(details)}` : messageText;

  const handleCopy = async () => {
    try {
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- can be undefined, TS is wrong
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(copyText!);
      } else {
        const ta = document.createElement("textarea");
        ta.value = copyText!;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      void handleCopy();
    }
  };

  return (
    <div className="flex flex-row items-center gap-3 pt-1 text-xs text-muted font-mono">
      {copyText && (
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
              <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 bg-success text-primary text-2xs px-2 py-1 rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                Copied!
              </span>
            </>
          ) : (
            <Copy className="w-3.5 h-3.5 text-muted group-hover:text-primary" />
          )}
        </button>
      )}
      {onDownload && (
        <button type="button" onClick={onDownload} className="transition-colors focus-ring rounded-md" title="Download">
          <Download className="w-3.5 h-3.5 text-muted hover:text-primary" />
        </button>
      )}
      {formatTime(msg.timestamp)}
    </div>
  );
}
