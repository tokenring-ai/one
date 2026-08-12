import { formatRelativeTime } from "@tokenring-ai/utility/date/formatRelativeTime";
import { formatTimestamp } from "@tokenring-ai/utility/date/formatTimestamp";
import { Activity, Bot, Cpu, Hash, Loader2, Plug, PlugZap, RotateCcw, Send, User } from "lucide-react";
import { getServiceBrand } from "../../lib/serviceGradient.ts";
import { cn } from "../../lib/utils.ts";
import StatusBadge from "./StatusBadge.tsx";

export interface ConversationRowData {
  key: string;
  channelName?: string | undefined;
  conversationId: string;
  service: string;
  busy: boolean;
  lastActivityAt: number | null;
  /** When provided (including null), a "Started …" meta line is shown. */
  startedAt?: number | null | undefined;
  agentId: string;
  agentType: string;
  /** Optional: displayed when the row is in a cross-bot context */
  botDisplayName?: string | undefined;
}

export interface ConversationRowProps {
  /** Conversation data */
  conversation: ConversationRowData;
  /** Whether the service is currently connected */
  connected: boolean;
  /**
   * Currently executing action key (for loading states).
   * Reset loading is detected when this equals `reset:${conversation.key}`.
   */
  busyAction?: string | null;
  /** Open the agent handling this conversation */
  onOpenAgent: () => void;
  /** Send a message to this conversation */
  onMessage: () => void;
  /** Reset the conversation (optional — omit in read-only / cross-bot lists) */
  onReset?: () => void;
  className?: string;
  "data-testid"?: string;
}

function ServicePill({ service, connected }: { service: string; connected: boolean }) {
  const brand = getServiceBrand(service);
  const label = brand.displayName;
  return (
    <StatusBadge
      label={label}
      icon={connected ? <PlugZap className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
      colorClass={connected ? cn(brand.solidBg, brand.solidText, brand.solidBorder) : "bg-tertiary text-muted border-primary"}
      title={connected ? `${label} is connected` : `${label} is not connected`}
    />
  );
}

/**
 * List row for a bot conversation: channel / DM identity, busy indicator,
 * service connection pill, optional bot name, agent type, activity times,
 * and action buttons (Open Agent, Message, optional Reset).
 */
export default function ConversationRow({
  conversation,
  connected,
  busyAction = null,
  onOpenAgent,
  onMessage,
  onReset,
  className,
  "data-testid": testId,
}: ConversationRowProps) {
  const resetting = onReset != null && busyAction === `reset:${conversation.key}`;
  const showStarted = conversation.startedAt !== undefined;

  return (
    <div className={cn("px-4 py-3 hover:bg-hover/30 transition-colors", className)} data-testid={testId}>
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-primary truncate">{conversation.channelName ?? conversation.conversationId}</span>
            {conversation.channelName ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <Hash className="w-3 h-3" /> {conversation.conversationId}
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted">
                <User className="w-3 h-3" /> Direct
              </span>
            )}
            {conversation.busy ? (
              <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                <Activity className="w-3 h-3 animate-pulse" /> Working
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
            <ServicePill service={conversation.service} connected={connected} />
            {conversation.botDisplayName ? (
              <span className="inline-flex items-center gap-1">
                <Bot className="w-3 h-3" /> {conversation.botDisplayName}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> {conversation.agentType}
            </span>
            <span title={formatTimestamp(conversation.lastActivityAt)}>Active {formatRelativeTime(conversation.lastActivityAt, { future: false })}</span>
            {showStarted ? (
              <span title={formatTimestamp(conversation.startedAt)}>Started {formatRelativeTime(conversation.startedAt, { future: false })}</span>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAgent}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
            title="Open the agent handling this conversation"
          >
            <Cpu className="w-3 h-3" /> Agent
          </button>
          <button
            type="button"
            onClick={onMessage}
            disabled={!connected}
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            title={connected ? "Send a message here" : "Service is offline"}
          >
            <Send className="w-3 h-3" /> Message
          </button>
          {onReset ? (
            <button
              type="button"
              onClick={onReset}
              disabled={resetting}
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-error border border-primary hover:bg-error/5 rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50"
              title="Delete this conversation's agent"
            >
              {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Reset
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
