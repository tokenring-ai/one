import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter, Route, Routes } from "react-router-dom";

type BotFixture = {
  name: string;
  displayName: string;
  agentType: string;
  directMessages: "listed" | "anyone" | "none";
  requireMention: boolean;
  users: { target: string; service: string; userId: string; role: "admin" | "user" }[];
  channels: {
    name: string;
    target: string;
    service: string;
    channelId: string;
    agentType: string;
    allowedUsers: string[];
    connected: boolean;
  }[];
  conversations: {
    key: string;
    service: string;
    conversationId: string;
    agentId: string;
    agentType: string;
    channelName?: string;
    startedAt: number;
    lastActivityAt: number;
    busy: boolean;
  }[];
};

const helper: BotFixture = {
  name: "helper",
  displayName: "Helper",
  agentType: "assistant",
  directMessages: "listed",
  requireMention: true,
  users: [{ target: "slack:U-admin", service: "slack", userId: "U-admin", role: "admin" }],
  channels: [{ name: "engineering", target: "slack:C-eng", service: "slack", channelId: "C-eng", agentType: "assistant", allowedUsers: [], connected: true }],
  conversations: [],
};

let botsData: {
  bots: BotFixture[];
  services: { name: string; maxMessageLength: number }[];
  groups: { name: string; members: string[] }[];
  discoveredChannels: { target: string; service: string; channelId: string; title?: string; discoveredAt: number; invitedBy?: string }[];
};

type Json = Record<string, unknown>;
type Status = { status: string; issues?: { path: (string | number)[]; message: string }[] };

const mutateBots = mock(async () => undefined);
const createBot = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const deleteBot = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const setUserRole = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const removeUser = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const joinChannel = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const leaveChannel = mock(async (_input: Json): Promise<Status> => ({ status: "success" }));
const getConfigValues = mock(
  async (_input: Json): Promise<{ effective: Json; overrides: Record<string, Json> }> => ({
    effective: {},
    overrides: { global: {}, workspace: {} },
  }),
);
const applyConfig = mock(async (_input: { scope: string; overrides: Json }) => ({ ok: true as const }));

const toastError = mock();
const toastWarning = mock();

void mock.module("../../rpc.ts", () => ({
  useBots: () => ({ data: botsData, isLoading: false, isValidating: false, error: undefined, mutate: mutateBots }),
  useConfigSchema: () => ({
    data: {
      plugins: [
        { pluginName: "@tokenring-ai/slack", slices: { slack: {} } },
        { pluginName: "@tokenring-ai/telegram", slices: { telegram: {} } },
      ],
    },
    isLoading: false,
  }),
  useAgentTypes: () => ({ data: [{ type: "assistant", displayName: "Assistant", description: "", enabledTools: [] }], isLoading: false }),
  botRPCClient: { createBot, deleteBot, setUserRole, removeUser, joinChannel, leaveChannel, sendMessage: mock(), resetConversation: mock() },
  configRPCClient: { getConfigValues, applyConfig },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: toastError, warning: toastWarning },
}));

const { default: BotsDashboard } = await import("./BotsDashboard.tsx");

function renderDashboard(initialPath = "/bots") {
  return render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="/bots/:botId?" element={<BotsDashboard />} />
        <Route path="/configuration/:plugin?" element={<div>Configuration</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("BotsDashboard", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    botsData = { bots: [helper], services: [{ name: "slack", maxMessageLength: 3900 }], groups: [], discoveredChannels: [] };
  });

  describe("creating a bot", () => {
    it("creates one from the form, seeding its first admin", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /new bot/i }));
      await user.type(screen.getByPlaceholderText("helper"), "triage");
      await user.type(screen.getByPlaceholderText("slack:U123ABC"), "slack:U-me");
      await user.click(screen.getByRole("button", { name: /create bot/i }));

      await waitFor(() => expect(createBot).toHaveBeenCalledTimes(1));
      expect(createBot.mock.calls[0]![0]).toMatchObject({
        name: "triage",
        agentType: "assistant",
        users: { "slack:U-me": "admin" },
      });
    });

    it("refuses a name that is already taken, without calling the server", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /new bot/i }));
      await user.type(screen.getByPlaceholderText("helper"), "helper");

      expect(await screen.findByText("A bot with this name already exists")).toBeTruthy();
      expect(screen.getByRole("button", { name: /create bot/i })).toBeDisabled();
      expect(createBot).not.toHaveBeenCalled();
    });

    it("leaves out an optional field rather than sending it empty", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /new bot/i }));
      await user.type(screen.getByPlaceholderText("helper"), "triage");
      await user.click(screen.getByRole("button", { name: /create bot/i }));

      await waitFor(() => expect(createBot).toHaveBeenCalledTimes(1));
      const input = createBot.mock.calls[0]![0] as Record<string, unknown>;
      expect(input).not.toHaveProperty("displayName");
      expect(input).not.toHaveProperty("joinMessage");
      expect(input).not.toHaveProperty("users");
    });
  });

  describe("connecting a messaging service", () => {
    it("writes the token into the chosen configuration layer", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /connect service/i }));
      await user.click(screen.getByRole("button", { name: "Telegram" }));
      await user.type(screen.getByPlaceholderText("123456789:AAE…"), "123:secret");
      await user.click(screen.getByRole("button", { name: /connect telegram/i }));

      await waitFor(() => expect(applyConfig).toHaveBeenCalledTimes(1));
      expect(applyConfig.mock.calls[0]![0]).toEqual({
        scope: "global",
        overrides: { telegram: { accounts: { telegram: { botToken: "123:secret" } } } },
      });
    });

    it("keeps the other accounts and plugins already in the layer", async () => {
      getConfigValues.mockResolvedValueOnce({
        effective: {},
        overrides: {
          global: { telegram: { accounts: { other: { botToken: "keep-me" } } }, filesystem: { root: "/tmp" } },
          workspace: {},
        },
      } as never);

      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /connect service/i }));
      await user.click(screen.getByRole("button", { name: "Telegram" }));
      await user.type(screen.getByPlaceholderText("123456789:AAE…"), "123:secret");
      await user.click(screen.getByRole("button", { name: /connect telegram/i }));

      await waitFor(() => expect(applyConfig).toHaveBeenCalledTimes(1));
      expect(applyConfig.mock.calls[0]![0]).toEqual({
        scope: "global",
        overrides: {
          filesystem: { root: "/tmp" },
          telegram: { accounts: { other: { botToken: "keep-me" }, telegram: { botToken: "123:secret" } } },
        },
      });
    });

    it("does not write a blank optional credential", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /connect service/i }));
      await user.click(screen.getByRole("button", { name: "Slack" }));
      await user.type(screen.getByPlaceholderText("xoxb-…"), "xoxb-1");
      await user.type(screen.getByLabelText(/signing secret/i), "shh");
      // Whitespace is not a credential — writing it would turn Socket Mode on
      // with a token Slack will reject.
      await user.type(screen.getByPlaceholderText("xapp-…"), "   ");
      await user.click(screen.getByRole("button", { name: /connect slack/i }));

      await waitFor(() => expect(applyConfig).toHaveBeenCalledTimes(1));
      expect(applyConfig.mock.calls[0]![0].overrides).toEqual({ slack: { accounts: { slack: { botToken: "xoxb-1", signingSecret: "shh" } } } });
    });
  });

  describe("people", () => {
    it("adds someone to the selected bot", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /^People/ }));
      await user.type(screen.getByLabelText(/person to add/i), "slack:U-new");
      await user.click(screen.getByRole("button", { name: /^add$/i }));

      await waitFor(() => expect(setUserRole).toHaveBeenCalledTimes(1));
      expect(setUserRole.mock.calls[0]![0]).toEqual({ bot: "helper", target: "slack:U-new", role: "user" });
    });

    it("promotes and removes an existing person", async () => {
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /^People/ }));
      const row = screen.getByText("slack:U-admin").closest("div.px-4")!;

      await user.click(within(row as HTMLElement).getByRole("button", { name: /make user/i }));
      await waitFor(() => expect(setUserRole).toHaveBeenCalledTimes(1));
      expect(setUserRole.mock.calls[0]![0]).toEqual({ bot: "helper", target: "slack:U-admin", role: "user" });
    });

    it("says where to look when a lower configuration layer still lists them", async () => {
      removeUser.mockResolvedValueOnce({ status: "definedElsewhere" } as never);
      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /^People/ }));
      await user.click(screen.getByRole("button", { name: "Remove slack:U-admin" }));

      await waitFor(() => expect(toastWarning).toHaveBeenCalledTimes(1));
      expect(toastWarning.mock.calls[0]![0]).toContain("configuration file below");
    });
  });

  describe("getting started", () => {
    it("walks through connect, create, invite when there is nothing yet", async () => {
      botsData = { bots: [], services: [], groups: [], discoveredChannels: [] };
      renderDashboard();

      expect(screen.getByText("No bots yet")).toBeTruthy();
      expect(screen.getByText("Connect a messaging service")).toBeTruthy();
      expect(screen.getByText("Create a bot")).toBeTruthy();
      expect(screen.getByText("Invite it to a channel, then join it here")).toBeTruthy();
    });

    it("ticks off the first step once a service is connected", async () => {
      botsData = { bots: [], services: [{ name: "slack", maxMessageLength: 3900 }], groups: [], discoveredChannels: [] };
      renderDashboard();

      const step = screen.getByText("Connect a messaging service");
      expect(step.className).toContain("line-through");
    });
  });

  describe("sending a message", () => {
    it("prefills a conversation target that is not already in the picker", async () => {
      botsData = {
        bots: [
          {
            ...helper,
            conversations: [
              {
                key: "slack:D-stranger",
                service: "slack",
                conversationId: "D-stranger",
                agentId: "agent-1",
                agentType: "assistant",
                startedAt: Date.now() - 60_000,
                lastActivityAt: Date.now() - 10_000,
                busy: false,
              },
            ],
          },
        ],
        services: [{ name: "slack", maxMessageLength: 3900 }],
        groups: [],
        discoveredChannels: [],
      };

      const user = userEvent.setup();
      renderDashboard();

      // Conversation row action — not the header "Send message" control.
      await user.click(screen.getByRole("button", { name: /^message$/i }));

      expect(screen.getByRole("heading", { name: /send a message/i })).toBeTruthy();
      // Unlisted DM keys are free-text targets, not swapped for the first picker option.
      expect(screen.getByDisplayValue("slack:D-stranger")).toBeTruthy();
    });
  });

  describe("joining a discovered channel", () => {
    it("sends the discovered title so the channel is named sensibly", async () => {
      botsData = {
        bots: [helper],
        services: [{ name: "slack", maxMessageLength: 3900 }],
        groups: [],
        discoveredChannels: [
          {
            target: "slack:C-new",
            service: "slack",
            channelId: "C-new",
            title: "product-design",
            discoveredAt: Date.now() - 5_000,
          },
        ],
      };

      const user = userEvent.setup();
      renderDashboard();

      await user.click(screen.getByRole("button", { name: /^join$/i }));

      await waitFor(() => expect(joinChannel).toHaveBeenCalledTimes(1));
      expect(joinChannel.mock.calls[0]![0]).toEqual({
        bot: "helper",
        target: "slack:C-new",
        name: "product-design",
      });
    });
  });
});
