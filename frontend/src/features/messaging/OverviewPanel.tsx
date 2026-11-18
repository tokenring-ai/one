import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import { Activity, Bot, Inbox, Loader2, Mail, MessagesSquare, Send, Sparkles, WifiOff } from "lucide-react";
import { useId, useState } from "react";
import BusySpinner from "../../components/ui/BusySpinner.tsx";
import ChannelStatusCard from "../../components/ui/ChannelStatusCard.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import LoadingState from "../../components/ui/LoadingState.tsx";
import SectionLabel from "../../components/ui/SectionLabel.tsx";
import { cn } from "../../lib/utils.ts";
import Select from "../../ui/select.tsx";
import MissingAgentTypeNotice from "../agents/MissingAgentTypeNotice.tsx";
import { formatRelativeTime, formatTimestamp } from "./formatters.ts";
import { type LiveConversation, ServicePill, senderName } from "./messagingShared.tsx";

export default function OverviewPanel({
  channelCards,
  liveConversations,
  emailMessages,
  emailProvider,
  emailLoading,
  emailError,
  emailProvidersFailed,
  emailProvidersLoading,
  messagingAgents,
  servicesConnected,
  botsCount,
  providersCount,
  onOpenConversation,
  onQuickSend,
  canSend,
  connectedServices,
  onOpenEmail,
  onOpenEmailMessage,
  onOpenBots,
  onOpenAgent,
  onLaunchAgent,
  onRetryEmail,
  creatingAgent,
  messagingAgentType,
  messagingAgentTypes,
  agentTypeOptions,
  agentTypesLoaded,
}: {
  channelCards: Array<{ id: string; name: string; kind: "messaging" | "email"; connected: boolean; detail: string; href: string }>;
  liveConversations: LiveConversation[];
  emailMessages: EmailMessage[];
  emailProvider: string | undefined;
  emailLoading: boolean;
  emailError: unknown;
  emailProvidersFailed: boolean;
  emailProvidersLoading: boolean;
  messagingAgents: Array<{ id: string; displayName: string; currentActivity: string; agentType: string }>;
  servicesConnected: number;
  botsCount: number;
  providersCount: number;
  onOpenConversation: (agentId: string) => void;
  onQuickSend: () => void;
  canSend: boolean;
  connectedServices: Set<string>;
  onOpenEmail: () => void;
  /** Opens one message in the Email app. */
  onOpenEmailMessage: (message: EmailMessage) => void;
  onOpenBots: () => void;
  onOpenAgent: (id: string) => void;
  /** Launches the given type, or the configured messaging type when omitted. */
  onLaunchAgent: (agentType?: string) => void;
  onRetryEmail: () => void;
  creatingAgent: boolean;
  /** The configured messaging agent type, or null when none is installed. */
  messagingAgentType: string | null;
  /** The types the app prefers, for the missing-type explanation. */
  messagingAgentTypes: readonly string[];
  /** Every configured agent type, offered when no messaging type exists. */
  agentTypeOptions: string[];
  agentTypesLoaded: boolean;
}) {
  const [pickedType, setPickedType] = useState("");
  const pickerId = useId();
  const messagingTypeMissing = agentTypesLoaded && messagingAgentType === null;
  const previewConversations = liveConversations.slice(0, 5);
  const previewEmails = emailMessages.slice(0, 5);
  const connectedCards = channelCards.filter(c => c.connected);
  // Avoid flashing the empty banner while email providers are still loading.
  const nothingConnected = servicesConnected === 0 && providersCount === 0 && !emailProvidersFailed && !emailProvidersLoading;
  // Prefer cached messages over a revalidation error; only surface errors when empty.
  const showEmailError = emailProvidersFailed || Boolean(emailError && previewEmails.length === 0);

  return (
    <div className="p-4 space-y-5">
      {nothingConnected ? (
        <div className="rounded-xl border border-dashed border-primary bg-tertiary/40 px-5 py-6 text-center">
          <WifiOff className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium text-primary mb-1">No messaging channels connected</p>
          <p className="text-xs text-muted max-w-md mx-auto mb-4">
            Connect Slack or Telegram in Bots for bot chats, and add an email provider in Configuration to pull inbox messages into this hub.
            {messagingAgentType ? " You can still launch a messaging agent to work conversationally." : ""}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onOpenBots}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg focus-ring cursor-pointer"
            >
              <Bot className="w-3.5 h-3.5" /> Connect in Bots
            </button>
            {messagingAgentType ? (
              <button
                type="button"
                onClick={() => onLaunchAgent()}
                disabled={creatingAgent}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary text-muted hover:text-primary rounded-lg focus-ring cursor-pointer"
              >
                {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                New messaging agent
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <SectionLabel>Connected channels</SectionLabel>
          <span className="text-xs text-muted tabular-nums">
            {connectedCards.length} online · {channelCards.length - connectedCards.length} offline
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {channelCards.slice(0, 6).map(card => (
            <ChannelStatusCard
              key={card.id}
              id={card.id}
              name={card.name}
              kind={card.kind}
              connected={card.connected}
              detail={card.detail}
              compact
              // Chat services are connected (and managed) in Bots; email lives in the Email app.
              onOpen={() => (card.kind === "email" ? onOpenEmail() : onOpenBots())}
            />
          ))}
        </div>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="bg-primary border border-primary rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-primary flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <MessagesSquare className="w-3.5 h-3.5 text-violet-500" /> Recent bot threads
            </h3>
            <button type="button" onClick={onOpenBots} className="text-xs text-muted hover:text-primary focus-ring rounded cursor-pointer">
              All bots →
            </button>
          </div>
          {previewConversations.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted text-center">
              {botsCount === 0 ? "No bots configured yet." : "No live conversations. Threads start when someone messages a bot."}
            </p>
          ) : (
            <div className="divide-y divide-primary">
              {previewConversations.map(conversation => (
                <button
                  key={`${conversation.botName}:${conversation.key}`}
                  type="button"
                  onClick={() => onOpenConversation(conversation.agentId)}
                  className="w-full px-4 py-2.5 text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-xs font-medium text-primary truncate">{conversation.channelName ?? conversation.conversationId}</span>
                    {conversation.busy ? (
                      <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400 shrink-0">
                        <Activity className="w-3 h-3 animate-pulse" /> Busy
                      </span>
                    ) : null}
                    <span className="ml-auto text-xs text-muted shrink-0" title={formatTimestamp(conversation.lastActivityAt)}>
                      {formatRelativeTime(conversation.lastActivityAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-muted">
                    <ServicePill service={conversation.service} connected={connectedServices.has(conversation.service)} />
                    <span className="truncate">{conversation.botDisplayName}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </section>

        <section className="bg-primary border border-primary rounded-xl overflow-hidden">
          <div className="px-4 py-2.5 border-b border-primary flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold text-primary flex items-center gap-1.5">
              <Inbox className="w-3.5 h-3.5 text-red-500" /> Recent email
            </h3>
            <button type="button" onClick={onOpenEmail} className="text-xs text-muted hover:text-primary focus-ring rounded cursor-pointer">
              Open email →
            </button>
          </div>
          {showEmailError ? (
            <ErrorState
              title={emailProvidersFailed ? "Could not load email providers" : "Could not load inbox"}
              error={emailError ?? "Unknown error"}
              onRetry={onRetryEmail}
            />
          ) : emailProvidersLoading || emailLoading ? (
            <LoadingState size="sm" className="py-8" />
          ) : !emailProvider ? (
            <EmptyState icon={Mail} title="No email provider configured" variant="compact" />
          ) : previewEmails.length === 0 ? (
            <p className="px-4 py-6 text-xs text-muted text-center">Inbox is empty for {emailProvider}.</p>
          ) : (
            <div className="divide-y divide-primary">
              {previewEmails.map(msg => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={() => onOpenEmailMessage(msg)}
                  className="w-full px-4 py-2.5 text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
                    <span className="text-xs text-muted shrink-0">{formatDate(msg.receivedAt)}</span>
                  </div>
                  <p className={cn("text-xs truncate mt-0.5", msg.isRead ? "text-muted" : "text-secondary")}>{msg.subject || "(no subject)"}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {messagingAgents.length > 0 ? (
        <section className="space-y-2">
          <SectionLabel tone="warning" className="px-1">
            Running sessions
          </SectionLabel>
          <div className="space-y-2">
            {messagingAgents.map(agent => (
              <button
                type="button"
                key={agent.id}
                onClick={() => onOpenAgent(agent.id)}
                className="w-full flex items-center gap-3 bg-primary border border-amber-500/30 px-3 py-2.5 rounded-xl text-left hover:bg-hover hover:border-amber-500/60 transition-all cursor-pointer focus-ring shadow-sm"
              >
                <BusySpinner size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                  <div className="text-xs text-muted truncate mt-0.5">
                    {agent.agentType} · {agent.currentActivity}
                  </div>
                </div>
                <div className="text-xs text-muted">Open →</div>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      <div className="bg-primary border border-primary rounded-xl p-5 flex flex-col sm:flex-row items-center gap-4">
        <div className="w-12 h-12 rounded-2xl bg-linear-to-br from-emerald-500 to-green-600 flex items-center justify-center shadow-lg shrink-0">
          <Sparkles className="w-6 h-6 text-white" />
        </div>
        <div className="flex-1 text-center sm:text-left min-w-0">
          <h3 className="text-sm font-semibold text-primary">Messaging agent</h3>
          <p className="text-xs text-muted mt-0.5 leading-relaxed">
            Launch an agent to read, draft, and manage messages across email and chat tools through conversation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {canSend ? (
            <button
              type="button"
              onClick={onQuickSend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Quick send
            </button>
          ) : null}
          {messagingTypeMissing ? null : (
            <button
              type="button"
              onClick={() => onLaunchAgent()}
              disabled={creatingAgent || !messagingAgentType}
              title="Starts a new messaging agent each time"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg focus-ring cursor-pointer shadow-sm"
            >
              {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              New messaging agent
            </button>
          )}
        </div>
      </div>
      {messagingTypeMissing ? (
        <MissingAgentTypeNotice agentType={messagingAgentTypes} feature="The messaging agent">
          {agentTypeOptions.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <label htmlFor={pickerId} className="text-xs text-muted">
                Or launch another type:
              </label>
              <Select id={pickerId} value={pickedType} onChange={setPickedType}>
                <option value="">Choose an agent type…</option>
                {agentTypeOptions.map(type => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </Select>
              <button
                type="button"
                onClick={() => onLaunchAgent(pickedType)}
                disabled={!pickedType || creatingAgent}
                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md focus-ring cursor-pointer"
              >
                {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                Launch
              </button>
            </div>
          ) : null}
        </MissingAgentTypeNotice>
      ) : null}
    </div>
  );
}
