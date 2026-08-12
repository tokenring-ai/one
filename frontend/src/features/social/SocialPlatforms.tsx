import { Bot, CheckCircle2, ExternalLink, Hash, KeyRound, Loader2, MessagesSquare, Package, Plug, PlugZap, RefreshCw, Settings2, WifiOff } from "lucide-react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ui/ErrorState.tsx";
import PlatformCard, { type ActionLink } from "../../components/ui/PlatformCard.tsx";
import StatusBadge, { type StatusBadgeDefinition } from "../../components/ui/StatusBadge.tsx";
import SummaryStat from "../../components/ui/SummaryStat.tsx";
import { useMultiSourceLoading } from "../../hooks/useMultiSourceLoading.ts";
import { getServiceBrand } from "../../lib/serviceGradient.ts";
import { cn } from "../../lib/utils.ts";
import { useBots, useConfigValues, usePlugins } from "../../rpc.ts";
import { BOT_PLUGIN_NAME, deriveAllPlatformStatuses, type PlatformStatus, type PlatformStatusId, statusDetail, statusLabel } from "./platforms.ts";

const PLATFORM_STATUS_BADGES: Record<PlatformStatusId, StatusBadgeDefinition> = {
  connected: {
    label: statusLabel("connected"),
    icon: <PlugZap className="w-3 h-3" />,
    colorClass: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
  },
  configured: {
    label: statusLabel("configured"),
    icon: <CheckCircle2 className="w-3 h-3" />,
    colorClass: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
  },
  needs_config: {
    label: statusLabel("needs_config"),
    icon: <Settings2 className="w-3 h-3" />,
    colorClass: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
  },
  not_installed: {
    label: statusLabel("not_installed"),
    icon: <WifiOff className="w-3 h-3" />,
    colorClass: "bg-tertiary text-muted border-primary",
  },
};

function platformActions(info: PlatformStatus): ActionLink[] {
  const { platform, status, hasConfig, pluginInstalled } = info;
  // hasConfig = plugin exposes a config schema (settings UI), not "has entries".
  const canConfigure = pluginInstalled && hasConfig;
  const configHref = `/configuration/${encodeURIComponent(platform.pluginName)}`;
  // Installed plugins without a config schema still need a path when status says needs_config.
  const showPluginsLink = status === "not_installed" || (status === "needs_config" && !canConfigure);

  const actions: ActionLink[] = [];
  if (canConfigure) {
    actions.push({
      label: status === "needs_config" ? "Configure" : "Edit config",
      icon: <Settings2 className="w-3 h-3" />,
      href: configHref,
      primary: true,
    });
  }
  if (showPluginsLink) {
    actions.push({
      label: "View plugins",
      icon: <Package className="w-3 h-3" />,
      href: "/plugins",
    });
  }
  if (status === "connected" || (status === "configured" && platform.kind === "messaging")) {
    actions.push({
      label: "Manage bots",
      icon: <Bot className="w-3 h-3" />,
      href: "/bots",
    });
  }
  if (canConfigure) {
    actions.push({
      label: "Vault",
      icon: <KeyRound className="w-3 h-3" />,
      href: "/vault",
      title: "Store bot tokens and secrets",
    });
  }
  return actions;
}

function SocialPlatformCard({ info }: { info: PlatformStatus }) {
  const { platform, status } = info;
  const brand = getServiceBrand(platform.id);
  const Icon = brand.icon;

  return (
    <PlatformCard
      name={platform.name}
      description={platform.description}
      detail={statusDetail(info)}
      gradient={platform.color}
      icon={<Icon />}
      statusBadge={<StatusBadge status={status} statuses={PLATFORM_STATUS_BADGES} />}
      actions={platformActions(info)}
      muted={status === "not_installed"}
    />
  );
}

function BotsSummary({
  botCount,
  channelCount,
  conversationCount,
  serviceCount,
  botPluginInstalled,
  botsError,
  onRetryBots,
}: {
  botCount: number;
  channelCount: number;
  conversationCount: number;
  serviceCount: number;
  botPluginInstalled: boolean;
  botsError: unknown;
  onRetryBots: () => void;
}) {
  return (
    <div className="bg-secondary border border-primary rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Bots & messaging</p>
          <p className="text-sm text-secondary mt-1 leading-relaxed">
            Channel bots sit on Slack, Telegram, and Discord accounts and answer with agents. Configure accounts above, then define bots under{" "}
            <code className="text-xs text-primary">bot.bots</code>.
          </p>
        </div>
        <Link
          to="/bots"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white shrink-0 transition-colors focus-ring shadow-sm"
        >
          Open Bots
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {!botPluginInstalled ? (
        <p className="text-xs text-muted flex items-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" /> Bot plugin is not installed on this instance.
        </p>
      ) : botsError ? (
        <ErrorState title="Unable to load bots status" error={botsError} onRetry={onRetryBots} variant="inline" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryStat label="Bots" value={String(botCount)} icon={<Bot className="w-3.5 h-3.5" />} accentClass="text-teal-500" size="sm" />
          <SummaryStat label="Channels" value={String(channelCount)} icon={<Hash className="w-3.5 h-3.5" />} accentClass="text-sky-500" size="sm" />
          <SummaryStat
            label="Conversations"
            value={String(conversationCount)}
            icon={<MessagesSquare className="w-3.5 h-3.5" />}
            accentClass="text-violet-500"
            size="sm"
          />
          <SummaryStat label="Services" value={String(serviceCount)} icon={<Plug className="w-3.5 h-3.5" />} accentClass="text-amber-500" size="sm" />
        </div>
      )}

      {botPluginInstalled && !botsError && botCount === 0 && serviceCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-muted">Messaging services are live, but no bots are defined yet.</span>
          <Link
            to={`/configuration/${encodeURIComponent(BOT_PLUGIN_NAME)}`}
            className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400 hover:underline focus-ring rounded"
          >
            <Settings2 className="w-3 h-3" /> Configure bots
          </Link>
        </div>
      ) : null}

      {botPluginInstalled && !botsError && serviceCount === 0 ? (
        <p className="text-xs text-muted">No messaging services connected. Add a Slack, Telegram, or Discord account to go live.</p>
      ) : null}
    </div>
  );
}

function platformsHeadline(connectedCount: number, needsConfigCount: number, configuredCount: number): string {
  if (connectedCount > 0) {
    return connectedCount === 1 ? "1 connected" : `${connectedCount} connected`;
  }
  if (needsConfigCount > 0) {
    return needsConfigCount === 1 ? "1 ready to configure" : `${needsConfigCount} ready to configure`;
  }
  if (configuredCount > 0) {
    return configuredCount === 1 ? "1 configured (offline)" : `${configuredCount} configured (offline)`;
  }
  return "Connect messaging and social plugins";
}

/**
 * Live platform connection status, bot summary, and links into Configuration / Bots / Vault.
 * Intended as chrome above the Social agent launcher.
 */
export default function SocialPlatforms() {
  const plugins = usePlugins();
  const config = useConfigValues();
  const bots = useBots();

  // Wait for plugins + config, and for bots on first load so messaging status is not
  // briefly shown as offline before listBots returns. Bots errors are non-fatal.
  const loading = useMultiSourceLoading([
    { source: plugins, label: "plugins" },
    { source: config, label: "config" },
    { source: bots, label: "bots", isFatal: false },
  ]);

  const platformStatuses = useMemo(
    () =>
      deriveAllPlatformStatuses(
        plugins.data?.plugins,
        config.data?.effective as Record<string, unknown> | undefined,
        bots.data?.services.map(s => s.name),
      ),
    [plugins.data, config.data, bots.data],
  );

  const botPluginInstalled = plugins.data?.plugins.some(p => p.name === BOT_PLUGIN_NAME) ?? false;
  const botList = bots.data?.bots ?? [];
  const channelCount = botList.reduce((n, bot) => n + bot.channels.length, 0);
  const conversationCount = botList.reduce((n, bot) => n + bot.conversations.length, 0);
  const serviceCount = bots.data?.services.length ?? 0;
  const botsHardError = loading.getSourceHardError("bots");

  const connectedCount = platformStatuses.filter(p => p.status === "connected").length;
  const needsConfigCount = platformStatuses.filter(p => p.status === "needs_config").length;
  const configuredCount = platformStatuses.filter(p => p.status === "configured").length;

  if (loading.isLoading) {
    return (
      <div className="flex justify-center py-10" role="status" aria-live="polite">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  if (loading.hasHardError) {
    return <ErrorState title="Unable to load social status" error={loading.hardError} onRetry={loading.refresh} variant="inline" className="py-6" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <p className="text-xs font-bold text-muted uppercase tracking-widest">Platforms</p>
          <p className="text-xs text-muted mt-0.5">{platformsHeadline(connectedCount, needsConfigCount, configuredCount)}</p>
        </div>
        <button
          type="button"
          onClick={loading.refresh}
          disabled={loading.isRefreshing}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Refresh status"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", loading.isRefreshing && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {platformStatuses.map(info => (
          <SocialPlatformCard key={info.platform.id} info={info} />
        ))}
      </div>

      <BotsSummary
        botCount={botList.length}
        channelCount={channelCount}
        conversationCount={conversationCount}
        serviceCount={serviceCount}
        botPluginInstalled={botPluginInstalled}
        botsError={botsHardError}
        onRetryBots={() => void bots.mutate()}
      />
    </div>
  );
}
