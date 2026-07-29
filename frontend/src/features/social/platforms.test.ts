import { describe, expect, it } from "bun:test";
import {
  BOT_PLUGIN_NAME,
  deriveAllPlatformStatuses,
  derivePlatformStatus,
  getConfigAccountNames,
  SOCIAL_PLATFORMS,
  statusDetail,
  statusLabel,
} from "./platforms.ts";

const slack = SOCIAL_PLATFORMS.find(p => p.id === "slack")!;
const telegram = SOCIAL_PLATFORMS.find(p => p.id === "telegram")!;
const discord = SOCIAL_PLATFORMS.find(p => p.id === "discord")!;
const reddit = SOCIAL_PLATFORMS.find(p => p.id === "reddit")!;

const installedPlugins = [
  { name: "@tokenring-ai/slack", hasConfig: true },
  { name: "@tokenring-ai/telegram", hasConfig: true },
  { name: BOT_PLUGIN_NAME, hasConfig: true },
];

describe("getConfigAccountNames", () => {
  it("returns account keys from effective config", () => {
    expect(
      getConfigAccountNames(
        {
          slack: { accounts: { slack: { botToken: { __sensitive: true, isSet: true } } } },
        },
        "slack",
      ),
    ).toEqual(["slack"]);
  });

  it("returns empty for missing or empty accounts", () => {
    expect(getConfigAccountNames(undefined, "slack")).toEqual([]);
    expect(getConfigAccountNames({}, "slack")).toEqual([]);
    expect(getConfigAccountNames({ slack: { accounts: {} } }, "slack")).toEqual([]);
    expect(getConfigAccountNames({ slack: "nope" }, "slack")).toEqual([]);
  });
});

describe("derivePlatformStatus", () => {
  it("marks missing plugins as not_installed", () => {
    const status = derivePlatformStatus(discord, installedPlugins, {}, new Set());
    expect(status.status).toBe("not_installed");
    expect(status.pluginInstalled).toBe(false);
    expect(statusLabel(status.status)).toBe("Not installed");
  });

  it("marks installed messaging plugins without accounts as needs_config", () => {
    const status = derivePlatformStatus(slack, installedPlugins, { slack: { accounts: {} } }, new Set());
    expect(status.status).toBe("needs_config");
    expect(status.hasConfig).toBe(true);
  });

  it("marks messaging accounts without live services as configured", () => {
    const status = derivePlatformStatus(slack, installedPlugins, { slack: { accounts: { workspace: {} } } }, new Set());
    expect(status.status).toBe("configured");
    expect(status.accountNames).toEqual(["workspace"]);
    expect(status.connectedAccountNames).toEqual([]);
  });

  it("marks messaging accounts present in bot services as connected", () => {
    const status = derivePlatformStatus(telegram, installedPlugins, { telegram: { accounts: { telegram: {}, ops: {} } } }, new Set(["telegram", "ops"]));
    expect(status.status).toBe("connected");
    expect(status.connectedAccountNames).toEqual(["telegram", "ops"]);
    expect(statusDetail(status)).toContain("2 accounts live");
  });

  it("treats social platforms with accounts as configured when installed", () => {
    const status = derivePlatformStatus(reddit, [{ name: "@tokenring-ai/reddit", hasConfig: true }], { reddit: { accounts: { main: {} } } }, new Set());
    expect(status.status).toBe("configured");
    expect(status.pluginInstalled).toBe(true);
  });
});

describe("deriveAllPlatformStatuses", () => {
  it("derives a status for every catalog platform", () => {
    const all = deriveAllPlatformStatuses(
      installedPlugins,
      {
        slack: { accounts: { slack: {} } },
        telegram: { accounts: {} },
      },
      ["slack"],
    );
    expect(all).toHaveLength(SOCIAL_PLATFORMS.length);
    expect(all.find(p => p.platform.id === "slack")?.status).toBe("connected");
    expect(all.find(p => p.platform.id === "telegram")?.status).toBe("needs_config");
    expect(all.find(p => p.platform.id === "discord")?.status).toBe("not_installed");
  });
});
