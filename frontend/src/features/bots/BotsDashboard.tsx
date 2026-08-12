import formatError from "@tokenring-ai/utility/error/formatError";
import {
  Activity,
  AlertTriangle,
  AtSign,
  Bot,
  Cpu,
  Hash,
  Loader2,
  LogIn,
  LogOut,
  MessageSquare,
  MessagesSquare,
  Plug,
  PlugZap,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Shield,
  Trash2,
  User,
  UserPlus,
  Users,
} from "lucide-react";
import type { ReactNode } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import NavigationSidebarHeader from "../../components/layout/NavigationSidebarHeader.tsx";
import WorkspaceShell from "../../components/layout/WorkspaceShell.tsx";
import AppPageHeader from "../../components/ui/AppPageHeader.tsx";
import ConversationRow from "../../components/ui/ConversationRow.tsx";
import EmptyState from "../../components/ui/EmptyState.tsx";
import ErrorState from "../../components/ui/ErrorState.tsx";
import FilterTabs, { type FilterTabOption } from "../../components/ui/FilterTabs.tsx";
import StatusBadge, { type StatusBadgeDefinition } from "../../components/ui/StatusBadge.tsx";
import SummaryStat from "../../components/ui/SummaryStat.tsx";
import { toastManager } from "../../components/ui/toast.tsx";
import { useAsyncActionGuard } from "../../hooks/useAsyncActionGuard.ts";
import { useConfirmDialog } from "../../hooks/useConfirmDialog.tsx";
import { type FilterTabDefinition, useFilterTabs } from "../../hooks/useFilterTabs.ts";
import { useLiveStreamStatusFromSWR } from "../../hooks/useLiveStreamStatus.ts";
import { useSearchFilter } from "../../hooks/useSearchFilter.ts";
import { useTabState } from "../../hooks/useTabState.ts";
import { useTick } from "../../hooks/useTick.ts";
import { formatConfigIssues } from "../../lib/configWrites.ts";
import { getServiceBrand } from "../../lib/serviceGradient.ts";
import { cn } from "../../lib/utils.ts";
import { botRPCClient, useBots, useConfigSchema } from "../../rpc.ts";
import ConnectServiceForm, { type ConnectablePlatform, PLATFORMS } from "./ConnectServiceForm.tsx";
import CreateBotForm from "./CreateBotForm.tsx";
import { formatDirectMessagePolicy, formatRelativeTime } from "./formatters.ts";
import SendMessageForm, { type MessageTargetOption } from "./SendMessageForm.tsx";

type BotsData = NonNullable<ReturnType<typeof useBots>["data"]>;
type BotSummary = BotsData["bots"][number];
type BotChannel = BotSummary["channels"][number];
type BotUser = BotSummary["users"][number];
type DiscoveredChannel = BotsData["discoveredChannels"][number];

type DetailTab = "conversations" | "channels" | "people";
type ConversationFilter = "all" | "busy";
type BotConversation = BotSummary["conversations"][number];

const CONVERSATION_FILTER_TAB_DEFS: FilterTabDefinition<BotConversation, ConversationFilter>[] = [
  { id: "all", label: "All" },
  { id: "busy", label: "Busy", predicate: c => c.busy },
];

/** Everything a bot addresses is `service:id`, people included. */
const TARGET_PATTERN = /^[^:]+:.+/;

/** Plugin package name used by ConfigurationApp deep links. */
const BOT_PLUGIN_NAME = "@tokenring-ai/bot";
const BOT_CONFIG_HREF = `/configuration/${encodeURIComponent(BOT_PLUGIN_NAME)}`;

const CONFIG_EXAMPLE = `bot:
  bots:
    helper:
      agentType: assistant
      users:
        "slack:U123ABC": admin
      channels:
        engineering:
          target: slack:C0123ABCD`;

const ROLE_BADGES: Record<BotUser["role"], StatusBadgeDefinition> = {
  admin: {
    label: "Admin",
    icon: <Shield className="w-3 h-3" />,
    colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  user: {
    label: "User",
    icon: <User className="w-3 h-3" />,
    colorClass: "bg-tertiary text-muted border-primary",
  },
};

function ServicePill({ service, connected }: { service: string; connected: boolean }) {
  const brand = getServiceBrand(service);
  const label = brand.displayName;
  return (
    <StatusBadge
      label={label}
      icon={connected ? <PlugZap className="w-3 h-3" /> : <Plug className="w-3 h-3" />}
      colorClass={connected ? cn(brand.solidBg, brand.solidText, brand.solidBorder) : "bg-tertiary text-muted border-primary"}
      className={connected ? undefined : "line-through decoration-1"}
      title={connected ? `${label} is connected` : `${label} is not connected`}
    />
  );
}

function RolePill({ role }: { role: BotUser["role"] }) {
  return <StatusBadge status={role} statuses={ROLE_BADGES} />;
}

function SetupStep({ step, title, done, action }: { step: number; title: string; done: boolean; action?: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        className={cn(
          "shrink-0 w-5 h-5 rounded-full grid place-items-center text-xs font-semibold tabular-nums",
          done ? "bg-teal-500/15 text-teal-600 dark:text-teal-400" : "bg-tertiary text-muted border border-primary",
        )}
      >
        {done ? "✓" : step}
      </span>
      <span className={cn("flex-1 text-xs", done ? "text-muted line-through decoration-1" : "text-primary")}>{title}</span>
      {done ? null : action}
    </li>
  );
}

export default function BotsDashboard() {
  const navigate = useNavigate();
  const { botId: routeBotId } = useParams<{ botId?: string }>();
  const bots = useBots();
  const streamStatus = useLiveStreamStatusFromSWR(bots);
  const configSchema = useConfigSchema();

  // URL is the source of truth for which bot is open (params are already decoded).
  const selectedBotName = routeBotId ?? null;

  const [conversationFilter, setConversationFilter] = useState<ConversationFilter>("all");
  const [showSendForm, setShowSendForm] = useState(false);
  const [sendTarget, setSendTarget] = useState<string | undefined>(undefined);
  const { openConfirm, Dialog: ConfirmDialog } = useConfirmDialog();
  const [showCreateBot, setShowCreateBot] = useState(false);
  const [connectPlatform, setConnectPlatform] = useState<ConnectablePlatform | "any" | null>(null);
  const { activeKey: busyAction, execute: executeBusy } = useAsyncActionGuard();

  const data = bots.data;
  const botList = useMemo(() => data?.bots ?? [], [data]);
  const services = useMemo(() => data?.services ?? [], [data]);
  const groups = useMemo(() => data?.groups ?? [], [data]);
  const discoveredChannels = useMemo(() => data?.discoveredChannels ?? [], [data]);
  const connectedServices = useMemo(() => new Set(services.map(service => service.name)), [services]);

  /** Only offer to connect a platform whose plugin is actually installed. */
  const availablePlatforms = useMemo<ConnectablePlatform[]>(() => {
    const plugins = configSchema.data?.plugins;
    // Schema still loading or failed: keep the connect affordance available.
    // Once the schema arrives empty of these slices, hide it (plugin not installed).
    if (!plugins) return Object.keys(PLATFORMS) as ConnectablePlatform[];
    const slices = new Set(plugins.flatMap(plugin => Object.keys(plugin.slices)));
    return (Object.keys(PLATFORMS) as ConnectablePlatform[]).filter(platform => slices.has(PLATFORMS[platform].configKey));
  }, [configSchema.data]);

  const openBot = useCallback(
    (name: string, options?: { replace?: boolean }) => {
      void navigate(`/bots/${encodeURIComponent(name)}`, options?.replace ? { replace: true } : undefined);
    },
    [navigate],
  );

  // Keep a valid bot selected as the list loads and changes; bare `/bots` opens the first bot.
  useEffect(() => {
    if (bots.isLoading) return;
    if (botList.length === 0) {
      if (routeBotId) void navigate("/bots", { replace: true });
      return;
    }
    if (!selectedBotName || !botList.some(bot => bot.name === selectedBotName)) {
      openBot(botList[0]!.name, { replace: true });
    }
  }, [botList, selectedBotName, routeBotId, bots.isLoading, navigate, openBot]);

  // Live-tick relative timestamps while conversations exist
  useTick(
    30_000,
    botList.some(bot => bot.conversations.length > 0),
  );

  const selectedBot = useMemo(() => botList.find(bot => bot.name === selectedBotName), [botList, selectedBotName]);

  const totalChannels = useMemo(() => botList.reduce((count, bot) => count + bot.channels.length, 0), [botList]);
  const totalConversations = useMemo(() => botList.reduce((count, bot) => count + bot.conversations.length, 0), [botList]);
  const busyConversations = useMemo(() => botList.reduce((count, bot) => count + bot.conversations.filter(c => c.busy).length, 0), [botList]);

  /** Every messaging service bots / groups reference, including ones that are offline. */
  const referencedServices = useMemo(() => {
    const names = new Set<string>();
    for (const bot of botList) {
      for (const channel of bot.channels) names.add(channel.service);
      for (const user of bot.users) names.add(user.service);
      for (const conversation of bot.conversations) names.add(conversation.service);
    }
    for (const group of groups) {
      for (const member of group.members) {
        const separator = member.indexOf(":");
        if (separator > 0) names.add(member.slice(0, separator));
      }
    }
    for (const service of services) names.add(service.name);
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [botList, groups, services]);

  const disconnectedServices = useMemo(
    () => referencedServices.filter(name => !connectedServices.has(name) && name !== "group"),
    [referencedServices, connectedServices],
  );

  const serviceLimits = useMemo(() => new Map(services.map(service => [service.name, service.maxMessageLength])), [services]);

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

  // Per-tab search so typing in one list does not surprise-filter another after a tab switch.
  const {
    query: conversationsQuery,
    setQuery: setConversationsQuery,
    filtered: filteredConversations,
  } = useSearchFilter({
    items: selectedBot?.conversations ?? [],
    searchFields: conversation =>
      [conversation.key, conversation.conversationId, conversation.channelName, conversation.agentType, conversation.service].filter(Boolean).join(" "),
    predicate: conversation => conversationFilter !== "busy" || conversation.busy,
  });

  const {
    query: channelsQuery,
    setQuery: setChannelsQuery,
    filtered: filteredChannels,
  } = useSearchFilter({
    items: selectedBot?.channels ?? [],
    searchFields: channel => [channel.name, channel.target, channel.service, channel.agentType, ...channel.allowedUsers].join(" "),
  });

  const {
    query: usersQuery,
    setQuery: setUsersQuery,
    filtered: filteredUsers,
  } = useSearchFilter({
    items: selectedBot?.users ?? [],
    searchFields: user => [user.target, user.userId, user.service, user.role].join(" "),
  });

  const clearListState = useCallback(() => {
    setConversationFilter("all");
    setConversationsQuery("");
    setChannelsQuery("");
    setUsersQuery("");
  }, [setConversationsQuery, setChannelsQuery, setUsersQuery]);

  const {
    activeTab: tab,
    setActiveTab: setTab,
    resetTab,
  } = useTabState<DetailTab>(["conversations", "channels", "people"], {
    defaultTab: "conversations",
    onTabChange: clearListState,
  });

  const listQuery = tab === "conversations" ? conversationsQuery : tab === "channels" ? channelsQuery : usersQuery;
  const setListQuery = tab === "conversations" ? setConversationsQuery : tab === "channels" ? setChannelsQuery : setUsersQuery;

  const tabs = useMemo<FilterTabOption<DetailTab>[]>(
    () => [
      { id: "conversations", label: "Conversations", count: selectedBot?.conversations.length ?? 0 },
      { id: "channels", label: "Channels", count: selectedBot?.channels.length ?? 0 },
      { id: "people", label: "People", count: selectedBot?.users.length ?? 0 },
    ],
    [selectedBot],
  );

  const { tabs: conversationFilterTabs } = useFilterTabs(selectedBot?.conversations ?? [], CONVERSATION_FILTER_TAB_DEFS);

  const refresh = () => void bots.mutate();

  const openSendForm = (target?: string) => {
    setSendTarget(target);
    setShowSendForm(true);
  };

  const handleReset = async (bot: string, conversationKey: string) => {
    const confirmed = await openConfirm({
      title: "Reset conversation?",
      message: `The agent behind ${conversationKey} will be deleted. The next message there starts a fresh conversation with no history.`,
      confirmText: "Reset",
      variant: "warning",
    });
    if (!confirmed) return;
    await executeBusy(`reset:${conversationKey}`, async () => {
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
      }
    });
  };

  const handleDeleteBot = async (name: string) => {
    const confirmed = await openConfirm({
      title: "Delete this bot?",
      message: `"${name}" stops answering everywhere and its live conversations end. The channels it sat in are unaffected on Slack and Telegram — it simply stops listening.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!confirmed) return;
    await executeBusy(`deleteBot:${name}`, async () => {
      try {
        const result = await botRPCClient.deleteBot({ name });
        if (result.status === "botNotFound") {
          toastManager.warning(`Bot "${name}" is already gone`, { duration: 3000 });
        } else if (result.status === "definedElsewhere") {
          toastManager.warning(`"${name}" is defined in a configuration file below this one and is still running. Remove it there to delete it.`, {
            duration: 7000,
          });
        } else if (result.status === "configRejected") {
          toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
        } else {
          toastManager.success(`Bot "${name}" deleted`, { duration: 2500 });
        }
        await bots.mutate();
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  const handleSetUserRole = useCallback(
    async (bot: string, target: string, role: BotUser["role"]): Promise<boolean> => {
      // `bot` is captured by the caller at click time so a mid-flight sidebar
      // switch cannot retarget the RPC or the success toast.
      const ok = await executeBusy(`user:${target}`, async () => {
        try {
          const result = await botRPCClient.setUserRole({ bot, target, role });
          if (result.status === "botNotFound") {
            toastManager.error(`Bot "${bot}" no longer exists`, { duration: 4000 });
            return false;
          }
          if (result.status === "configRejected") {
            toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
            return false;
          }
          toastManager.success(`${target} is now ${role === "admin" ? "an admin" : "a user"} of "${bot}"`, { duration: 2500 });
          await bots.mutate();
          return true;
        } catch (err) {
          toastManager.error(formatError(err), { duration: 5000 });
          return false;
        }
      });
      return ok ?? false;
    },
    [bots, executeBusy],
  );

  const handleRemoveUser = useCallback(
    async (bot: string, target: string) => {
      await executeBusy(`user:${target}`, async () => {
        try {
          const result = await botRPCClient.removeUser({ bot, target });
          if (result.status === "botNotFound") {
            toastManager.error(`Bot "${bot}" no longer exists`, { duration: 4000 });
          } else if (result.status === "definedElsewhere") {
            toastManager.warning(`${target} is listed in a configuration file below this one and still has access. Remove them there.`, { duration: 7000 });
          } else if (result.status === "configRejected") {
            toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
          } else {
            toastManager.success(`${target} removed from "${bot}"`, { duration: 2500 });
          }
          await bots.mutate();
        } catch (err) {
          toastManager.error(formatError(err), { duration: 5000 });
        }
      });
    },
    [bots, executeBusy],
  );

  const handleJoin = useCallback(
    async (bot: string, target: string, name?: string) => {
      await executeBusy(`join:${target}`, async () => {
        try {
          const result = await botRPCClient.joinChannel({
            bot,
            target,
            ...(name?.trim() ? { name: name.trim() } : {}),
          });
          if (result.status === "botNotFound") {
            toastManager.error(`Bot "${bot}" no longer exists`, { duration: 4000 });
          } else if (result.status === "providerNotFound") {
            toastManager.error(`No messaging service is connected for ${target}`, { duration: 4000 });
          } else if (result.status === "configRejected") {
            toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
          } else {
            toastManager.success(`"${bot}" joined ${name?.trim() || target}`, { duration: 2500 });
          }
          await bots.mutate();
        } catch (err) {
          toastManager.error(formatError(err), { duration: 5000 });
        }
      });
    },
    [bots, executeBusy],
  );

  /** Join a discovered channel into the bot currently selected in the sidebar. */
  const joinDiscoveredChannel = useCallback(
    (channel: DiscoveredChannel) => {
      if (!selectedBotName) return;
      void handleJoin(selectedBotName, channel.target, channel.title);
    },
    [selectedBotName, handleJoin],
  );

  const handleLeave = async (bot: string, target: string, name: string) => {
    const confirmed = await openConfirm({
      title: "Leave this channel?",
      message: `"${bot}" will stop answering in ${name} (${target}). It stays a member of the room on the platform — remove it there if you want it gone entirely.`,
      confirmText: "Leave",
      variant: "warning",
    });
    if (!confirmed) return;
    await executeBusy(`leave:${target}`, async () => {
      try {
        const result = await botRPCClient.leaveChannel({ bot, target });
        if (result.status === "botNotFound") {
          toastManager.error(`Bot "${bot}" no longer exists`, { duration: 4000 });
        } else if (result.status === "definedElsewhere") {
          toastManager.warning(`This channel is configured in a file below this layer, so "${bot}" is still answering there. Remove it there to leave.`, {
            duration: 7000,
          });
        } else if (result.status === "configRejected") {
          toastManager.error(formatConfigIssues(result.issues), { duration: 6000 });
        } else {
          toastManager.success(`"${bot}" left ${target}`, { duration: 2500 });
        }
        await bots.mutate();
      } catch (err) {
        toastManager.error(formatError(err), { duration: 5000 });
      }
    });
  };

  const isLoading = bots.isLoading && streamStatus.isInitial;
  const canSend = services.length > 0 || groups.length > 0;

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
          onClick={() => {
            setShowCreateBot(true);
            setConnectPlatform(null);
            setShowSendForm(false);
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-lg focus-ring cursor-pointer shadow-sm"
          title="Create a bot"
        >
          <Plus className="w-3.5 h-3.5" />
          New bot
        </button>
        {availablePlatforms.length > 0 ? (
          <button
            type="button"
            onClick={() => {
              setConnectPlatform("any");
              setShowCreateBot(false);
              setShowSendForm(false);
            }}
            className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
            title="Connect a Slack or Telegram account"
          >
            <PlugZap className="w-3.5 h-3.5" />
            Connect service
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => openSendForm(undefined)}
          disabled={!canSend}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-teal-600 hover:bg-teal-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg focus-ring cursor-pointer shadow-sm"
          title={!canSend ? "No messaging service or group is available" : "Send a message"}
        >
          <Send className="w-3.5 h-3.5" />
          Send message
        </button>
        <Link
          to={BOT_CONFIG_HREF}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring"
          title="Edit bots, channels, and groups"
        >
          <Settings2 className="w-3.5 h-3.5" />
          Configure
        </Link>
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

      <WorkspaceShell
        appId="bots"
        title="Bots"
        navigationLabel="Bots"
        hasSelection={selectedBotName !== null || showCreateBot}
        className="flex-1"
        navigation={
          <div className="h-full flex flex-col min-h-0 bg-secondary">
            <NavigationSidebarHeader
              title="Bots"
              meta={botList.length}
              actions={[
                {
                  icon: <Plus className="w-3.5 h-3.5" />,
                  label: "Add bot",
                  onClick: () => {
                    setShowCreateBot(true);
                    setConnectPlatform(null);
                    setShowSendForm(false);
                  },
                },
              ]}
            />
            <nav className="flex-1 overflow-y-auto p-2 space-y-1" aria-label="Bots">
              {botList.map(bot => {
                const active = bot.name === selectedBotName;
                const busy = bot.conversations.filter(conversation => conversation.busy).length;
                return (
                  <button
                    key={bot.name}
                    type="button"
                    onClick={() => {
                      openBot(bot.name);
                      resetTab();
                      clearListState();
                    }}
                    aria-current={active ? "page" : undefined}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-lg text-left focus-ring ${active ? "bg-active text-primary" : "text-secondary hover:text-primary hover:bg-hover"}`}
                  >
                    <span className="w-7 h-7 rounded-lg bg-teal-500/15 text-teal-500 grid place-items-center shrink-0">
                      <Bot className="w-3.5 h-3.5" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-xs font-medium truncate">{bot.displayName}</span>
                      <span className="block text-xs text-muted truncate">
                        {bot.channels.length} channels · {bot.conversations.length} conversations
                      </span>
                    </span>
                    {busy > 0 && <span className="text-xs text-amber-500 tabular-nums">{busy}</span>}
                  </button>
                );
              })}
              {!isLoading && botList.length === 0 && <p className="px-2 py-6 text-center text-xs text-muted">No bots configured</p>}
            </nav>
          </div>
        }
      >
        <div className="h-full overflow-y-auto px-4 sm:px-6 py-6">
          <div className="max-w-5xl mx-auto space-y-6">
            {isLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="w-7 h-7 text-muted animate-spin" />
              </div>
            ) : streamStatus.status === "error" ? (
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
                  <SummaryStat
                    label="Services"
                    value={disconnectedServices.length > 0 ? `${services.length} · ${disconnectedServices.length} offline` : String(services.length)}
                    icon={<Plug className="w-4 h-4" />}
                    accentClass="text-amber-500"
                  />
                </div>

                {disconnectedServices.length > 0 ? (
                  <div className="flex items-start gap-3 px-4 py-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-amber-700 dark:text-amber-300">
                        {disconnectedServices.length === 1
                          ? `Messaging service "${disconnectedServices[0]}" is not connected`
                          : `${disconnectedServices.length} messaging services are not connected`}
                      </p>
                      <p className="text-xs text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                        Bots that target {disconnectedServices.map(name => `"${name}"`).join(", ")} cannot send or receive until those accounts are configured
                        (Slack, Telegram, …).
                      </p>
                    </div>
                  </div>
                ) : null}

                {connectPlatform ? (
                  <ConnectServiceForm
                    available={availablePlatforms}
                    initialPlatform={connectPlatform === "any" ? undefined : connectPlatform}
                    existingAccounts={[...connectedServices]}
                    onConnected={() => {
                      setConnectPlatform(null);
                      void bots.mutate();
                    }}
                    onCancel={() => setConnectPlatform(null)}
                  />
                ) : null}

                {showCreateBot ? (
                  <CreateBotForm
                    existingNames={botList.map(bot => bot.name)}
                    services={services.map(service => service.name)}
                    onCreated={name => {
                      setShowCreateBot(false);
                      openBot(name);
                      setTab("channels");
                      void bots.mutate();
                    }}
                    onCancel={() => setShowCreateBot(false)}
                  />
                ) : null}

                {showSendForm ? (
                  <SendMessageForm
                    // Remount when the prefilled target changes so "Message" on a
                    // different row does not leave the previous selection stuck.
                    key={sendTarget ?? "__default__"}
                    options={targetOptions}
                    initialTarget={sendTarget}
                    onSent={() => {
                      setShowSendForm(false);
                      void bots.mutate();
                    }}
                    onCancel={() => setShowSendForm(false)}
                  />
                ) : null}

                {botList.length === 0 && !showCreateBot ? (
                  <div className="px-6 py-12 text-center bg-secondary border border-primary border-dashed rounded-xl">
                    <Bot className="w-10 h-10 text-muted mx-auto mb-3 opacity-50" />
                    <p className="text-sm font-medium text-primary mb-1">No bots yet</p>
                    <p className="text-xs text-muted max-w-md mx-auto mb-5">
                      A bot pairs an agent type with the people and channels it may talk to. Three steps: connect a Slack or Telegram account, create a bot,
                      then invite it to a channel and join it from here.
                    </p>

                    <ol className="max-w-sm mx-auto text-left space-y-2 mb-5">
                      <SetupStep
                        step={1}
                        title="Connect a messaging service"
                        done={services.length > 0}
                        action={
                          availablePlatforms.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => {
                                setConnectPlatform("any");
                                setShowCreateBot(false);
                                setShowSendForm(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-md focus-ring cursor-pointer"
                            >
                              <PlugZap className="w-3 h-3" /> Connect
                            </button>
                          ) : (
                            <Link to={BOT_CONFIG_HREF} className="text-xs text-muted hover:text-primary focus-ring rounded-md">
                              Install a plugin
                            </Link>
                          )
                        }
                      />
                      <SetupStep
                        step={2}
                        title="Create a bot"
                        done={false}
                        action={
                          <button
                            type="button"
                            onClick={() => {
                              setShowCreateBot(true);
                              setConnectPlatform(null);
                              setShowSendForm(false);
                            }}
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium bg-teal-600 hover:bg-teal-500 text-white rounded-md focus-ring cursor-pointer"
                          >
                            <Plus className="w-3 h-3" /> New bot
                          </button>
                        }
                      />
                      <SetupStep step={3} title="Invite it to a channel, then join it here" done={false} />
                    </ol>

                    <details className="max-w-md mx-auto text-left">
                      <summary className="text-xs text-muted cursor-pointer hover:text-primary">Or configure it by hand</summary>
                      <pre className="text-xs text-muted bg-tertiary border border-primary rounded-lg p-3 mt-2 overflow-x-auto">{CONFIG_EXAMPLE}</pre>
                      <Link to={BOT_CONFIG_HREF} className="inline-flex items-center gap-1.5 mt-2 text-xs text-muted hover:text-primary focus-ring rounded-md">
                        <Settings2 className="w-3 h-3" />
                        Open bot configuration
                      </Link>
                    </details>
                  </div>
                ) : botList.length === 0 ? null : (
                  <>
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {botList.map(bot => {
                        const isSelected = bot.name === selectedBotName;
                        const busy = bot.conversations.filter(conversation => conversation.busy).length;
                        const offlineChannels = bot.channels.filter(channel => !channel.connected).length;
                        return (
                          <button
                            key={bot.name}
                            type="button"
                            onClick={() => {
                              openBot(bot.name);
                              resetTab();
                              clearListState();
                            }}
                            className={cn(
                              "text-left bg-secondary border rounded-xl p-4 shadow-sm transition-colors focus-ring cursor-pointer",
                              isSelected ? "border-accent ring-1 ring-accent/30" : "border-primary hover:bg-hover/40",
                            )}
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-primary truncate">{bot.displayName}</p>
                                <p className="text-xs text-muted truncate">{bot.name}</p>
                              </div>
                              <div className="flex items-center gap-1.5 shrink-0">
                                {offlineChannels > 0 ? (
                                  <span
                                    className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400"
                                    title="Channels on offline services"
                                  >
                                    <AlertTriangle className="w-3 h-3" /> {offlineChannels}
                                  </span>
                                ) : null}
                                {busy > 0 ? (
                                  <span className="inline-flex items-center gap-1 text-xs text-amber-600 dark:text-amber-400">
                                    <Activity className="w-3 h-3 animate-pulse" /> {busy}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5">
                              <StatusBadge label={bot.agentType} icon={<Cpu className="w-3 h-3" />} colorClass="bg-tertiary text-muted border-primary" />
                              {[...new Set(bot.channels.map(channel => channel.service))].map(service => (
                                <ServicePill key={service} service={service} connected={connectedServices.has(service)} />
                              ))}
                            </div>
                            <div className="flex items-center gap-3 mt-3 text-xs text-muted">
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
                            <p className="text-xs text-muted truncate">
                              Agent type <span className="text-primary font-medium">{selectedBot.agentType}</span> · DMs:{" "}
                              <span className="text-primary font-medium">{formatDirectMessagePolicy(selectedBot.directMessages)}</span>
                              {selectedBot.joinMessage ? (
                                <>
                                  {" "}
                                  · Join: <span className="text-primary font-medium">“{selectedBot.joinMessage}”</span>
                                </>
                              ) : null}
                            </p>
                          </div>
                          {selectedBot.requireMention ? (
                            <StatusBadge label="Mention required" icon={<AtSign className="w-3 h-3" />} colorClass="bg-tertiary text-muted border-primary" />
                          ) : (
                            <StatusBadge
                              label="Answers everything"
                              icon={<MessageSquare className="w-3 h-3" />}
                              colorClass="bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/30"
                            />
                          )}
                          <Link
                            to={BOT_CONFIG_HREF}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring transition-colors"
                            title="Edit this bot's channels, people, and policy"
                          >
                            <Settings2 className="w-3 h-3" /> Edit config
                          </Link>
                          <button
                            type="button"
                            onClick={() => void handleDeleteBot(selectedBot.name)}
                            disabled={busyAction === `deleteBot:${selectedBot.name}`}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-rose-500 border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete this bot"
                          >
                            {busyAction === `deleteBot:${selectedBot.name}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                            Delete
                          </button>
                        </div>

                        <FilterTabs tabs={tabs} value={tab} onChange={setTab} showZeroCounts />

                        {(tab === "conversations" && selectedBot.conversations.length > 0) ||
                        (tab === "channels" && selectedBot.channels.length > 0) ||
                        (tab === "people" && selectedBot.users.length > 0) ? (
                          <div className="px-4 py-2 border-b border-primary flex flex-wrap items-center gap-2">
                            {tab === "conversations" ? (
                              <div className="flex items-center gap-1">
                                {conversationFilterTabs.map(option => (
                                  <button
                                    key={option.id}
                                    type="button"
                                    onClick={() => setConversationFilter(option.id)}
                                    className={cn(
                                      "inline-flex items-center gap-1 px-2 py-1 text-xs rounded-md border transition-colors focus-ring cursor-pointer",
                                      conversationFilter === option.id
                                        ? "border-accent text-primary bg-accent/10"
                                        : "border-primary text-muted hover:text-primary",
                                    )}
                                  >
                                    {option.label}
                                    <span className="tabular-nums opacity-70">{option.count ?? 0}</span>
                                  </button>
                                ))}
                              </div>
                            ) : null}
                            <label className="relative flex-1 min-w-[10rem]">
                              <Search className="w-3.5 h-3.5 text-muted absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                              <input
                                type="search"
                                value={listQuery}
                                onChange={e => setListQuery(e.target.value)}
                                placeholder={tab === "conversations" ? "Filter conversations…" : tab === "channels" ? "Filter channels…" : "Filter people…"}
                                className="w-full bg-input border border-primary rounded-md pl-8 pr-3 py-1.5 text-xs text-primary placeholder-muted focus-accent"
                              />
                            </label>
                          </div>
                        ) : null}

                        {tab === "conversations" ? (
                          selectedBot.conversations.length === 0 ? (
                            <EmptyState
                              icon={MessagesSquare}
                              title="No live conversations"
                              hint="A conversation starts — with an agent of its own — the first time someone messages this bot in a channel or a DM."
                            />
                          ) : filteredConversations.length === 0 ? (
                            <EmptyState
                              icon={Search}
                              title="No matching conversations"
                              hint={conversationFilter === "busy" ? "Nothing is busy right now." : "Try a different filter or search."}
                            />
                          ) : (
                            <div className="divide-y divide-primary">
                              {filteredConversations.map(conversation => (
                                <ConversationRow
                                  key={conversation.key}
                                  conversation={conversation}
                                  connected={connectedServices.has(conversation.service)}
                                  busyAction={busyAction}
                                  onOpenAgent={() => void navigate(`/agent/${conversation.agentId}`)}
                                  onMessage={() => openSendForm(conversation.key)}
                                  onReset={() => void handleReset(selectedBot.name, conversation.key)}
                                />
                              ))}
                            </div>
                          )
                        ) : null}

                        {tab === "channels" ? (
                          selectedBot.channels.length === 0 ? (
                            <EmptyState
                              icon={Hash}
                              title="Not in any channels"
                              hint="Invite the bot to a Slack channel or Telegram group and join it from the Discovered channels panel below, or add one under this bot's `channels` config."
                            />
                          ) : filteredChannels.length === 0 ? (
                            <EmptyState icon={Search} title="No matching channels" hint="Try a different search." />
                          ) : (
                            <div className="divide-y divide-primary">
                              {filteredChannels.map(channel => (
                                <ChannelRow
                                  key={channel.target}
                                  channel={channel}
                                  busyAction={busyAction}
                                  onMessage={() => openSendForm(channel.target)}
                                  onLeave={() => void handleLeave(selectedBot.name, channel.target, channel.name)}
                                />
                              ))}
                            </div>
                          )
                        ) : null}

                        {tab === "people" ? (
                          <>
                            <AddPersonForm
                              services={services.map(service => service.name)}
                              existingTargets={selectedBot.users.map(user => user.target)}
                              busy={busyAction?.startsWith("user:") ?? false}
                              onAdd={async (target, role) => {
                                const botName = selectedBot.name;
                                return handleSetUserRole(botName, target, role);
                              }}
                            />
                            {selectedBot.users.length === 0 ? (
                              <EmptyState
                                icon={Users}
                                title="Nobody listed"
                                hint={
                                  selectedBot.directMessages === "anyone"
                                    ? "This bot answers DMs from anyone, so no one has to be listed — but only listed admins can run commands."
                                    : selectedBot.directMessages === "none"
                                      ? "Direct messages are disabled for this bot. List admins here so they can still run slash commands."
                                      : "Nobody can DM this bot until someone is listed here. Admins may also run slash commands."
                                }
                              />
                            ) : filteredUsers.length === 0 ? (
                              <EmptyState icon={Search} title="No matching people" hint="Try a different search." />
                            ) : (
                              <div className="divide-y divide-primary">
                                {filteredUsers.map(user => (
                                  <UserRow
                                    key={user.target}
                                    user={user}
                                    botName={selectedBot.name}
                                    connected={connectedServices.has(user.service)}
                                    busyAction={busyAction}
                                    onMessage={() => openSendForm(user.target)}
                                    onChangeRole={(botName, role) => void handleSetUserRole(botName, user.target, role)}
                                    onRemove={botName => void handleRemoveUser(botName, user.target)}
                                  />
                                ))}
                              </div>
                            )}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </>
                )}

                <div className="grid gap-3 lg:grid-cols-2">
                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-primary flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-primary">Messaging services</h3>
                      <div className="flex items-center gap-2">
                        {referencedServices.length > 0 ? (
                          <span className="text-xs text-muted tabular-nums">
                            {services.length} connected
                            {disconnectedServices.length > 0 ? ` · ${disconnectedServices.length} offline` : ""}
                          </span>
                        ) : null}
                        {availablePlatforms.length > 0 ? (
                          <button
                            type="button"
                            onClick={() => {
                              setConnectPlatform("any");
                              setShowCreateBot(false);
                              setShowSendForm(false);
                            }}
                            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
                            title="Connect a Slack or Telegram account"
                          >
                            <PlugZap className="w-3 h-3" /> Connect
                          </button>
                        ) : null}
                      </div>
                    </div>
                    {referencedServices.length === 0 ? (
                      <div className="px-4 py-6 text-center">
                        <p className="text-xs text-muted mb-3">No messaging service is connected. Your bots have nowhere to talk yet.</p>
                        <div className="flex items-center justify-center gap-2">
                          {availablePlatforms.map(platform => (
                            <button
                              key={platform}
                              type="button"
                              onClick={() => {
                                setConnectPlatform(platform);
                                setShowCreateBot(false);
                                setShowSendForm(false);
                              }}
                              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors"
                            >
                              <PlugZap className="w-3 h-3" /> Connect {PLATFORMS[platform].label}
                            </button>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="divide-y divide-primary">
                        {referencedServices.map(name => {
                          const connected = connectedServices.has(name);
                          const limit = serviceLimits.get(name);
                          return (
                            <div key={name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                              <ServicePill service={name} connected={connected} />
                              <span className="text-xs text-muted tabular-nums">
                                {connected && limit != null ? `${limit.toLocaleString()} char limit` : connected ? "Connected" : "Not connected"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-primary flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-primary">Broadcast groups</h3>
                      <Link
                        to={BOT_CONFIG_HREF}
                        className="inline-flex items-center gap-1 text-xs text-muted hover:text-primary focus-ring rounded-md"
                        title="Edit groups in configuration"
                      >
                        <Settings2 className="w-3 h-3" /> Edit
                      </Link>
                    </div>
                    {groups.length === 0 ? (
                      <p className="px-4 py-6 text-xs text-muted text-center">
                        No groups configured. Groups let one message reach several people across platforms at once.
                      </p>
                    ) : (
                      <div className="divide-y divide-primary">
                        {groups.map(group => (
                          <div key={group.name} className="px-4 py-2.5 flex items-center justify-between gap-3">
                            <div className="min-w-0">
                              <p className="text-xs font-medium text-primary truncate">group:{group.name}</p>
                              <p className="text-xs text-muted truncate">{group.members.join(", ")}</p>
                            </div>
                            <button
                              type="button"
                              onClick={() => openSendForm(`group:${group.name}`)}
                              disabled={!canSend}
                              className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Send className="w-3 h-3" /> Message
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {discoveredChannels.length > 0 ? (
                  <div className="bg-secondary border border-primary rounded-xl shadow-sm overflow-hidden">
                    <div className="px-4 py-2.5 border-b border-primary flex items-center justify-between gap-2">
                      <h3 className="text-xs font-semibold text-primary">Discovered channels</h3>
                      <span className="text-xs text-muted tabular-nums">{discoveredChannels.length} waiting</span>
                    </div>
                    <p className="px-4 pt-3 text-xs text-muted">
                      {selectedBot
                        ? `Rooms this app has been added to that no bot answers in yet. Joining adds the channel to "${selectedBot.displayName}".`
                        : "Rooms this app has been added to that no bot answers in yet. Select a bot above to join one."}
                    </p>
                    <div className="divide-y divide-primary mt-2">
                      {discoveredChannels.map(channel => (
                        <DiscoveredChannelRow
                          key={channel.target}
                          channel={channel}
                          botName={selectedBotName ?? undefined}
                          busyAction={busyAction}
                          onJoin={() => joinDiscoveredChannel(channel)}
                        />
                      ))}
                    </div>
                  </div>
                ) : null}
              </>
            )}
          </div>
        </div>
      </WorkspaceShell>

      <ConfirmDialog />
    </div>
  );
}

function ChannelRow({
  channel,
  busyAction,
  onMessage,
  onLeave,
}: {
  channel: BotChannel;
  busyAction: string | null;
  onMessage: () => void;
  onLeave: () => void;
}) {
  const leaving = busyAction === `leave:${channel.target}`;

  return (
    <div className="px-4 py-3 hover:bg-hover/30 transition-colors flex items-start gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap mb-0.5">
          <span className="text-sm font-medium text-primary truncate">{channel.name}</span>
          <ServicePill service={channel.service} connected={channel.connected} />
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted">
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
        disabled={!channel.connected}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={channel.connected ? "Send a message to this channel" : "Service is offline"}
      >
        <Send className="w-3 h-3" /> Message
      </button>
      <button
        type="button"
        onClick={onLeave}
        disabled={leaving}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-rose-500 border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Stop this bot listening in this channel"
      >
        {leaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogOut className="w-3 h-3" />} Leave
      </button>
    </div>
  );
}

function DiscoveredChannelRow({
  channel,
  botName,
  busyAction,
  onJoin,
}: {
  channel: DiscoveredChannel;
  botName: string | undefined;
  busyAction: string | null;
  onJoin: () => void;
}) {
  const joining = busyAction === `join:${channel.target}`;

  return (
    <div className="px-4 py-2.5 flex items-center justify-between gap-3">
      <div className="min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-primary truncate">{channel.title ?? channel.channelId}</span>
          <ServicePill service={channel.service} connected />
        </div>
        <p className="text-xs text-muted truncate">
          <span className="font-mono">{channel.target}</span>
          {channel.invitedBy ? ` · invited by ${channel.invitedBy}` : ""} · seen {formatRelativeTime(channel.discoveredAt)}
        </p>
      </div>
      <button
        type="button"
        onClick={onJoin}
        disabled={!botName || joining}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={botName ? `Have "${botName}" answer here` : "Select a bot first"}
      >
        {joining ? <Loader2 className="w-3 h-3 animate-spin" /> : <LogIn className="w-3 h-3" />} Join
      </button>
    </div>
  );
}

function UserRow({
  user,
  botName,
  connected,
  busyAction,
  onMessage,
  onChangeRole,
  onRemove,
}: {
  user: BotUser;
  /** Bot this row belongs to — captured at click so a sidebar switch mid-flight cannot retarget the action. */
  botName: string;
  connected: boolean;
  busyAction: string | null;
  onMessage: () => void;
  onChangeRole: (botName: string, role: BotUser["role"]) => void;
  onRemove: (botName: string) => void;
}) {
  const busy = busyAction === `user:${user.target}`;

  return (
    <div className="px-4 py-3 hover:bg-hover/30 transition-colors flex items-center gap-3">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-primary truncate font-mono">{user.userId}</span>
          <RolePill role={user.role} />
          <ServicePill service={user.service} connected={connected} />
        </div>
        <p className="text-xs text-muted font-mono mt-0.5 truncate">{user.target}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          const bot = botName;
          onChangeRole(bot, user.role === "admin" ? "user" : "admin");
        }}
        disabled={busy}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={user.role === "admin" ? "Take away command access" : "Let them run slash commands"}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
        {user.role === "admin" ? "Make user" : "Make admin"}
      </button>
      <button
        type="button"
        onClick={onMessage}
        disabled={!connected}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title={connected ? "Send a direct message" : "Service is offline"}
      >
        <Send className="w-3 h-3" /> Message
      </button>
      <button
        type="button"
        onClick={() => {
          const bot = botName;
          onRemove(bot);
        }}
        disabled={busy}
        className="shrink-0 inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-rose-500 border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Remove this person from the bot"
        aria-label={`Remove ${user.target}`}
      >
        <Trash2 className="w-3 h-3" />
      </button>
    </div>
  );
}

/** Adds a person to the selected bot, by the `service:userId` that names them. */
function AddPersonForm({
  services,
  existingTargets,
  busy,
  onAdd,
}: {
  services: string[];
  existingTargets: string[];
  busy: boolean;
  /** Resolves true when the person was saved so the field can clear. */
  onAdd: (target: string, role: BotUser["role"]) => boolean | Promise<boolean>;
}) {
  const [target, setTarget] = useState("");
  const [role, setRole] = useState<BotUser["role"]>("user");

  const trimmed = target.trim();
  const error = !trimmed ? null : !TARGET_PATTERN.test(trimmed) ? "Looks like service:userId" : existingTargets.includes(trimmed) ? "Already listed" : null;

  const submit = () => {
    if (!trimmed || error || busy) return;
    void (async () => {
      const ok = await onAdd(trimmed, role);
      if (ok) setTarget("");
    })();
  };

  return (
    <div className="px-4 py-3 border-b border-primary flex flex-wrap items-center gap-2">
      <label className="flex-1 min-w-[12rem]">
        <input
          type="text"
          value={target}
          onChange={e => setTarget(e.target.value)}
          onKeyDown={e => {
            if (e.key === "Enter") {
              e.preventDefault();
              submit();
            }
          }}
          placeholder={services.length > 0 ? `${services[0]}:U123ABC` : "slack:U123ABC"}
          aria-label="Person to add, as service:userId"
          className={cn(
            "w-full bg-input border rounded-md px-2.5 py-1.5 text-xs text-primary placeholder-muted font-mono focus-accent",
            error ? "border-rose-500/60" : "border-primary",
          )}
          spellCheck={false}
          autoComplete="off"
        />
      </label>
      <select
        value={role}
        onChange={e => setRole(e.target.value as BotUser["role"])}
        aria-label="Role"
        className="bg-input border border-primary rounded-md px-2 py-1.5 text-xs text-primary focus-accent"
      >
        <option value="user">User — may chat</option>
        <option value="admin">Admin — may run commands</option>
      </select>
      <button
        type="button"
        onClick={submit}
        disabled={busy || !trimmed || !!error}
        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-muted hover:text-primary border border-primary rounded-md focus-ring cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : <UserPlus className="w-3 h-3" />} Add
      </button>
      {error ? <span className="w-full text-xs text-rose-500">{error}</span> : null}
    </div>
  );
}
