import { beforeEach, describe, expect, it, mock } from "bun:test";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

/**
 * The Messaging views are thin shells over `useMessagingData`; the hook is
 * replaced with a controllable fake so each view's states can be driven
 * directly (loading, bots failure, empty, populated).
 */

const navigate = mock(async (_to: string) => undefined);
const refresh = mock(() => undefined);
const refreshEmail = mock(() => undefined);
const launchMessagingAgent = mock(async () => undefined);

interface FakeMessagingData {
  isLoading: boolean;
  botsFailed: boolean;
  liveConversations: Array<Record<string, unknown>>;
  channelCards: Array<{ id: string; name: string; kind: "messaging" | "email"; connected: boolean; detail: string; href: string }>;
  [key: string]: unknown;
}

let data: FakeMessagingData;

function baseData(): FakeMessagingData {
  const channelCards = [
    { id: "svc-slack", name: "Slack", kind: "messaging" as const, connected: true, detail: "4,000 char limit · used by bots", href: "/bots" },
    { id: "known-telegram", name: "Telegram", kind: "messaging" as const, connected: false, detail: "Not configured", href: "/configuration" },
  ];
  return {
    navigate,
    refresh,
    refreshEmail,
    launchMessagingAgent,
    isLoading: false,
    botsFailed: false,
    loading: { hardError: undefined },
    bots: { isValidating: false },
    botList: [{ name: "helper", displayName: "Helper" }],
    services: [{ name: "slack" }],
    channelCards,
    connectedCount: channelCards.filter(card => card.connected).length,
    connectedServiceNames: new Set(["slack"]),
    liveConversations: [],
    targetOptions: [],
    canSend: true,
    creatingAgent: false,
    agentTypeOptions: ["messaging", "coding"],
    messagingAgentType: "messaging",
    agentTypesLoaded: true,
    messagingAgents: [],
    providers: [],
    primaryEmailProvider: undefined,
    emailMessages: [],
    emailInbox: { isLoading: false, isValidating: false, data: undefined, error: undefined },
    emailConfiguration: { error: undefined },
    emailProvidersLoading: false,
    emailProvidersFailed: false,
    emailStatValue: "None",
  };
}

void mock.module("../../features/messaging/useMessagingData.ts", () => ({
  useMessagingData: () => data,
  MESSAGING_AGENT_TYPES: ["messaging", "email"],
}));

const { renderLayoutApp, renderLayoutView } = await import("../../test/layout.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { MESSAGING_APP } = await import("./manifest.ts");
const { MESSAGING_VIEWS } = await import("./views.ts");

const view = (id: string) => {
  const found = MESSAGING_VIEWS.find(candidate => candidate.id === id);
  if (!found) throw new Error(`no view ${id}`);
  return found;
};
const messagingOverviewView = view("messaging-overview");
const messagingConversationsView = view("messaging-conversations");
const messagingEmailView = view("messaging-email");
const messagingChannelsView = view("messaging-channels");

function renderMessagingView(target: (typeof MESSAGING_VIEWS)[number]) {
  return renderLayoutView(target);
}

describe("Messaging app views", () => {
  beforeEach(() => {
    data = baseData();
    navigate.mockClear();
    refresh.mockClear();
    refreshEmail.mockClear();
    launchMessagingAgent.mockClear();
  });

  describe("overview", () => {
    it("renders the summary stats once loaded", () => {
      renderMessagingView(messagingOverviewView);
      expect(screen.getByText("Messaging")).toBeInTheDocument();
      expect(screen.getByText("Live threads")).toBeInTheDocument();
      expect(screen.getByText("Email inbox")).toBeInTheDocument();
    });

    it("shows a loading state while bots load", () => {
      data.isLoading = true;
      renderMessagingView(messagingOverviewView);
      expect(screen.getByText("Loading messaging status…")).toBeInTheDocument();
    });

    it("shows an error state when bots fail to load", () => {
      data.botsFailed = true;
      data.loading = { hardError: new Error("bots down") };
      renderMessagingView(messagingOverviewView);
      expect(screen.getByText("Unable to load messaging status")).toBeInTheDocument();
    });

    it("refreshes from the header action", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingOverviewView);
      await user.click(screen.getByRole("button", { name: "Refresh" }));
      expect(refresh).toHaveBeenCalledTimes(1);
    });
  });

  describe("overview actions", () => {
    it("explains why Send a message is disabled", () => {
      data.canSend = false;
      renderMessagingView(messagingOverviewView);
      const send = screen.getByRole("button", { name: "Send a message" });
      expect(send).toBeDisabled();
      expect(send).toHaveAttribute("title", "Connect a chat service in Bots to send messages");
    });

    it("labels the launcher as creating a new agent", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingOverviewView);
      expect(screen.queryByRole("button", { name: /Open Messaging/ })).toBeNull();
      await user.click(screen.getByRole("button", { name: /New messaging agent/ }));
      expect(launchMessagingAgent).toHaveBeenCalledWith(undefined);
    });

    it("sends the user to Bots to connect chat services", async () => {
      const user = userEvent.setup();
      data.services = [];
      data.channelCards = [];
      renderMessagingView(messagingOverviewView);
      expect(screen.getByText(/Connect Slack or Telegram in Bots/)).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Connect in Bots/ }));
      expect(navigate).toHaveBeenCalledWith("/bots");
    });

    it("opens an unconnected chat service card in Bots", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingOverviewView);
      await user.click(screen.getByRole("button", { name: /^Telegram/ }));
      expect(navigate).toHaveBeenCalledWith("/bots");
    });

    it("requires picking a type when no messaging agent type exists", async () => {
      const user = userEvent.setup();
      data.messagingAgentType = null;
      data.agentTypeOptions = ["coding"];
      renderMessagingView(messagingOverviewView);
      expect(screen.queryByRole("button", { name: /New messaging agent/ })).toBeNull();
      expect(screen.getByText(/needs a “messaging” or “email” agent type/)).toBeInTheDocument();
      expect(screen.getByRole("link", { name: /Browse marketplace/ })).toHaveAttribute("href", "/marketplace/agent");
      const launch = screen.getByRole("button", { name: "Launch" });
      expect(launch).toBeDisabled();
      await user.selectOptions(screen.getByLabelText(/Or launch another type/), "coding");
      await user.click(launch);
      expect(launchMessagingAgent).toHaveBeenCalledWith("coding");
    });

    it("deep-links an email row to the message in the Email app", async () => {
      const user = userEvent.setup();
      data.providers = ["work"];
      data.primaryEmailProvider = "work";
      data.emailMessages = [{ id: "m 1", subject: "Hello", from: { name: "Ann", email: "ann@example.com" }, isRead: false, receivedAt: Date.now() }];
      renderMessagingView(messagingEmailView);
      await user.click(screen.getByRole("button", { name: /Hello/ }));
      expect(navigate).toHaveBeenCalledWith("/email/work/inbox/m%201");
    });
  });

  describe("conversations", () => {
    it("shows the empty state and links to bot management", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingConversationsView);
      expect(screen.getByText("No live bot conversations")).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /Manage bots/ }));
      expect(navigate).toHaveBeenCalledWith("/bots");
    });

    it("shows an error state when bots fail to load", () => {
      data.botsFailed = true;
      renderMessagingView(messagingConversationsView);
      expect(screen.getByText("Unable to load conversations")).toBeInTheDocument();
    });
  });

  describe("channels", () => {
    it("lists every channel card with the connected count", () => {
      renderMessagingView(messagingChannelsView);
      expect(screen.getByText("1 connected")).toBeInTheDocument();
      expect(screen.getByText("Slack")).toBeInTheDocument();
      expect(screen.getByText("Telegram")).toBeInTheDocument();
    });

    it("refreshes from the header action", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingChannelsView);
      await user.click(screen.getByRole("button", { name: "Refresh channels" }));
      expect(refresh).toHaveBeenCalledTimes(1);
    });

    it("shows a failed email provider list instead of treating email as absent", async () => {
      const user = userEvent.setup();
      data.emailProvidersFailed = true;
      data.emailConfiguration = { error: new Error("providers down") };
      data.providers = [];
      data.channelCards = [];
      data.connectedCount = 0;
      renderMessagingView(messagingChannelsView);
      expect(screen.getByRole("alert")).toHaveTextContent("Could not load email providers");
      expect(screen.getByRole("alert")).toHaveTextContent("providers down");
      expect(screen.queryByText("Slack")).toBeNull();
      expect(screen.queryByText("Telegram")).toBeNull();
      expect(screen.queryByText("Discord")).toBeNull();
      expect(screen.queryByText("Offline")).toBeNull();
      await user.click(screen.getByRole("button", { name: "Retry" }));
      expect(refreshEmail).toHaveBeenCalledTimes(1);
    });

    it("keeps reported channels when the email provider list fails", () => {
      data.emailProvidersFailed = true;
      data.emailConfiguration = { error: new Error("providers down") };
      data.channelCards = [{ id: "svc-slack", name: "Slack", kind: "messaging", connected: true, detail: "4,000 char limit · used by bots", href: "/bots" }];
      data.connectedCount = 1;
      renderMessagingView(messagingChannelsView);
      expect(screen.getByRole("alert")).toHaveTextContent("Could not load email providers");
      expect(screen.getByText("Slack")).toBeInTheDocument();
      expect(screen.getByText("Connected")).toBeInTheDocument();
      expect(screen.getByText("1 connected")).toBeInTheDocument();
    });
  });

  describe("email", () => {
    it("renders without a provider and refreshes email only", async () => {
      const user = userEvent.setup();
      renderMessagingView(messagingEmailView);
      await user.click(screen.getByRole("button", { name: "Refresh email" }));
      expect(refreshEmail).toHaveBeenCalledTimes(1);
      expect(refresh).not.toHaveBeenCalled();
    });
  });

  describe("app definition", () => {
    it("mounts every messaging view in its default layout and keeps the URL", async () => {
      expect(MESSAGING_APP.path).toBe("/messaging");
      const registry = createLayoutRegistry({ apps: [MESSAGING_APP], views: [...MESSAGING_VIEWS], kinds: CORE_KINDS });
      renderLayoutApp({ registry, url: "/messaging" });
      await waitFor(() => {
        const mounted = [...document.querySelectorAll("[data-panel]")].map(node => node.getAttribute("data-panel"));
        expect(new Set(mounted)).toEqual(new Set(MESSAGING_VIEWS.map(({ id }) => `${id}:_`)));
      });
    });
  });
});
