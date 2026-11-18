/**
 * Platform catalog and status helpers for the Social app.
 *
 * Status is derived only from real data:
 * - installed plugins (`listPlugins`)
 * - effective config accounts (`getConfigValues`)
 * - connected messaging services (`listBots` services)
 */

import { serviceGradient } from "../../lib/serviceGradient.ts";

export type PlatformKind = "messaging" | "social";

export type PlatformStatusId = "connected" | "configured" | "needs_config" | "not_installed";

export interface PlatformDef {
  id: string;
  name: string;
  description: string;
  /** Tailwind gradient for the platform badge */
  color: string;
  /** Plugin package name as returned by listPlugins */
  pluginName: string;
  /** Top-level config slice key (e.g. `slack`, `telegram`) */
  configSlice: string;
  kind: PlatformKind;
}

/**
 * Platforms the Social app surfaces.
 * Slack, Telegram, Discord, X, and Reddit are messaging transports for bots.
 * Gradients come from the shared service brand map.
 */
export const SOCIAL_PLATFORMS: PlatformDef[] = [
  {
    id: "slack",
    name: "Slack",
    description: "Workspaces, channels, and DMs via bot accounts",
    color: serviceGradient("slack"),
    pluginName: "@tokenring-ai/slack",
    configSlice: "slack",
    kind: "messaging",
  },
  {
    id: "telegram",
    name: "Telegram",
    description: "Bot accounts for groups and direct messages",
    color: serviceGradient("telegram"),
    pluginName: "@tokenring-ai/telegram",
    configSlice: "telegram",
    kind: "messaging",
  },
  {
    id: "discord",
    name: "Discord",
    description: "Servers, channels, and DMs via bot accounts",
    color: serviceGradient("discord"),
    pluginName: "@tokenring-ai/discord",
    configSlice: "discord",
    kind: "messaging",
  },
  {
    id: "x",
    name: "X / Twitter",
    description: "Mentions and DMs via X accounts",
    color: serviceGradient("x"),
    pluginName: "@tokenring-ai/x",
    configSlice: "x",
    kind: "messaging",
  },
  {
    id: "reddit",
    name: "Reddit",
    description: "Subreddit comments and private messages via bot accounts",
    color: serviceGradient("reddit"),
    pluginName: "@tokenring-ai/reddit",
    configSlice: "reddit",
    kind: "messaging",
  },
];

export const BOT_PLUGIN_NAME = "@tokenring-ai/bot";

export interface PlatformStatus {
  platform: PlatformDef;
  status: PlatformStatusId;
  /** Named accounts from config (messaging platforms) */
  accountNames: string[];
  /** Accounts also present in bot messaging services (live connection) */
  connectedAccountNames: string[];
  pluginInstalled: boolean;
  hasConfig: boolean;
}

export interface PluginInfo {
  name: string;
  hasConfig: boolean;
}

/** Account keys under `effective[slice].accounts`. */
export function getConfigAccountNames(effective: Record<string, unknown> | undefined, configSlice: string): string[] {
  if (!effective) return [];
  const section = effective[configSlice];
  if (!section || typeof section !== "object" || Array.isArray(section)) return [];
  const accounts = (section as Record<string, unknown>).accounts;
  if (!accounts || typeof accounts !== "object" || Array.isArray(accounts)) return [];
  return Object.keys(accounts as Record<string, unknown>);
}

export function derivePlatformStatus(
  platform: PlatformDef,
  plugins: PluginInfo[] | undefined,
  effective: Record<string, unknown> | undefined,
  connectedServices: ReadonlySet<string>,
): PlatformStatus {
  const plugin = plugins?.find(p => p.name === platform.pluginName);
  const pluginInstalled = plugin !== undefined;
  const hasConfig = plugin?.hasConfig ?? false;
  const accountNames = getConfigAccountNames(effective, platform.configSlice);
  const connectedAccountNames = accountNames.filter(name => connectedServices.has(name));

  let status: PlatformStatusId;
  if (!pluginInstalled) {
    status = "not_installed";
  } else if (accountNames.length === 0) {
    status = "needs_config";
  } else if (platform.kind === "messaging" && connectedAccountNames.length > 0) {
    // Messaging accounts that registered with BotService are live.
    status = "connected";
  } else {
    // Accounts present in config. Messaging offline, or social (no bot service).
    status = "configured";
  }

  return {
    platform,
    status,
    accountNames,
    connectedAccountNames,
    pluginInstalled,
    hasConfig,
  };
}

export function deriveAllPlatformStatuses(
  plugins: PluginInfo[] | undefined,
  effective: Record<string, unknown> | undefined,
  serviceNames: string[] | undefined,
): PlatformStatus[] {
  const connectedServices = new Set(serviceNames ?? []);
  return SOCIAL_PLATFORMS.map(platform => derivePlatformStatus(platform, plugins, effective, connectedServices));
}

export function statusLabel(status: PlatformStatusId): string {
  switch (status) {
    case "connected":
      return "Connected";
    case "configured":
      return "Configured";
    case "needs_config":
      return "Needs config";
    case "not_installed":
      return "Not installed";
  }
}

export function statusDetail(info: PlatformStatus): string {
  const { status, accountNames, connectedAccountNames, platform, hasConfig } = info;
  switch (status) {
    case "connected": {
      const n = connectedAccountNames.length;
      if (n === 1) return `1 account live (${connectedAccountNames[0]})`;
      if (n <= 3) return `${n} accounts live (${connectedAccountNames.join(", ")})`;
      return `${n} accounts live`;
    }
    case "configured": {
      if (platform.kind === "messaging" && accountNames.length > 0) {
        return accountNames.length === 1
          ? `Account "${accountNames[0]}" configured — waiting for connection`
          : `${accountNames.length} accounts configured — offline`;
      }
      if (accountNames.length > 0) {
        return accountNames.length === 1 ? `1 account configured` : `${accountNames.length} accounts configured`;
      }
      return "Ready";
    }
    case "needs_config":
      // hasConfig means the plugin exposes a config schema (settings UI), not that
      // entries already exist. Without a schema there is no Configuration path.
      if (!hasConfig) {
        return "Plugin is installed but has no configuration UI";
      }
      return platform.kind === "messaging" ? "Add an account in Configuration" : "Add credentials in Configuration";
    case "not_installed":
      return "Plugin is not installed on this instance";
  }
}
