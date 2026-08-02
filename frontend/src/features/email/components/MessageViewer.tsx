import type { EmailMessage } from "@tokenring-ai/email";
import { AlertCircle, Bot, Clock, Forward, Loader2, Mail, Reply, ReplyAll } from "lucide-react";
import { useEmailMessage } from "../../../rpc.ts";
import type { ComposeMode } from "../types.ts";
import { formatAddress, formatAddressList, messageTimestamp, senderName } from "../utils.ts";

export default function MessageViewer({
  provider,
  messageId,
  onReply,
  onCompose,
}: {
  provider: string;
  messageId: string;
  onReply: (cmd: string) => void;
  onCompose: (mode: Exclude<ComposeMode, "compose">, message: EmailMessage) => void;
}) {
  const { data, isLoading, error, mutate } = useEmailMessage(provider, messageId);
  const msg = data?.email;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-5 h-5 text-muted animate-spin" />
      </div>
    );
  }

  if (error || !msg) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-muted p-6 text-center">
        <AlertCircle className="w-8 h-8 opacity-30" />
        <p className="text-sm">Could not load message.</p>
        {error && (
          <button type="button" onClick={() => void mutate()} className="text-2xs text-accent hover:text-accent-soft cursor-pointer focus-ring">
            Retry
          </button>
        )}
      </div>
    );
  }

  const displayTimestamp = messageTimestamp(msg);

  return (
    <div className="h-full flex flex-col overflow-hidden">
      <div className="shrink-0 px-5 pt-5 pb-4 border-b border-primary space-y-3">
        <h2 className="text-base font-semibold text-primary leading-tight">{msg.subject || "(no subject)"}</h2>
        <div className="space-y-1 text-xs text-muted">
          <div className="flex gap-2">
            <span className="font-medium text-secondary w-8 shrink-0">From</span>
            <span className="min-w-0 break-all">{formatAddress(msg.from)}</span>
          </div>
          {msg.to.length > 0 && (
            <div className="flex gap-2">
              <span className="font-medium text-secondary w-8 shrink-0">To</span>
              <span className="truncate min-w-0">{formatAddressList(msg.to)}</span>
            </div>
          )}
          {msg.cc && msg.cc.length > 0 && (
            <div className="flex gap-2">
              <span className="font-medium text-secondary w-8 shrink-0">Cc</span>
              <span className="truncate min-w-0">{formatAddressList(msg.cc)}</span>
            </div>
          )}
          <div className="flex gap-2">
            <span className="font-medium text-secondary w-8 shrink-0">Date</span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {displayTimestamp != null ? new Date(displayTimestamp).toLocaleString() : "—"}
            </span>
          </div>
        </div>
        {msg.labels && msg.labels.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {msg.labels.map(l => (
              <span key={l} className="px-2 py-0.5 bg-tertiary border border-primary rounded-full text-2xs text-muted">
                {l}
              </span>
            ))}
          </div>
        )}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => onCompose("reply", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-500 text-white rounded-lg text-xs font-medium transition-all focus-ring cursor-pointer shadow-button-primary"
          >
            <Reply className="w-3.5 h-3.5" /> Reply
          </button>
          <button
            type="button"
            onClick={() => onCompose("replyAll", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <ReplyAll className="w-3.5 h-3.5" /> Reply all
          </button>
          <button
            type="button"
            onClick={() => onCompose("forward", msg)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Forward className="w-3.5 h-3.5" /> Forward
          </button>
          <button
            type="button"
            onClick={() => onReply(`Reply to the email from ${senderName(msg)} with subject "${msg.subject}"`)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-secondary border border-primary rounded-lg text-xs text-muted hover:text-primary hover:bg-hover transition-all focus-ring cursor-pointer"
          >
            <Bot className="w-3.5 h-3.5" /> Reply with AI
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-white dark:bg-zinc-950">
        {msg.htmlBody ? (
          <iframe srcDoc={msg.htmlBody} className="w-full h-full min-h-[20rem] border-0" sandbox="allow-same-origin" title="Email content" />
        ) : msg.textBody ? (
          <pre className="text-xs text-primary whitespace-pre-wrap font-sans leading-relaxed p-5">{msg.textBody}</pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted">
            <Mail className="w-6 h-6 opacity-30" />
            <p className="text-sm">No body content.</p>
          </div>
        )}
      </div>
    </div>
  );
}
