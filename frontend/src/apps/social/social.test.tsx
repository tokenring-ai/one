import { beforeEach, describe, expect, it, mock } from "bun:test";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";

const mutate = mock(async () => undefined);

type PluginsData = {
  plugins: Array<{ name: string; displayName: string; version: string; description: string; hasConfig: boolean }>;
};

type ConfigData = { effective: Record<string, unknown>; overrides: { user: Record<string, unknown>; project: Record<string, unknown> } };

type BotsData = {
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
};

let pluginsData: PluginsData = {
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

let configData: ConfigData = {
  effective: {
    slack: { accounts: { slack: { botToken: { __sensitive: true, isSet: true } } } },
    telegram: { accounts: {} },
  },
  overrides: { user: {}, project: {} },
};

let botsData: BotsData | undefined = {
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

let botsError: Error | undefined;

const socialAgent = (id: string, idle: boolean) => ({
  id,
  createdAt: 1,
  agentType: "social",
  displayName: `Social ${id}`,
  description: "",
  idle,
  currentActivity: idle ? "" : "Drafting a post",
});
let agentList: ReturnType<typeof socialAgent>[] = [];
let agentTypesData: Array<{ type: string }> | undefined = [{ type: "social" }];
const deleteAgent = mock(async (_args: { agentId: string; reason: string }) => ({ status: "success" }));

const actualRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...actualRpc,
  usePlugins: () => ({ data: pluginsData, isLoading: false, error: undefined, isValidating: false, mutate }),
  useConfigValues: () => ({ data: configData, isLoading: false, error: undefined, isValidating: false, mutate }),
  useBots: () => ({ data: botsData, isLoading: false, error: botsError, isValidating: false, mutate }),
  useAgentList: () => ({ data: agentList, isLoading: false, mutate }),
  useAgentTypes: () => ({ data: agentTypesData, isLoading: false, mutate }),
  agentRPCClient: {
    createAgent: mock(async () => ({ id: "agent-1", displayName: "Social", description: "" })),
    deleteAgent,
  },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

void mock.module("../../components/chat/ChatPanel.tsx", () => ({
  default: ({ agentId }: { agentId: string }) => <div data-testid={`chat-panel:${agentId}`}>chat</div>,
}));
void mock.module("../../components/ModelSelector.tsx", () => ({ default: () => null }));
void mock.module("../../components/ToolSelector.tsx", () => ({ default: () => null }));

const { renderLayoutApp } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { SOCIAL_APP } = await import("./manifest.ts");
const { SOCIAL_VIEWS } = await import("./views.ts");

const registry = createLayoutRegistry({ apps: [SOCIAL_APP], views: [...SOCIAL_VIEWS, ...CHAT_VIEWS], kinds: CORE_KINDS });

/** Platforms is the second tab beside Compose: bring it forward. The sessions widget is mounted; scope queries to one of them. */
function renderApp() {
  const app = renderLayoutApp({ registry, url: "/social" });
  fireEvent.click(screen.getByRole("tab", { name: "Platforms" }));
  return Object.assign(app, { app });
}
function renderSessions() {
  const app = renderLayoutApp({ registry, url: "/social" });
  const node = document.querySelector<HTMLElement>('[data-panel="social-sessions:_"]');
  if (!node) throw new Error("sessions panel not mounted");
  return { app, sessions: within(node) };
}

describe("Social views", () => {
  beforeEach(() => {
    mutate.mockClear();
    botsError = undefined;
    agentList = [];
    agentTypesData = [{ type: "social" }];
    deleteAgent.mockClear();
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
    // Discord description must not claim the plugin is unbundled — it ships with One.
    expect(screen.queryByText(/plugin not bundled/i)).toBeNull();
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

  it("shows soft error when bots fail without fabricating zero counts", () => {
    botsData = undefined;
    botsError = new Error("bot service unavailable");
    renderApp();

    expect(screen.getByText("Unable to load bots status")).toBeTruthy();
    expect(screen.getByText("bot service unavailable")).toBeTruthy();
    expect(screen.queryByText("No messaging services connected")).toBeNull();
  });

  it("reports offline configured platforms in the platforms headline", () => {
    // Only Slack installed + configured, no live service — avoids a competing "ready to configure" headline.
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
          name: "@tokenring-ai/bot",
          displayName: "Bots",
          version: "0.2.0",
          description: "Bots",
          hasConfig: true,
        },
      ],
    };
    botsData = { status: "success", bots: [], services: [], groups: [] };
    configData = {
      effective: {
        slack: { accounts: { workspace: { botToken: { __sensitive: true, isSet: true } } } },
      },
      overrides: { user: {}, project: {} },
    };
    renderApp();

    expect(screen.getByText("Configured")).toBeTruthy();
    expect(screen.getByText(/1 configured \(offline\)/)).toBeTruthy();
  });

  it("still offers launching a social agent", () => {
    const { sessions } = renderSessions();
    const launch = sessions.getByRole("button", { name: "Launch Social agent" });
    // The accessible name is the visible text, not a separate aria-label.
    expect(launch.textContent).toBe("Launch Social agent");
    expect(launch).not.toBeDisabled();
  });

  it("disables launching and explains when no social agent type is configured", () => {
    agentTypesData = [{ type: "coding" }];
    const { sessions } = renderSessions();
    expect(sessions.getByRole("button", { name: "Launch Social agent" })).toBeDisabled();
    expect(sessions.getByText(/needs a “social” agent type/)).toBeInTheDocument();
    expect(sessions.getByRole("link", { name: /New agent/ })).toHaveAttribute("href", "/agents/new");
    expect(sessions.getByRole("link", { name: /Browse marketplace/ })).toHaveAttribute("href", "/marketplace/agent");
  });

  it("stops a running session only after confirmation", async () => {
    const user = userEvent.setup();
    agentList = [socialAgent("idle", true)];
    renderSessions();
    await user.click(screen.getByRole("button", { name: "Stop Social idle" }));
    await user.click(await screen.findByRole("button", { name: "Cancel" }));
    expect(deleteAgent).not.toHaveBeenCalled();
    await user.click(screen.getByRole("button", { name: "Stop Social idle" }));
    await user.click(await screen.findByRole("button", { name: "Stop" }));
    await waitFor(() => expect(deleteAgent).toHaveBeenCalledWith(expect.objectContaining({ agentId: "idle" })));
  });

  it("replaces the platform grid with one banner when no platform plugin is installed", () => {
    pluginsData = { plugins: [] };
    botsData = { status: "success", bots: [], services: [], groups: [] };
    renderApp();
    expect(screen.getByText("No social or messaging plugins installed")).toBeInTheDocument();
    expect(screen.queryByText("Not installed")).toBeNull();
    expect(screen.getByRole("link", { name: /Browse plugins/ })).toHaveAttribute("href", "/plugins");
  });

  it("does not hard-code permanent Not configured badges", () => {
    renderApp();
    expect(screen.queryByText("Not configured")).toBeNull();
  });
  it("shows a busy spinner only for working social agents", () => {
    agentList = [socialAgent("busy", false), socialAgent("idle", true)];
    renderSessions();
    const busy = screen.getByRole("button", { name: "Open Social busy, working" });
    const idle = screen.getByRole("button", { name: "Open Social idle, idle" });
    expect(busy.querySelector(".animate-spin")).not.toBeNull();
    expect(idle.querySelector(".animate-spin")).toBeNull();
    expect(idle.textContent).toContain("Idle");
  });

  it("opens social chats in this app at /social/agent/<id>", async () => {
    const user = userEvent.setup();
    agentList = [socialAgent("idle", true)];
    const { app } = renderSessions();
    await user.click(screen.getByRole("button", { name: "Open Social idle, idle" }));
    expect(app.location().pathname).toBe("/social/agent/idle");
    expect(screen.getByTestId("chat-panel:idle")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Launch Social agent" }));
    await waitFor(() => expect(app.location().pathname).toBe("/social/agent/agent-1"));
  });
});
