import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { ArrowRight, ExternalLink, Inbox, WifiOff } from "lucide-react";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import { cn } from "../../lib/utils.ts";
import { senderName } from "./messagingShared.tsx";

export default function EmailPanel({
  provider,
  providers,
  messages,
  loading,
  providersError,
  error,
  onOpenEmail,
  onOpenMessage,
  onOpenConfig,
  onRetry,
}: {
  provider: string | undefined;
  providers: string[];
  messages: EmailMessage[];
  loading: boolean;
  providersError: unknown;
  error: unknown;
  onOpenEmail: () => void;
  /** Opens one message in the Email app. */
  onOpenMessage: (message: EmailMessage) => void;
  onOpenConfig: () => void;
  onRetry: () => void;
}) {
  if (loading) {
    return <LoadingState className="py-12" />;
  }

  if (providersError) {
    return <ErrorState title="Could not load email providers" error={providersError} onRetry={onRetry} />;
  }

  if (providers.length === 0) {
    return (
      <EmptyState
        icon={WifiOff}
        title="No email providers configured"
        hint="Add an email provider in configuration, then open the Email app for the full inbox experience."
        action={
          <button
            type="button"
            onClick={onOpenConfig}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary rounded-lg text-muted hover:text-primary focus-ring cursor-pointer"
          >
            Open configuration <ArrowRight className="w-3.5 h-3.5" />
          </button>
        }
      />
    );
  }

  // Prefer cached messages over a revalidation error when the inbox already loaded.
  if (error && messages.length === 0) {
    return <ErrorState title="Could not load inbox" error={error} onRetry={onRetry} />;
  }

  if (messages.length === 0) {
    return (
      <EmptyState
        icon={Inbox}
        title="Inbox is empty"
        hint={`No recent messages from ${provider ?? "your provider"}.`}
        action={
          <button
            type="button"
            onClick={onOpenEmail}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary rounded-lg text-muted hover:text-primary focus-ring cursor-pointer"
          >
            Open Email app <ExternalLink className="w-3.5 h-3.5" />
          </button>
        }
      />
    );
  }

  return (
    <div>
      <div className="px-4 py-2 border-b border-primary flex items-center justify-between gap-2 bg-tertiary/30">
        <span className="text-xs text-muted">
          Showing recent messages from <span className="text-primary font-medium">{provider}</span>
          {providers.length > 1 ? ` · ${providers.length} providers` : ""}
        </span>
        <button
          type="button"
          onClick={onOpenEmail}
          className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary focus-ring rounded cursor-pointer"
        >
          Full inbox <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      <div className="divide-y divide-primary">
        {messages.map(msg => (
          <button
            key={msg.id}
            type="button"
            onClick={() => onOpenMessage(msg)}
            className="w-full px-4 py-3 text-left hover:bg-hover/30 transition-colors focus-ring cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
              <span className="text-xs text-muted shrink-0">{formatDate(msg.receivedAt)}</span>
            </div>
            <p className={cn("text-xs truncate mt-0.5", msg.isRead ? "text-muted" : "text-secondary font-medium")}>{msg.subject || "(no subject)"}</p>
            {msg.snippet ? <p className="text-xs text-muted truncate mt-0.5">{msg.snippet}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}
