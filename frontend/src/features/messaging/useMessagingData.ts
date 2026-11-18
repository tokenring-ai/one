import type { MessageTargetOption } from "@tokenring-ai/bot/frontend/components/SendMessageForm.tsx";
import type { EmailMessage } from "@tokenring-ai/email";
import formatError from "@tokenring-ai/utility/error/formatError";
import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toastManager } from "../../components/ui/toast.tsx";
import { useMultiSourceLoading } from "../../hooks/useMultiSourceLoading.ts";
import { toastOnReject } from "../../lib/toastOnReject.ts";
import { agentRPCClient, useAgentList, useAgentTypes, useBots, useEmailConfiguration, useEmailMessages } from "../../rpc.ts";
import { formatServiceName } from "./formatters.ts";
import type { ChannelCard, LiveConversation } from "./messagingShared.tsx";

/** Agent types the Messaging app launches and lists, in order of preference. */
export const MESSAGING_AGENT_TYPES = ["messaging", "email"] as const;

/**
 * Everything the Messaging views read.
 *
 * Four panels each call this hook. That is only affordable because the stream
 * hooks share one subscription per key (see `hooks/sharedStreamStore.ts`) and
 * the SWR hooks dedupe by key — otherwise four panels would open four
 * `streamBots` subscriptions between them.
 */
export function useMessagingData() {
  const navigate = useNavigate();
  const bots = useBots();
  const emailConfiguration = useEmailConfiguration();
  const agents = useAgentList();
  const agentTypes = useAgentTypes();
  const [creatingAgent, setCreatingAgent] = useState(false);

  const botList = useMemo(() => bots.data?.bots ?? [], [bots.data]);
  const services = useMemo(() => bots.data?.services ?? [], [bots.data]);
  const groups = useMemo(() => bots.data?.groups ?? [], [bots.data]);
  const connectedServiceNames = useMemo(() => new Set(services.map(service => service.name)), [services]);

  const providers = emailConfiguration.data?.providers ?? [];
  const primaryEmailProvider = providers[0];
  const emailInbox = useEmailMessages(primaryEmailProvider, { box: "inbox", limit: 12 });

  // Bots are the primary (fatal) payload; email/agents soft-fail so a panel can render partial data.
  const loading = useMultiSourceLoading([
    { source: bots, label: "bots" },
    { source: emailConfiguration, label: "email providers", isFatal: false },
    { source: emailInbox, label: "email inbox", isFatal: false },
    { source: agents, label: "agents", isFatal: false },
  ]);

  const liveConversations = useMemo<LiveConversation[]>(() => {
    const rows: LiveConversation[] = [];
    for (const bot of botList) {
      for (const conversation of bot.conversations) {
        rows.push({ ...conversation, botName: bot.name, botDisplayName: bot.displayName });
      }
    }
    return rows.sort((a, b) => b.lastActivityAt - a.lastActivityAt);
  }, [botList]);

  const emailMessages: EmailMessage[] = emailInbox.data?.messages ?? [];
  const unreadEmailCount = useMemo(() => emailMessages.filter(message => !message.isRead).length, [emailMessages]);

  const messagingAgents = useMemo(() => {
    const preferred = new Set<string>(MESSAGING_AGENT_TYPES);
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
      // Live threads (DMs, forum topics) may not match a configured channel target.
      for (const conversation of bot.conversations) {
        const label = conversation.channelName ? `${conversation.channelName} — ${conversation.key}` : `${conversation.key} (direct)`;
        options.push({ target: conversation.key, label, group: `${bot.displayName} conversations` });
      }
    }
    for (const group of groups) {
      options.push({ target: `group:${group.name}`, label: `group:${group.name} — ${group.members.length} members`, group: "Broadcast groups" });
    }
    return options.filter((option, index) => options.findIndex(other => other.target === option.target) === index);
  }, [botList, groups]);

  const emailProvidersLoading = emailConfiguration.isLoading && !emailConfiguration.data;
  const emailProvidersFailed = loading.isSourceHardError("email providers");

  /**
   * Messaging cards are only services the bot stream reported.
   * A service is offline only when a bot still references it — a channel whose
   * `connected` flag is false, or a person, thread, or group member on a service
   * the stream did not list. Slack, Telegram, and Discord are not assumed.
   */
  const channelCards = useMemo<ChannelCard[]>(() => {
    const cards: ChannelCard[] = [];
    const seen = new Set<string>();

    for (const service of services) {
      const key = service.name.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      cards.push({
        id: `svc-${service.name}`,
        name: formatServiceName(service.name),
        kind: "messaging",
        connected: true,
        detail: `${service.maxMessageLength.toLocaleString()} char limit · used by bots`,
        href: "/bots",
      });
    }

    // `group` is a broadcast address, not a provider. Skip a service already listed as connected.
    const referenced = new Map<string, { name: string; connected: boolean }>();
    const note = (service: string, connected: boolean) => {
      const name = service.trim();
      const key = name.toLowerCase();
      if (!key || key === "group" || seen.has(key)) return;
      const existing = referenced.get(key);
      if (!existing) referenced.set(key, { name, connected });
      else if (connected) existing.connected = true;
    };

    for (const bot of botList) {
      for (const channel of bot.channels) note(channel.service, channel.connected || connectedServiceNames.has(channel.service));
      for (const user of bot.users) note(user.service, connectedServiceNames.has(user.service));
      for (const thread of bot.conversations) note(thread.service, connectedServiceNames.has(thread.service));
    }
    for (const group of groups) {
      for (const member of group.members) {
        const separator = member.indexOf(":");
        if (separator > 0) {
          const service = member.slice(0, separator);
          note(service, connectedServiceNames.has(service));
        }
      }
    }

    for (const { name, connected } of referenced.values()) {
      cards.push({
        id: `chan-${name}`,
        name: formatServiceName(name),
        kind: "messaging",
        connected,
        detail: connected ? "Connected for bots" : "Configured on a bot, provider offline",
        href: "/bots",
      });
    }

    for (const provider of providers) {
      cards.push({
        id: `email-${provider}`,
        name: provider,
        kind: "email",
        connected: !emailProvidersFailed,
        detail: emailProvidersFailed ? "Provider unreachable" : "Email provider",
        href: "/email",
      });
    }

    return cards;
  }, [botList, connectedServiceNames, emailProvidersFailed, groups, providers, services]);

  const connectedCount = channelCards.filter(card => card.connected).length;

  const revalidate = useCallback((promise: PromiseLike<unknown>, label: string) => {
    toastOnReject(Promise.resolve(promise), {
      message: err => `Failed to refresh ${label}: ${formatError(err)}`,
      duration: 4000,
    });
  }, []);

  const refresh = useCallback(() => {
    revalidate(bots.mutate(), "bots");
    revalidate(emailConfiguration.mutate(), "email providers");
    revalidate(emailInbox.mutate(), "email inbox");
    revalidate(agents.mutate(), "agents");
  }, [agents, bots, emailConfiguration, emailInbox, revalidate]);

  const refreshEmail = useCallback(() => {
    revalidate(emailConfiguration.mutate(), "email providers");
    revalidate(emailInbox.mutate(), "email inbox");
  }, [emailConfiguration, emailInbox, revalidate]);

  const agentTypeOptions = useMemo(() => (agentTypes.data ?? []).map(type => type.type), [agentTypes.data]);
  /** The messaging-capable type to launch, or null when none is configured (the user then picks one). */
  const messagingAgentType = MESSAGING_AGENT_TYPES.find(name => agentTypeOptions.includes(name)) ?? null;
  const agentTypesLoaded = agentTypes.data !== undefined;

  /**
   * Launches `agentType`, or the configured messaging type. Never falls back to
   * an arbitrary type: without a messaging type the caller must name one.
   */
  const launchMessagingAgent = useCallback(
    async (agentType?: string) => {
      const type = agentType ?? messagingAgentType;
      if (!type) {
        toastManager.error("Choose an agent type to launch", { duration: 4000 });
        return;
      }
      setCreatingAgent(true);
      try {
        const { id } = await agentRPCClient.createAgent({ agentType: type });
        await agents.mutate();
        void navigate(`/agent/${id}`);
      } catch (error) {
        toastManager.error(formatError(error), { duration: 5000 });
      } finally {
        setCreatingAgent(false);
      }
    },
    [agents, messagingAgentType, navigate],
  );

  const emailStatValue = (() => {
    if (emailProvidersFailed) return "Unavailable";
    if (emailConfiguration.isLoading && !emailConfiguration.data) return "…";
    if (providers.length === 0) return "None";
    if (emailInbox.error && !emailInbox.data) return "Error";
    if (unreadEmailCount > 0) return `${unreadEmailCount} unread`;
    return `${emailMessages.length} recent`;
  })();

  return {
    navigate,
    bots,
    agents,
    emailConfiguration,
    emailInbox,
    loading,
    botList,
    services,
    connectedServiceNames,
    providers,
    primaryEmailProvider,
    liveConversations,
    channelCards,
    connectedCount,
    emailMessages,
    emailStatValue,
    emailProvidersFailed,
    emailProvidersLoading,
    messagingAgents,
    targetOptions,
    creatingAgent,
    agentTypeOptions,
    messagingAgentType,
    agentTypesLoaded,
    canSend: services.length > 0 || targetOptions.length > 0,
    // Gate a panel's spinner on bots only, so email/agents can stream in after first paint.
    isLoading: bots.isLoading && !bots.data,
    botsFailed: loading.hasHardError,
    refresh,
    refreshEmail,
    launchMessagingAgent,
  };
}
