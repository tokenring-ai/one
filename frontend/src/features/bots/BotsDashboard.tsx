import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  AtSign,
  Bot,
  Cpu,
  Hash,
  Loader2,
  MessageSquare,
  MessagesSquare,
  Plug,
  PlugZap,
  RefreshCw,
  RotateCcw,
  Send,
  Shield,
  User,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import ConfirmDialog from "../../components/overlay/confirm-dialog.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { cn } from "../../lib/utils.ts";
import { botRPCClient, useBots } from "../../rpc.ts";
import { formatDirectMessagePolicy, formatRelativeTime, formatTimestamp } from "./formatters.ts";
import SendMessageForm, { type MessageTargetOption } from "./SendMessageForm.tsx";

type BotsData = NonNullable<ReturnType<typeof useBots>["data"]>;
type BotSummary = BotsData["bots"][number];
type BotChannel = BotSummary["channels"][number];
type BotConversation = BotSummary["conversations"][number];
type BotUser = BotSummary["users"][number];

type DetailTab = "conversations" | "channels" | "people";

const CONFIG_EXAMPLE = `bot:
  bots:
    helper:
      agentType: assistant
      users:
        "slack:U123ABC": admin
      channels:
        engineering:
          target: slack:C0123ABCD`;

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
        connected ? "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30" : "bg-tertiary text-muted border-primary line-through decoration-1",
      )}
      title={connected ? `${service} is connected` : `${service} is not connected`}
    >
      {connected ? <PlugZap className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
      {service}
    </span>
  );
}

function RolePill({ role }: { role: BotUser["role"] }) {
  return role === "admin" ? (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/30">
      <Shield className="w-3 h-3" /> Admin
    </span>
  ) : (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary">
      <User className="w-3 h-3" /> User
    </span>
  );
}

function EmptyPanel({ icon, title, hint }: { icon: ReactNode; title: string; hint: string }) {
  return (
    <div className="px-6 py-10 text-center">
      {icon}
      <p className="text-sm font-medium text-primary mb-1">{title}</p>
      <p className="text-2xs text-muted max-w-sm mx-auto">{hint}</p>
    </div>
  );
}

export default function BotsDashboard() {
  const navigate = useNavigate();
  const bots = useBots();

  const [selectedBotName, setSelectedBotName] = useState<string | null>(null);
  const [tab, setTab] = useState<DetailTab>("conversations");
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<string | undefined>(undefined);
  const [confirmReset, setConfirmReset] = useState<{ bot: string; conversationKey: string } | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);

  const data = bots.data;
  const botList = useMemo(() => data?.bots ?? [], [data]);
  const services = useMemo(() => data?.services ?? [], [data]);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const connectedServices = useMemo(() => new Set(services.map(service => service.name)), [services]);

  // Keep a valid bot selected as the list loads and changes
  useEffect(() => {
    if (botList.length === 0) {
      setSelectedBotName(null);
      return;
    }
    if (!selectedBotName || !botList.some(bot => bot.name === selectedBotName)) {
      setSelectedBotName(botList[0]!.name);
    }
  }, [botList, selectedBotName]);

  const selectedBot = useMemo(() => botList.find(bot => bot.name === selectedBotName), [botList, selectedBotName]);

  const totalChannels = useMemo(() => botList.reduce((count, bot) => count + bot.channels.length, 0), [botList]);
  const totalConversations = useMemo(() => botList.reduce((count, bot) => count + bot.conversations.length, 0), [botList]);
  const busyConversations = useMemo(() => botList.reduce((count, bot) => count + bot.conversations.filter(c => c.busy).length, 0), [botList]);

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
    // Channels and people can be shared between bots; offer each target once.
    return options.filter((option, index) => options.findIndex(other => other.target === option.target) === index);
  }, [botList, groups]);

  const tabs = useMemo<FilterTabOption<DetailTab>[]>(
    () => [
      { id: "conversations", label: "Conversations", count: selectedBot?.conversations.length ?? 0 },
      { id: "channels", label: "Channels", count: selectedBot?.channels.length ?? 0 },
      { id: "people", label: "People", count: selectedBot?.users.length ?? 0 },
    ],
    [selectedBot],
  );

  const refresh = () => void bots.mutate();

  const openSendForm = (target?: string) => {
    setSendTarget(target);
    setShowSendForm(true);
  };

  const handleReset = async () => {
    if (!confirmReset) return;
    const { bot, conversationKey } = confirmReset;
    setConfirmReset(null);
    setBusyAction(`reset:${conversationKey}`);
    try {
      const result = await botRPCClient.resetConversation({ bot, conversationKey });
      if (result.status === "botNotFound") {
        toastManager.error(`Bot "${bot}" no longer exists`, { duration: 4000 });
      } else if (result.status === "conversationNotFound") {
        toastManager.warning("That conversation has already ended", { duration: 3000 });
      } else {
        toastManager.success(`Conversation ${conversationKey} reset`, { duration: 2500 });
      }
      await bots.mutate();
    } catch (err) {
      toastManager.error(formatError(err), { duration: 5000 });
    } finally {
      setBusyAction(null);
    }
  };

  const isLoading = bots.isLoading && !data;

  return (
    <div className="w-full h-full flex flex-col bg-primary">
      <AppPageHeader
        title="Bots"
        subtitle="Assistants that live in your chat channels"
        icon={<Bot className="w-4 h-4" />}
        iconGradient="from-teal-500 to-emerald-600"
      >
        <button
          type="button"
          onClick={() => openSendForm(undefined)}
          disabled={services.length === 0}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg focus-ring cursor-pointer shadow-sm"
          title={services.length === 0 ? "No messaging service is connected" : "Send a message"}
        >
          <Send className="w-3.5 h-3.5" />
          Send message
        </button>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", bots.isValidating && "animate-spin")} />
          Refresh
        </button>
      </AppPageHeader>

      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6">
        <div className="max-w-5xl mx-auto space-y-6">
          {isLoading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-7 h-7 text-muted animate-spin" />
            </div>
          ) : bots.error && !data ? (
            <ErrorState title="Unable to load bots" error={bots.error} onRetry={refresh} variant="page" />
          ) : (
            <>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <SummaryStat label="Bots" value={String(botList.length)} icon={<Bot className="w-4 h-4" />} accentClass="text-teal-500" />
                <SummaryStat label="Channels" value={String(totalChannels)} icon={<Hash className="w-4 h-4" />} accentClass="text-sky-500" />
                <SummaryStat
                  label="Conversations"
                  value={busyConversations > 0 ? `${totalConversations} · ${busyConversations} busy` : String(totalConversations)}
                  icon={<MessagesSquare className="w-4 h-4" />}
                  accentClass="text-violet-500"
                />
                <SummaryStat label="Services" value={String(services.length)} icon={<Plug className="w-4 h-4" />} accentClass="text-amber-500" />
              </div>

              {showSendForm ? (
                <SendMessageForm
                  options={targetOptions}
                  initialTarget={sendTarget}
                  onSent={() => setShowSendForm(false)}
                  onCancel={() => setShowSendForm(false)}
                />
              ) : null}

              {botList.length === 0 ? (
                <div className="px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl">
                  <Bot className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                  <p className="text-sm font-medium text-primary mb-1">No bots configured</p>
                  <p className="text-2xs text-muted max-w-md mx-auto mb-4">
                    A bot pairs an agent type with the people and channels it may talk to. Add one under <code className="text-primary">bot.bots</code> in your
                    configuration, then connect a messaging service such as Slack or Telegram.
                  </p>
                  <pre className="text-left text-2xs text-muted bg-tertiary border border-primary rounded-lg p-3 max-w-md mx-auto overflow-x-auto">
                    {CONFIG_EXAMPLE}
                  </pre>
                </div>
              ) : (
                <>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {botList.map(bot => {
                      const isSelected = bot.name === selectedBotName;
                      const busy = bot.conversations.filter(conversation => conversation.busy).length;
                      return (
                        <button
                          key={bot.name}
                          type="button"
                          onClick={() => {
                            setSelectedBotName(bot.name);
                            setTab("conversations");
                          }}
                          className={cn(
                            "text-left bg-secondary border rounded-xl p-4 shadow-sm transition-colors focus-ring cursor-pointer",
                            isSelected ? "border-accent ring-1 ring-accent/30" : "border-primary hover:bg-hover/40",
                          )}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-primary truncate">{bot.displayName}</p>
                              <p className="text-2xs text-muted truncate">{bot.name}</p>
                            </div>
                            {busy > 0 ? (
                              <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400 shrink-0">
                                <Activity className="w-3 h-3 animate-pulse" /> {busy}
                              </span>
                            ) : null}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary">
                              <Cpu className="w-3 h-3" /> {bot.agentType}
                            </span>
                            {[...new Set(bot.channels.map(channel => channel.service))].map(service => (
                              <ServicePill key={service} service={service} connected={connectedServices.has(service)} />
                            ))}
                          </div>
                          <div className="flex items-center gap-3 mt-3 text-2xs text-muted">
                            <span className="inline-flex items-center gap-1">
                              <Hash className="w-3 h-3" /> {bot.channels.length}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Users className="w-3 h-3" /> {bot.users.length}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <MessagesSquare className="w-3 h-3" /> {bot.conversations.length}
                            </span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {selectedBot ? (
                    <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                      <div className="px-4 py-3 border-b border-primary flex flex-wrap items-center gap-2">
                        <div className="flex-1 min-w-0">
                          <h2 className="text-sm font-semibold text-primary truncate">{selectedBot.displayName}</h2>
                          <p className="text-2xs text-muted truncate">
                            Agent type <span className="text-primary font-medium">{selectedBot.agentType}</span> · DMs:{" "}
                            <span className="text-primary font-medium">{formatDirectMessagePolicy(selectedBot.directMessages)}</span>
                          </p>
                        </div>
                        {selectedBot.requireMention ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-tertiary text-muted border border-primary">
                            <AtSign className="w-3 h-3" /> Mention required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/30">
                            <MessageSquare className="w-3 h-3" /> Answers everything
                          </span>
                        )}
                      </div>

                      <FilterTabs tabs={tabs} value={tab} onChange={setTab} showZeroCounts />

                      {tab === "conversations" ? (
                        selectedBot.conversations.length === 0 ? (
                          <EmptyPanel
                            icon={<MessagesSquare className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                            title="No live conversations"
                            hint="A conversation starts — with an agent of its own — the first time someone messages this bot in a channel or a DM."
                          />
                        ) : (
                          <div className="divide-y divide-primary">
                            {selectedBot.conversations.map(conversation => (
                              <ConversationRow
                                key={conversation.key}
                                conversation={conversation}
                                connected={connectedServices.has(conversation.service)}
                                busyAction={busyAction}
                                onOpenAgent={() => void navigate(`/agent/${conversation.agentId}`)}
                                onMessage={() => openSendForm(conversation.key)}
                                onReset={() => setConfirmReset({ bot: selectedBot.name, conversationKey: conversation.key })}
                              />
                            ))}
                          </div>
                        )
                      ) : null}

                      {tab === "channels" ? (
                        selectedBot.channels.length === 0 ? (
                          <EmptyPanel
                            icon={<Hash className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                            title="Not in any channels"
                            hint="Add channels under this bot's `channels` config to have it sit in a Slack channel or Telegram group."
                          />
                        ) : (
                          <div className="divide-y divide-primary">
                            {selectedBot.channels.map(channel => (
                              <ChannelRow key={channel.target} channel={channel} onMessage={() => openSendForm(channel.target)} />
                            ))}
                          </div>
                        )
                      ) : null}

                      {tab === "people" ? (
                        selectedBot.users.length === 0 ? (
                          <EmptyPanel
                            icon={<Users className="w-8 h-8 text-muted mx-auto mb-3 opacity-50" />}
                            title="Nobody listed"
                            hint={
                              selectedBot.directMessages === "anyone"
                                ? "This bot answers DMs from anyone, so no one has to be listed — but only listed admins can run commands."
                                : "List people under `users` as service:userId to let them DM this bot. Admins may also run slash commands."
                            }
                          />
                        ) : (
                          <div className="divide-y divide-primary">
                            {selectedBot.users.map(user => (
                              <UserRow
                                key={user.target}
                                user={user}
                                connected={connectedServices.has(user.service)}
                                onMessage={() => openSendForm(user.target)}
                              />
                            ))}
                          </div>
                        )
                      ) : null}
                    </div>
                  ) : null}
                </>
              )}

              <div className="grid gap-3 lg:grid-cols-2">
                <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-primary">
                    <h3 className="text-xs font-semibold text-primary">Messaging services</h3>
                  </div>
                  {services.length === 0 ? (
                    <p className="px-4 py-6 text-2xs text-muted text-center">
                      No messaging service is connected. Configure a Slack or Telegram account to give your bots somewhere to talk.
                    </p>
                  ) : (
                    <div className="divide-y divide-primary">
                      {services.map(service => (
                        <div key={service.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <ServicePill service={service.name} connected />
                          <span className="text-2xs text-muted tabular-nums">{service.maxMessageLength.toLocaleString()} char limit</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                  <div className="px-4 py-2.5 border-b border-primary">
                    <h3 className="text-xs font-semibold text-primary">Broadcast groups</h3>
                  </div>
                  {groups.length === 0 ? (
                    <p className="px-4 py-6 text-2xs text-muted text-center">
                      No groups configured. Groups let one message reach several people across platforms at once.
                    </p>
                  ) : (
                    <div className="divide-y divide-primary">
                      {groups.map(group => (
                        <div key={group.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-primary truncate">group:{group.name}</p>
                            <p className="text-2xs text-muted truncate">{group.members.join(", ")}</p>
                          </div>
                          <button
                            type="button"
                            onClick={() => openSendForm(`group:${group.name}`)}
                            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
                          >
                            <Send className="w-3 h-3" /> Message
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {confirmReset ? (
        <ConfirmDialog
          title="Reset conversation?"
          message={`The agent behind ${confirmReset.conversationKey} will be deleted. The next message there starts a fresh conversation with no history.`}
          confirmText="Reset"
          variant="warning"
          onConfirm={() => void handleReset()}
          onCancel={() => setConfirmReset(null)}
        />
      ) : null}
    </div>
  );
}

function ConversationRow({
  conversation,
  connected,
  busyAction,
  onOpenAgent,
  onMessage,
  onReset,
}: {
  conversation: BotConversation;
  connected: boolean;
  busyAction: string | null;
  onOpenAgent: () => void;
  onMessage: () => void;
  onReset: () => void;
}) {
  const resetting = busyAction === `reset:${conversation.key}`;

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
            ) : (
              <span className="inline-flex items-center gap-1 text-2xs text-muted">
                <User className="w-3 h-3" /> Direct
              </span>
            )}
            {conversation.busy ? (
              <span className="inline-flex items-center gap-1 text-2xs text-amber-600 dark:text-amber-400">
                <Activity className="w-3 h-3 animate-pulse" /> Working
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
            <ServicePill service={conversation.service} connected={connected} />
            <span className="inline-flex items-center gap-1">
              <Cpu className="w-3 h-3" /> {conversation.agentType}
            </span>
            <span title={formatTimestamp(conversation.lastActivityAt)}>Active {formatRelativeTime(conversation.lastActivityAt)}</span>
            <span title={formatTimestamp(conversation.startedAt)}>Started {formatRelativeTime(conversation.startedAt)}</span>
          </div>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={onOpenAgent}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
            title="Open the agent handling this conversation"
          >
            <Cpu className="w-3 h-3" /> Agent
          </button>
          <button
            type="button"
            onClick={onMessage}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
            title="Send a message here"
          >
            <Send className="w-3 h-3" /> Message
          </button>
          <button
            type="button"
            onClick={onReset}
            disabled={resetting}
            className="inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-error border border-primary hover:bg-error/5 rounded-md focus-ring cursor-pointer transition-colors"
            title="Delete this conversation's agent"
          >
            {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />} Reset
          </button>
        </div>
      </div>
    </div>
  );
}

function ChannelRow({ channel, onMessage }: { channel: BotChannel; onMessage: () => void }) {
  return (
    <div className="px-4 py-3 hover:bg-hover/30 transition-colors flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-medium text-primary truncate">{channel.name}</span>
          <ServicePill service={channel.service} connected={channel.connected} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-2xs text-muted">
          <span className="font-mono">{channel.target}</span>
          <span className="inline-flex items-center gap-1">
            <Cpu className="w-3 h-3" /> {channel.agentType}
          </span>
          <span>
            {channel.allowedUsers.length === 0 ? "Anyone in the channel" : `${channel.allowedUsers.length} allowed: ${channel.allowedUsers.join(", ")}`}
          </span>
        </div>
      </div>
      <button
        type="button"
        onClick={onMessage}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
      >
        <Send className="w-3 h-3" /> Message
      </button>
    </div>
  );
}

function UserRow({ user, connected, onMessage }: { user: BotUser; connected: boolean; onMessage: () => void }) {
  return (
    <div className="px-4 py-3 hover:bg-hover/30 transition-colors flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-primary truncate font-mono">{user.userId}</span>
          <RolePill role={user.role} />
          <ServicePill service={user.service} connected={connected} />
        </div>
      </div>
      <button
        type="button"
        onClick={onMessage}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-2xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
      >
        <Send className="w-3 h-3" /> Message
      </button>
    </div>
  );
}
