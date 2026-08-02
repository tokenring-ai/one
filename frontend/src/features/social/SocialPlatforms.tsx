import { Bot, CheckCircle2, ExternalLink, Hash, KeyRound, Loader2, MessagesSquare, Package, Plug, PlugZap, RefreshCw, Settings2, WifiOff } from "lucide-react";
import type { ReactNode } from "react";
import { useMemo } from "react";
import { Link } from "react-router-dom";
import ErrorState from "../../components/ui/ErrorState.tsx";
import { cn } from "../../lib/utils.ts";
import { useBots, useConfigValues, usePlugins } from "../../rpc.ts";
import { BOT_PLUGIN_NAME, deriveAllPlatformStatuses, type PlatformStatus, type PlatformStatusId, statusDetail, statusLabel } from "./platforms.ts";

function StatusBadge({ status }: { status: PlatformStatusId }) {
  const styles: Record<PlatformStatusId, string> = {
    connected: "bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/30",
    configured: "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30",
    needs_config: "bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/30",
    not_installed: "bg-tertiary text-muted border-primary",
  };
  const icons: Record<PlatformStatusId, ReactNode> = {
    connected: <PlugZap className="w-3 h-3" />,
    configured: <CheckCircle2 className="w-3 h-3" />,
    needs_config: <Settings2 className="w-3 h-3" />,
    not_installed: <WifiOff className="w-3 h-3" />,
  };
  return (
    <span className={cn("inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-2xs font-medium border shrink-0", styles[status])}>
      {icons[status]}
      {statusLabel(status)}
    </span>
  );
}

function PlatformCard({ info }: { info: PlatformStatus }) {
  const { platform, status, hasConfig, pluginInstalled } = info;
  const canConfigure = pluginInstalled && hasConfig;
  const configHref = `/configuration/${encodeURIComponent(platform.pluginName)}`;
  const muted = status === "not_installed";

  return (
    <div
      className={cn(
        "flex flex-col gap-3 px-4 py-3 bg-secondary border border-primary rounded-xl transition-colors",
        muted ? "opacity-80" : "hover:border-accent-muted",
      )}
    >
      <div className="flex items-start gap-3">
        <div className={cn("w-8 h-8 rounded-lg bg-linear-to-br shrink-0", platform.color)} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-medium text-primary">{platform.name}</p>
            <StatusBadge status={status} />
          </div>
          <p className="text-2xs text-muted mt-0.5">{platform.description}</p>
          <p className="text-2xs text-secondary mt-1.5 leading-relaxed">{statusDetail(info)}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {canConfigure ? (
          <Link
            to={configHref}
            className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg border border-primary bg-tertiary text-primary hover:bg-hover hover:border-accent-muted transition-colors focus-ring"
          >
            <Settings2 className="w-3 h-3" />
            {status === "needs_config" ? "Configure" : "Edit config"}
          </Link>
        ) : null}
        {status === "not_installed" ? (
          <Link
            to="/plugins"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg border border-primary bg-tertiary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
          >
            <Package className="w-3 h-3" />
            View plugins
          </Link>
        ) : null}
        {status === "connected" || (status === "configured" && platform.kind === "messaging") ? (
          <Link
            to="/bots"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg border border-primary bg-tertiary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
          >
            <Bot className="w-3 h-3" />
            Manage bots
          </Link>
        ) : null}
        {canConfigure ? (
          <Link
            to="/vault"
            className="inline-flex items-center gap-1 px-2.5 py-1 text-2xs font-medium rounded-lg border border-primary bg-tertiary text-muted hover:text-primary hover:bg-hover transition-colors focus-ring"
            title="Store bot tokens and secrets"
          >
            <KeyRound className="w-3 h-3" />
            Vault
          </Link>
        ) : null}
      </div>
    </div>
  );
}

function SummaryStat({ label, value, icon, accentClass }: { label: string; value: string; icon: ReactNode; accentClass: string }) {
  return (
    <div className="bg-secondary border border-primary rounded-xl px-3 py-2.5 shadow-sm">
      <div className="flex items-center gap-1.5 mb-0.5">
        <span className={accentClass}>{icon}</span>
        <span className="text-2xs font-bold text-muted uppercase tracking-widest">{label}</span>
      </div>
      <p className="text-base font-semibold text-primary tabular-nums">{value}</p>
    </div>
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
          <p className="text-2xs font-bold text-muted uppercase tracking-widest">Bots & messaging</p>
          <p className="text-sm text-secondary mt-1 leading-relaxed">
            Channel bots sit on Slack, Telegram, and Discord accounts and answer with agents. Configure accounts above, then define bots under{" "}
            <code className="text-2xs text-primary">bot.bots</code>.
          </p>
        </div>
        <Link
          to="/bots"
          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-2xs font-medium rounded-lg bg-teal-600 hover:bg-teal-500 text-white shrink-0 transition-colors focus-ring shadow-sm"
        >
          Open Bots
          <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {!botPluginInstalled ? (
        <p className="text-2xs text-muted flex items-center gap-1.5">
          <WifiOff className="w-3.5 h-3.5" /> Bot plugin is not installed on this instance.
        </p>
      ) : botsError ? (
        <ErrorState title="Unable to load bots status" error={botsError} onRetry={onRetryBots} variant="inline" />
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <SummaryStat label="Bots" value={String(botCount)} icon={<Bot className="w-3.5 h-3.5" />} accentClass="text-teal-500" />
          <SummaryStat label="Channels" value={String(channelCount)} icon={<Hash className="w-3.5 h-3.5" />} accentClass="text-sky-500" />
          <SummaryStat
            label="Conversations"
            value={String(conversationCount)}
            icon={<MessagesSquare className="w-3.5 h-3.5" />}
            accentClass="text-violet-500"
          />
          <SummaryStat label="Services" value={String(serviceCount)} icon={<Plug className="w-3.5 h-3.5" />} accentClass="text-amber-500" />
        </div>
      )}

      {botPluginInstalled && !botsError && botCount === 0 && serviceCount > 0 ? (
        <div className="flex flex-wrap items-center gap-2 text-2xs">
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
        <p className="text-2xs text-muted">No messaging services connected. Add a Slack, Telegram, or Discord account to go live.</p>
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
  // Soft-fail: bots endpoint may be unavailable; only treat as hard error when we have no data.
  const botsHardError = bots.error && !bots.data ? bots.error : undefined;

  const connectedCount = platformStatuses.filter(p => p.status === "connected").length;
  const needsConfigCount = platformStatuses.filter(p => p.status === "needs_config").length;
  const configuredCount = platformStatuses.filter(p => p.status === "configured").length;

  // Wait for plugins + config, and for bots on first load so messaging status is not
  // briefly shown as offline before listBots returns. Bots errors are non-fatal.
  const isLoading = (plugins.isLoading && !plugins.data) || (config.isLoading && !config.data) || (bots.isLoading && !bots.data && !bots.error);
  const hardError = (plugins.error && !plugins.data) || (config.error && !config.data);

  const refresh = () => {
    void plugins.mutate();
    void config.mutate();
    void bots.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-10" role="status" aria-live="polite">
        <Loader2 className="w-6 h-6 text-muted animate-spin" />
      </div>
    );
  }

  if (hardError) {
    const err = plugins.error ?? config.error;
    return <ErrorState title="Unable to load social status" error={err} onRetry={refresh} variant="inline" className="py-6" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-2 px-1">
        <div>
          <p className="text-2xs font-bold text-muted uppercase tracking-widest">Platforms</p>
          <p className="text-2xs text-muted mt-0.5">{platformsHeadline(connectedCount, needsConfigCount, configuredCount)}</p>
        </div>
        <button
          type="button"
          onClick={refresh}
          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-2xs text-muted hover:text-primary border border-primary rounded-lg transition-colors focus-ring cursor-pointer"
          title="Refresh status"
        >
          <RefreshCw className={cn("w-3.5 h-3.5", (plugins.isValidating || config.isValidating || bots.isValidating) && "animate-spin")} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {platformStatuses.map(info => (
          <PlatformCard key={info.platform.id} info={info} />
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
