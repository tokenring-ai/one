import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const mutate = mock(async () => undefined);

let pluginsData: {
  plugins: Array<{ name: string; displayName: string; version: string; description: string; hasConfig: boolean }>;
} = {
  plugins: [
    {
      name: "@tokenring-ai/slack",
      displayName: "Slack Integration",
      version: "0.2.0",
      description: "Slack transport",
      hasConfig: true,
    },
    {
      name: "@tokenring-ai/telegram",
      displayName: "Telegram Integration",
      version: "0.2.0",
      description: "Telegram transport",
      hasConfig: true,
    },
    {
      name: "@tokenring-ai/bot",
      displayName: "Bots",
      version: "0.2.0",
      description: "Bots",
      hasConfig: true,
    },
  ],
};

let configData: { effective: Record<string, unknown>; overrides: { user: Record<string, unknown>; project: Record<string, unknown> } } = {
  effective: {
    slack: { accounts: { slack: { botToken: { __sensitive: true, isSet: true } } } },
    telegram: { accounts: {} },
  },
  overrides: { user: {}, project: {} },
};

let botsData: {
  status: "success";
  bots: Array<{
    name: string;
    displayName: string;
    agentType: string;
    directMessages: "listed";
    requireMention: boolean;
    users: [];
    channels: Array<{ name: string; target: string; service: string; channelId: string; agentType: string; allowedUsers: string[]; connected: boolean }>;
    conversations: [];
  }>;
  services: Array<{ name: string; maxMessageLength: number }>;
  groups: [];
} = {
  status: "success",
  bots: [
    {
      name: "helper",
      displayName: "Helper",
      agentType: "assistant",
      directMessages: "listed",
      requireMention: true,
      users: [],
      channels: [
        {
          name: "engineering",
          target: "slack:C0123",
          service: "slack",
          channelId: "C0123",
          agentType: "assistant",
          allowedUsers: [],
          connected: true,
        },
      ],
      conversations: [],
    },
  ],
  services: [{ name: "slack", maxMessageLength: 3900 }],
  groups: [],
};

void mock.module("../../rpc.ts", () => ({
  usePlugins: () => ({ data: pluginsData, isLoading: false, error: undefined, isValidating: false, mutate }),
  useConfigValues: () => ({ data: configData, isLoading: false, error: undefined, isValidating: false, mutate }),
  useBots: () => ({ data: botsData, isLoading: false, error: undefined, isValidating: false, mutate }),
  useAgentList: () => ({ data: [], isLoading: false, mutate }),
  agentRPCClient: {
    createAgent: mock(async () => ({ id: "agent-1", displayName: "Social", description: "" })),
  },
}));

const { default: SocialApp } = await import("./SocialApp.tsx");

function renderApp() {
  return render(
    <MemoryRouter initialEntries={["/social"]}>
      <Routes>
        <Route path="/social" element={<SocialApp />} />
        <Route path="/configuration" element={<div>Configuration page</div>} />
        <Route path="/bots" element={<div>Bots page</div>} />
        <Route path="/plugins" element={<div>Plugins page</div>} />
        <Route path="/vault" element={<div>Vault page</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("SocialApp", () => {
  beforeEach(() => {
    mutate.mockClear();
    pluginsData = {
      plugins: [
        {
          name: "@tokenring-ai/slack",
          displayName: "Slack Integration",
          version: "0.2.0",
          description: "Slack transport",
          hasConfig: true,
        },
        {
          name: "@tokenring-ai/telegram",
          displayName: "Telegram Integration",
          version: "0.2.0",
          description: "Telegram transport",
          hasConfig: true,
        },
        {
          name: "@tokenring-ai/bot",
          displayName: "Bots",
          version: "0.2.0",
          description: "Bots",
          hasConfig: true,
        },
      ],
    };
    configData = {
      effective: {
        slack: { accounts: { slack: { botToken: { __sensitive: true, isSet: true } } } },
        telegram: { accounts: {} },
      },
      overrides: { user: {}, project: {} },
    };
    botsData = {
      status: "success",
      bots: [
        {
          name: "helper",
          displayName: "Helper",
          agentType: "assistant",
          directMessages: "listed",
          requireMention: true,
          users: [],
          channels: [
            {
              name: "engineering",
              target: "slack:C0123",
              service: "slack",
              channelId: "C0123",
              agentType: "assistant",
              allowedUsers: [],
              connected: true,
            },
          ],
          conversations: [],
        },
      ],
      services: [{ name: "slack", maxMessageLength: 3900 }],
      groups: [],
    };
  });

  it("shows real connection status for slack and telegram", () => {
    renderApp();

    expect(screen.getByText("Slack")).toBeTruthy();
    expect(screen.getByText("Telegram")).toBeTruthy();
    expect(screen.getByText("Connected")).toBeTruthy();
    expect(screen.getByText("Needs config")).toBeTruthy();
    expect(screen.getByText(/1 account live/)).toBeTruthy();
    expect(screen.getByText(/Add an account in Configuration/)).toBeTruthy();
  });

  it("shows not installed for plugins that are absent", () => {
    renderApp();

    expect(screen.getByText("Discord")).toBeTruthy();
    expect(screen.getByText("Reddit")).toBeTruthy();
    expect(screen.getByText("X / Twitter")).toBeTruthy();
    const notInstalled = screen.getAllByText("Not installed");
    expect(notInstalled.length).toBeGreaterThanOrEqual(3);
  });

  it("links to configuration for installable platforms", () => {
    renderApp();

    const configureLinks = screen.getAllByRole("link", { name: /Configure|Edit config/i });
    expect(configureLinks.length).toBeGreaterThanOrEqual(2);
    const hrefs = configureLinks.map(link => link.getAttribute("href") ?? "");
    expect(hrefs.some(href => href.includes("configuration") && href.includes("slack"))).toBe(true);
    expect(hrefs.some(href => href.includes("configuration") && href.includes("telegram"))).toBe(true);
  });

  it("shows bots summary with live counts", () => {
    renderApp();

    expect(screen.getByText("Bots & messaging")).toBeTruthy();
    expect(screen.getByText("Open Bots")).toBeTruthy();
    // Summary stats: 1 bot, 1 channel, 0 conversations, 1 service
    expect(screen.getByText("Bots", { selector: "span" })).toBeTruthy();
  });

  it("still offers launching a social agent", () => {
    renderApp();
    expect(screen.getByRole("button", { name: /Launch Social Agent/i })).toBeTruthy();
  });

  it("does not hard-code permanent Not configured badges", () => {
    renderApp();
    expect(screen.queryByText("Not configured")).toBeNull();
  });
});
