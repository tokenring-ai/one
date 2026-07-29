import type { EmailMessage } from "@tokenring-ai/email";
import { formatDate } from "@tokenring-ai/utility/date/formatDate";
import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  ArrowRight,
  Bot,
  Cpu,
  ExternalLink,
  Hash,
  Inbox,
  Loader2,
  Mail,
  MessageSquare,
  MessagesSquare,
  Plug,
  PlugZap,
  RefreshCw,
  Send,
  Settings,
  Sparkles,
  WifiOff,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { agentRPCClient, useAgentList, useAgentTypes, useBots, useEmailMessages, useEmailProviders } from "../../rpc.ts";
import SendMessageForm, { type MessageTargetOption } from "../bots/SendMessageForm.tsx";
import { formatRelativeTime, formatServiceName, formatTimestamp, serviceGradient } from "./formatters.ts";

type BotsData = NonNullable<ReturnType<typeof useBots>["data"]>;
type BotSummary = BotsData["bots"][number];
type BotConversation = BotSummary["conversations"][number];
type BotChannel = BotSummary["channels"][number];

type HubTab = "overview" | "conversations" | "email" | "channels";

type LiveConversation = BotConversation & {
  botName: string;
  botDisplayName: string;
};

function SummaryStat({ label, value, icon, accentClass }: { label: string; value: string; icon: ReactNode; accentClass: string }) {
  return (
    <div className="bg-secondary border border-primary rounded-xl px-4 py-3 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span className={accentClass}>{icon}</span>
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-lg font-semibold text-primary tabular-nums">{value}</p>
    </div>
  );
}

function ServicePill({ service, connected }: { service: string; connected: boolean }) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border",
        connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-tertiary text-muted border-primary",
      )}
      title={connected ? `${formatServiceName(service)} is connected` : `${formatServiceName(service)} is not connected`}
    >
      {connected ? <PlugZap className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
      {formatServiceName(service)}
    </span>
  );
}

function EmptyPanel({ icon, title, hint, action }: { icon: ReactNode; title: string; hint: string; action?: ReactNode }) {
  return (
    <div className="px-6 py-10 text-center">
      {icon}
      <p className="text-sm font-medium text-primary mb-1">{title}</p>
      <p className="text-2xs text-muted max-w-sm mx-auto">{hint}</p>
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}

function senderName(msg: EmailMessage): string {
  return msg.from.name || msg.from.email;
}

export default function MessagingDashboard() {
  const navigate = useNavigate();
  const bots = useBots();
  const emailProviders = useEmailProviders();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();

  const [tab, setTab] = useState<HubTab>("overview");
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<string | undefined>(undefined);
  const [creatingAgent, setCreatingAgent] = useState(false);

  const botList = useMemo(() => bots.data?.bots ?? [], [bots.data]);
  const services = useMemo(() => bots.data?.services ?? [], [bots.data]);
  const groups = useMemo(() => bots.data?.groups ?? [], [bots.data]);
  const connectedServiceNames = useMemo(() => new Set(services.map(service => service.name)), [services]);

  const providers = emailProviders.data?.providers ?? [];
  const primaryEmailProvider = providers[0];
  const emailInbox = useEmailMessages(primaryEmailProvider, { box: "inbox", limit: 12 });

  const liveConversations = useMemo<LiveConversation[]>(() => {
    const rows: LiveConversation[] = [];
    for (const bot of botList) {
      for (const conversation of bot.conversations) {
        rows.push({
          ...conversation,
          botName: bot.name,
          botDisplayName: bot.displayName,
        });
      }
    }
    return rows.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [botList]);

  const allChannels = useMemo(() => {
    const rows: Array<BotChannel & { botName: string; botDisplayName: string }> = [];
    for (const bot of botList) {
      for (const channel of bot.channels) {
        rows.push({ ...channel, botName: bot.name, botDisplayName: bot.displayName });
      }
    }
    return rows;
  }, [botList]);

  const busyConversations = useMemo(() => liveConversations.filter(c => c.busy).length, [liveConversations]);
  const emailMessages = (emailInbox.data?.messages ?? []) as EmailMessage[];
  const unreadEmailCount = useMemo(() => emailMessages.filter(m => !m.isRead).length, [emailMessages]);

  const messagingAgents = useMemo(() => {
    const preferred = new Set(["messaging", "email"]);
    return (agents.data ?? []).filter(agent => preferred.has(agent.agentType));
  }, [agents.data]);

  const targetOptions = useMemo<MessageTargetOption[]>(() => {
    const options: MessageTargetOption[] = [];
    for (const bot of botList) {
      for (const channel of bot.channels) {
        options.push({ target: channel.target, label: `${channel.name} — ${channel.target}`, group: `${bot.displayName} channels` });
      }
      for (const user of bot.users) {
        options.push({ target: user.target, label: `${user.target} (${user.role})`, group: `${bot.displayName} people` });
      }
    }
    for (const group of groups) {
      options.push({ target: `group:${group.name}`, label: `group:${group.name} — ${group.members.length} members`, group: "Broadcast groups" });
    }
    return options.filter((option, index) => options.findIndex(other => other.target === option.target) === index);
  }, [botList, groups]);

  /** Channel cards: messaging services from bots + email providers. */
  const channelCards = useMemo(() => {
    const cards: Array<{ id: string; name: string; kind: "messaging" | "email"; connected: boolean; detail: string; href: string }> = [];

    const knownMessaging = ["slack", "telegram", "discord"];
    const seen = new Set<string>();

    for (const service of services) {
      seen.add(service.name.toLowerCase());
      cards.push({
        id: `svc-${service.name}`,
        name: formatServiceName(service.name),
        kind: "messaging",
        connected: true,
        detail: `${service.maxMessageLength.toLocaleString()} char limit · used by bots`,
        href: "/bots",
      });
    }

    // Surfaces from bot channel config even when the provider is offline
    for (const channel of allChannels) {
      const key = channel.service.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      cards.push({
        id: `chan-${channel.service}`,
        name: formatServiceName(channel.service),
        kind: "messaging",
        connected: connectedServiceNames.has(channel.service),
        detail: connectedServiceNames.has(channel.service) ? "Connected for bots" : "Configured on a bot, provider offline",
        href: "/bots",
      });
    }

    for (const name of knownMessaging) {
      if (seen.has(name)) continue;
      cards.push({
        id: `known-${name}`,
        name: formatServiceName(name),
        kind: "messaging",
        connected: false,
        detail: "Not connected — configure under bots / plugins",
        href: "/configuration",
      });
    }

    if (providers.length > 0) {
      for (const provider of providers) {
        cards.push({
          id: `email-${provider}`,
          name: provider,
          kind: "email",
          connected: true,
          detail: "Email provider ready",
          href: "/email",
        });
      }
    } else {
      cards.push({
        id: "email-none",
        name: "Email",
        kind: "email",
        connected: false,
        detail: "No email provider configured",
        href: "/configuration",
      });
    }

    return cards;
  }, [services, allChannels, connectedServiceNames, providers]);

  const connectedCount = channelCards.filter(c => c.connected).length;

  const tabs = useMemo<FilterTabOption<HubTab>[]>(
    () => [
      { id: "overview", label: "Overview" },
      { id: "conversations", label: "Conversations", count: liveConversations.length },
      { id: "email", label: "Email", count: emailMessages.length },
      { id: "channels", label: "Channels", count: connectedCount },
    ],
    [liveConversations.length, emailMessages.length, connectedCount],
  );

  const refresh = () => {
    void bots.mutate();
    void emailProviders.mutate();
    void emailInbox.mutate();
    void agents.mutate();
  };

  const openSendForm = (target?: string) => {
    setSendTarget(target);
    setShowSendForm(true);
  };

  const resolveMessagingAgentType = (): string => {
    const types = agentTypes.data ?? [];
    const preferred = ["messaging", "email", "assistant", "code"];
    for (const name of preferred) {
      if (types.some(t => t.type === name)) return name;
    }
    return types[0]?.type ?? "messaging";
  };

  const launchMessagingAgent = async () => {
    setCreatingAgent(true);
    const agentType = resolveMessagingAgentType();
    try {
      const { id } = await agentRPCClient.createAgent({ agentType, headless: false });
      await agents.mutate();
      if (agentType !== "messaging") {
        toastManager.success(`Launched ${agentType} agent (messaging type not configured)`, { duration: 3500 });
      }
      void navigate(`/agent/${id}`);
    } catch (error) {
      toastManager.error(formatError(error), { duration: 5000 });
    } finally {
      setCreatingAgent(false);
    }
  };

  const botsLoading = bots.isLoading && !bots.data;
  const emailLoading = emailProviders.isLoading && !emailProviders.data;
  const isLoading = botsLoading && emailLoading;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Messaging"
        subtitle="Unified hub for bots, channels, and email"
        icon={<MessageSquare className="w-4 h-4" />}
        iconGradient="from-emerald-500 to-green-600"
      >
        <button
          type="button"
          onClick={() => openSendForm(undefined)}
          disabled={services.length === 0 && targetOptions.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg focus-ring cursor-pointer shadow-sm"
          title={services.length === 0 ? "Connect Slack or Telegram to send messages" : "Send a message via a connected service"}
        >
          <Send className="w-3.5 h-3.5" />
          Send
        </button>
        <button
          type="button"
          onClick={() => void launchMessagingAgent()}
          disabled={creatingAgent}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent hover:bg-accent-hover disabled:opacity-50 text-white rounded-lg focus-ring cursor-pointer shadow-sm"
        >
          {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          Open Agent
        </button>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (bots.isValidating || emailInbox.isValidating) && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-muted animate-spin" />
            </div>
          ) : bots.error && !bots.data && emailProviders.error && !emailProviders.data ? (
            <ErrorState title="Unable to load messaging data" error={bots.error} onRetry={refresh} variant="page" />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat
                  label="Channels"
                  value={`${connectedCount}/${channelCards.length}`}
                  icon={<Plug className="w-4 h-4" />}
                  accentClass="text-emerald-500"
                />
                <SummaryStat label="Bots" value={String(botList.length)} icon={<Bot className="w-4 h-4" />} accentClass="text-teal-500" />
                <SummaryStat
                  label="Live threads"
                  value={busyConversations > 0 ? `${liveConversations.length} · ${busyConversations} busy` : String(liveConversations.length)}
                  icon={<MessagesSquare className="w-4 h-4" />}
                  accentClass="text-violet-500"
                />
                <SummaryStat
                  label="Email"
                  value={providers.length === 0 ? "None" : unreadEmailCount > 0 ? `${unreadEmailCount} unread` : `${emailMessages.length} recent`}
                  icon={<Mail className="w-4 h-4" />}
                  accentClass="text-red-500"
                />
              </div>

              {showSendForm ? (
                <SendMessageForm
                  options={targetOptions}
                  initialTarget={sendTarget}
                  onSent={() => {
                    setShowSendForm(false);
                    void bots.mutate();
                  }}
                  onCancel={() => setShowSendForm(false)}
                />
              ) : null}

              <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                <FilterTabs tabs={tabs} value={tab} onChange={setTab} showZeroCounts activeTabClassName="border-emerald-500 text-primary" />

                {tab === "overview" ? (
                  <OverviewPanel
                    channelCards={channelCards}
                    liveConversations={liveConversations}
                    emailMessages={emailMessages}
                    emailProvider={primaryEmailProvider}
                    emailLoading={emailInbox.isLoading}
                    messagingAgents={messagingAgents}
                    servicesConnected={services.length}
                    botsCount={botList.length}
                    providersCount={providers.length}
                    onOpenConversation={id => void navigate(`/agent/${id}`)}
                    onQuickSend={() => openSendForm(undefined)}
                    connectedServices={connectedServiceNames}
                    onOpenEmail={() => void navigate("/email")}
                    onOpenBots={() => void navigate("/bots")}
                    onOpenConfig={() => void navigate("/configuration")}
                    onOpenAgent={id => void navigate(`/agent/${id}`)}
                    onLaunchAgent={() => void launchMessagingAgent()}
                    creatingAgent={creatingAgent}
                  />
                ) : null}

                {tab === "conversations" ? (
                  liveConversations.length === 0 ? (
                    <EmptyPanel
                      icon={<MessagesSquare className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                      title="No live bot conversations"
                      hint="Conversations appear here when someone messages a bot on Slack, Telegram, or another connected service."
                      action={
                        <button
                          type="button"
                          onClick={() => void navigate("/bots")}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary rounded-lg text-muted hover:text-primary focus-ring cursor-pointer"
                        >
                          Manage bots <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      }
                    />
                  ) : (
                    <div className="divide-y divide-primary">
                      {liveConversations.map(conversation => (
                        <ConversationRow
                          key={`${conversation.botName}:${conversation.key}`}
                          conversation={conversation}
                          connected={connectedServiceNames.has(conversation.service)}
                          onOpenAgent={() => void navigate(`/agent/${conversation.agentId}`)}
                          onMessage={() => openSendForm(conversation.key)}
                        />
                      ))}
                    </div>
                  )
                ) : null}

                {tab === "email" ? (
                  <EmailPanel
                    provider={primaryEmailProvider}
                    providers={providers}
                    messages={emailMessages}
                    loading={!!primaryEmailProvider && emailInbox.isLoading}
                    error={emailInbox.error}
                    onOpenEmail={() => void navigate("/email")}
                    onOpenConfig={() => void navigate("/configuration")}
                    onRetry={() => void emailInbox.mutate()}
                  />
                ) : null}

                {tab === "channels" ? (
                  <div className="p-4 grid gap-3 sm:grid-cols-2">
                    {channelCards.map(card => (
                      <ChannelStatusCard key={card.id} card={card} onOpen={() => void navigate(card.href)} />
                    ))}
                  </div>
                ) : null}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <QuickLink
                  title="Email inbox"
                  description="Browse, search, and reply with AI"
                  icon={<Mail className="w-4 h-4" />}
                  gradient="from-red-500 to-rose-600"
                  onClick={() => void navigate("/email")}
                />
                <QuickLink
                  title="Bots"
                  description="Channels, people, and live threads"
                  icon={<Bot className="w-4 h-4" />}
                  gradient="from-teal-500 to-emerald-600"
                  onClick={() => void navigate("/bots")}
                />
                <QuickLink
                  title="Configuration"
                  description="Connect Slack, Telegram, or email"
                  icon={<Settings className="w-4 h-4" />}
                  gradient="from-slate-500 to-zinc-600"
                  onClick={() => void navigate("/configuration")}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function OverviewPanel({
  channelCards,
  liveConversations,
  emailMessages,
  emailProvider,
  emailLoading,
  messagingAgents,
  servicesConnected,
  botsCount,
  providersCount,
  onOpenConversation,
  onQuickSend,
  connectedServices,
  onOpenEmail,
  onOpenBots,
  onOpenConfig,
  onOpenAgent,
  onLaunchAgent,
  creatingAgent,
}: {
  channelCards: Array<{ id: string; name: string; kind: "messaging" | "email"; connected: boolean; detail: string; href: string }>;
  liveConversations: LiveConversation[];
  emailMessages: EmailMessage[];
  emailProvider: string | undefined;
  emailLoading: boolean;
  messagingAgents: Array<{ id: string; displayName: string; currentActivity: string; agentType: string }>;
  servicesConnected: number;
  botsCount: number;
  providersCount: number;
  onOpenConversation: (agentId: string) => void;
  onQuickSend: () => void;
  connectedServices: Set<string>;
  onOpenEmail: () => void;
  onOpenBots: () => void;
  onOpenConfig: () => void;
  onOpenAgent: (id: string) => void;
  onLaunchAgent: () => void;
  creatingAgent: boolean;
}) {
  const previewConversations = liveConversations.slice(0, 5);
  const previewEmails = emailMessages.slice(0, 5);
  const connectedCards = channelCards.filter(c => c.connected);
  const nothingConnected = servicesConnected === 0 && providersCount === 0;

  return (
    <div className="p-4 space-y-5">
      {nothingConnected ? (
        <div className="rounded-xl border border-dashed border-primary bg-tertiary/40 px-5 py-6 text-center">
          <WifiOff className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />
          <p className="text-sm font-medium text-primary mb-1">No messaging channels connected</p>
          <p className="text-2xs text-muted max-w-md mx-auto mb-4">
            Connect Slack or Telegram for bot chats, and add an email provider to pull inbox messages into this hub. You can still launch a messaging agent to
            work conversationally.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-2">
            <button
              type="button"
              onClick={onOpenConfig}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg focus-ring cursor-pointer"
            >
              <Settings className="w-3.5 h-3.5" /> Open configuration
            </button>
            <button
              type="button"
              onClick={onLaunchAgent}
              disabled={creatingAgent}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-primary text-muted hover:text-primary rounded-lg focus-ring cursor-pointer"
            >
              {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              Launch messaging agent
            </button>
          </div>
        </div>
      ) : null}

      <section className="space-y-2">
        <div className="flex items-center justify-between gap-2 px-1">
          <p className="text-2xs font-bold text-muted uppercase tracking-widest">Connected channels</p>
          <span className="text-2xs text-muted tabular-nums">
            {connectedCards.length} online · {channelCards.length - connectedCards.length} offline
          </span>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {channelCards.slice(0, 6).map(card => (
            <ChannelStatusCard
              key={card.id}
              card={card}
              compact
              onOpen={() => (card.kind === "email" ? onOpenEmail() : card.connected ? onOpenBots() : onOpenConfig())}
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
            <button type="button" onClick={onOpenBots} className="text-2xs text-muted hover:text-primary focus-ring rounded cursor-pointer">
              All bots →
            </button>
          </div>
          {previewConversations.length === 0 ? (
            <p className="px-4 py-6 text-2xs text-muted text-center">
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
                      <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
                        <Activity className="w-3 h-3 animate-pulse" /> Busy
                      </span>
                    ) : null}
                    <span className="ml-auto text-2xs text-muted shrink-0" title={formatTimestamp(conversation.lastActivityAt)}>
                      {formatRelativeTime(conversation.lastActivityAt)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-2xs text-muted">
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
            <button type="button" onClick={onOpenEmail} className="text-2xs text-muted hover:text-primary focus-ring rounded cursor-pointer">
              Open email →
            </button>
          </div>
          {!emailProvider ? (
            <p className="px-4 py-6 text-2xs text-muted text-center">No email provider configured.</p>
          ) : emailLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="w-5 h-5 text-muted animate-spin" />
            </div>
          ) : previewEmails.length === 0 ? (
            <p className="px-4 py-6 text-2xs text-muted text-center">Inbox is empty for {emailProvider}.</p>
          ) : (
            <div className="divide-y divide-primary">
              {previewEmails.map(msg => (
                <button
                  key={msg.id}
                  type="button"
                  onClick={onOpenEmail}
                  className="w-full px-4 py-2.5 text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
                    <span className="text-2xs text-muted shrink-0">{formatDate(msg.receivedAt)}</span>
                  </div>
                  <p className={cn("text-2xs truncate mt-0.5", msg.isRead ? "text-muted" : "text-secondary")}>{msg.subject || "(no subject)"}</p>
                </button>
              ))}
            </div>
          )}
        </section>
      </div>

      {messagingAgents.length > 0 ? (
        <section className="space-y-2">
          <p className="text-2xs font-bold text-amber-600 dark:text-amber-500/90 uppercase tracking-widest px-1">Running sessions</p>
          <div className="space-y-2">
            {messagingAgents.map(agent => (
              <button
                type="button"
                key={agent.id}
                onClick={() => onOpenAgent(agent.id)}
                className="w-full flex items-center gap-3 bg-primary border border-amber-500/30 px-3 py-2.5 rounded-xl text-left hover:bg-hover hover:border-amber-500/60 transition-all cursor-pointer focus-ring shadow-sm"
              >
                <div className="w-3.5 h-3.5 border-2 border-amber-500/30 border-t-amber-500 rounded-full animate-spin shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium text-primary truncate">{agent.displayName}</div>
                  <div className="text-2xs text-muted truncate mt-0.5">
                    {agent.agentType} · {agent.currentActivity}
                  </div>
                </div>
                <div className="text-2xs text-muted">Open →</div>
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
          <p className="text-2xs text-muted mt-0.5 leading-relaxed">
            Launch an agent to read, draft, and manage messages across email and chat tools through conversation.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {servicesConnected > 0 ? (
            <button
              type="button"
              onClick={onQuickSend}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg focus-ring cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" /> Quick send
            </button>
          ) : null}
          <button
            type="button"
            onClick={onLaunchAgent}
            disabled={creatingAgent}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-lg focus-ring cursor-pointer shadow-sm"
          >
            {creatingAgent ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
            Open Messaging
          </button>
        </div>
      </div>
    </div>
  );
}

function ConversationRow({
  conversation,
  connected,
  onOpenAgent,
  onMessage,
}: {
  conversation: LiveConversation;
  connected: boolean;
  onOpenAgent: () => void;
  onMessage: () => void;
}) {
  return (
    <div className="px-4 py-3 hover:bg-hover/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-0.5">
            <span className="text-sm font-medium text-primary truncate">{conversation.channelName ?? conversation.conversationId}</span>
            {conversation.channelName ? (
              <span className="inline-flex items-center gap-1 text-2xs text-muted">
                <Hash className="w-3 h-3" /> {conversation.conversationId}
              </span>
            ) : null}
            {conversation.busy ? (
              <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
                <Activity className="w-3 h-3 animate-pulse" /> Working
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
            <ServicePill service={conversation.service} connected={connected} />
            <span className="inline-flex items-center gap-1">
              <Bot className="w-3 h-3" /> {conversation.botDisplayName}
            </span>
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> {conversation.agentType}
            </span>
            <span title={formatTimestamp(conversation.lastActivityAt)}>Active {formatRelativeTime(conversation.lastActivityAt)}</span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAgent}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
          >
            <Cpu className="w-3 h-3" /> Agent
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
          >
            <Send className="w-3 h-3" /> Message
          </button>
        </div>
      </div>
    </div>
  );
}

function EmailPanel({
  provider,
  providers,
  messages,
  loading,
  error,
  onOpenEmail,
  onOpenConfig,
  onRetry,
}: {
  provider: string | undefined;
  providers: string[];
  messages: EmailMessage[];
  loading: boolean;
  error: unknown;
  onOpenEmail: () => void;
  onOpenConfig: () => void;
  onRetry: () => void;
}) {
  if (providers.length === 0) {
    return (
      <EmptyPanel
        icon={<WifiOff className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
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

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  if (error) {
    return <ErrorState title="Could not load inbox" error={error} onRetry={onRetry} />;
  }

  if (messages.length === 0) {
    return (
      <EmptyPanel
        icon={<Inbox className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
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
        <span className="text-2xs text-muted">
          Showing recent messages from <span className="text-primary font-medium">{provider}</span>
          {providers.length > 1 ? ` · ${providers.length} providers` : ""}
        </span>
        <button
          type="button"
          onClick={onOpenEmail}
          className="inline-flex items-center gap-1 text-2xs text-muted hover:text-primary focus-ring rounded cursor-pointer"
        >
          Full inbox <ExternalLink className="w-3 h-3" />
        </button>
      </div>
      <div className="divide-y divide-primary">
        {messages.map(msg => (
          <button
            key={msg.id}
            type="button"
            onClick={onOpenEmail}
            className="w-full px-4 py-3 text-left hover:bg-hover/30 transition-colors focus-ring cursor-pointer"
          >
            <div className="flex items-center justify-between gap-2">
              <span className={cn("text-xs truncate flex-1 min-w-0", msg.isRead ? "text-muted" : "text-primary font-semibold")}>{senderName(msg)}</span>
              <span className="text-2xs text-muted shrink-0">{formatDate(msg.receivedAt)}</span>
            </div>
            <p className={cn("text-xs truncate mt-0.5", msg.isRead ? "text-muted" : "text-secondary font-medium")}>{msg.subject || "(no subject)"}</p>
            {msg.snippet ? <p className="text-2xs text-muted truncate mt-0.5">{msg.snippet}</p> : null}
          </button>
        ))}
      </div>
    </div>
  );
}

function ChannelStatusCard({
  card,
  onOpen,
  compact,
}: {
  card: { id: string; name: string; kind: "messaging" | "email"; connected: boolean; detail: string; href: string };
  onOpen: () => void;
  compact?: boolean;
}) {
  const gradient = card.kind === "email" ? serviceGradient("email") : serviceGradient(card.name);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={cn(
        "flex items-center gap-3 bg-primary border border-primary rounded-xl text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer shadow-sm",
        compact ? "px-3 py-2.5" : "px-4 py-3",
      )}
    >
      <div className={cn("rounded-lg bg-linear-to-br flex items-center justify-center shrink-0", compact ? "w-8 h-8" : "w-9 h-9", gradient)}>
        {card.kind === "email" ? <Mail className="w-4 h-4 text-white" /> : <MessageSquare className="w-4 h-4 text-white" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-primary truncate">{card.name}</p>
          <span
            className={cn(
              "text-2xs px-1.5 py-0.5 rounded-full border shrink-0",
              card.connected ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30" : "bg-tertiary text-muted border-primary",
            )}
          >
            {card.connected ? "Connected" : "Offline"}
          </span>
        </div>
        <p className="text-2xs text-muted truncate mt-0.5">{card.detail}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
    </button>
  );
}

function QuickLink({
  title,
  description,
  icon,
  gradient,
  onClick,
}: {
  title: string;
  description: string;
  icon: ReactNode;
  gradient: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl text-left hover:bg-hover/40 transition-colors focus-ring cursor-pointer shadow-sm"
    >
      <div className={cn("w-9 h-9 rounded-lg bg-linear-to-br flex items-center justify-center shrink-0 [&>svg]:w-4 [&>svg]:h-4 [&>svg]:text-white", gradient)}>
        {icon}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-primary">{title}</p>
        <p className="text-2xs text-muted">{description}</p>
      </div>
      <ArrowRight className="w-3.5 h-3.5 text-muted shrink-0" />
    </button>
  );
}
