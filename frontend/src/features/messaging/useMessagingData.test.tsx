import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, renderHook } from "@testing-library/react";
import type React from "react";
import { MemoryRouter } from "react-router-dom";

/** Launching from Messaging must never silently start an unrelated (coding) agent. */

let agentTypes: Array<{ type: string }> = [];
let emailProviders: { providers: string[] } | undefined = { providers: [] };
let emailError: Error | undefined;
const createAgent = mock(async (_args: { agentType: string }) => ({ id: "new-agent" }));
const toastError = mock();
const swr = (data: unknown) => ({ data, error: undefined, isLoading: false, isValidating: false, mutate: async () => data });

interface BotsPayload {
  bots: Array<{
    name: string;
    displayName: string;
    channels: Array<{ name: string; target: string; service: string; connected: boolean }>;
    users: Array<{ target: string; service: string; role: string }>;
    conversations: Array<{ key: string; service: string; channelName?: string; lastActivityAt: number }>;
  }>;
  services: Array<{ name: string; maxMessageLength: number }>;
  groups: Array<{ name: string; members: string[] }>;
}

const emptyBots = (): BotsPayload => ({ bots: [], services: [], groups: [] });
let botsPayload: BotsPayload = emptyBots();

void mock.module("../../rpc.ts", () => ({
  useBots: () => swr(botsPayload),
  useEmailConfiguration: () => ({ data: emailProviders, error: emailError, isLoading: false, isValidating: false, mutate: async () => emailProviders }),
  useEmailMessages: () => swr(undefined),
  useAgentList: () => swr([]),
  useAgentTypes: () => swr(agentTypes),
  agentRPCClient: { createAgent },
}));

void mock.module("../../components/ui/toast.tsx", () => ({
  toastManager: { success: mock(), error: toastError, warning: mock(), info: mock() },
}));

const { useMessagingData } = await import("./useMessagingData.ts");

const wrapper = ({ children }: { children: React.ReactNode }) => <MemoryRouter>{children}</MemoryRouter>;

describe("useMessagingData launching", () => {
  beforeEach(() => {
    createAgent.mockClear();
    toastError.mockClear();
    agentTypes = [];
    botsPayload = emptyBots();
    emailProviders = { providers: [] };
    emailError = undefined;
  });

  it("launches the messaging type when it is configured", async () => {
    agentTypes = [{ type: "coding" }, { type: "messaging" }];
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    expect(result.current.messagingAgentType).toBe("messaging");
    await act(() => result.current.launchMessagingAgent());
    expect(createAgent).toHaveBeenCalledWith({ agentType: "messaging" });
  });

  it("does not fall back to another type when no messaging type exists", async () => {
    agentTypes = [{ type: "coding" }];
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    expect(result.current.messagingAgentType).toBeNull();
    expect(result.current.agentTypeOptions).toEqual(["coding"]);
    await act(() => result.current.launchMessagingAgent());
    expect(createAgent).not.toHaveBeenCalled();
    expect(toastError).toHaveBeenCalled();
    // An explicit pick is honoured.
    await act(() => result.current.launchMessagingAgent("coding"));
    expect(createAgent).toHaveBeenCalledWith({ agentType: "coding" });
  });

  it("does not count Slack, Telegram, or Discord as offline when the bot stream never listed them", () => {
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    expect(result.current.channelCards).toEqual([]);
    expect(result.current.connectedCount).toBe(0);
  });

  it("shows a connected service the stream reported even when no bot references it", () => {
    botsPayload = { bots: [], services: [{ name: "slack", maxMessageLength: 4000 }], groups: [] };
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    expect(result.current.channelCards).toEqual([
      expect.objectContaining({ id: "svc-slack", name: "Slack", kind: "messaging", connected: true, href: "/bots" }),
    ]);
    expect(result.current.connectedCount).toBe(1);
  });

  it("marks a service offline only when a bot still references it, and points that card at Bots", () => {
    botsPayload = {
      bots: [
        {
          name: "helper",
          displayName: "Helper",
          channels: [
            { name: "general", target: "slack:C1", service: "slack", connected: true },
            { name: "ops", target: "telegram:C1", service: "telegram", connected: false },
            { name: "watercooler", target: "signal:C1", service: "signal", connected: true },
          ],
          users: [{ target: "discord:U1", service: "discord", role: "admin" }],
          conversations: [{ key: "irc:room", service: "irc", channelName: "room", lastActivityAt: 1 }],
        },
      ],
      services: [{ name: "slack", maxMessageLength: 4000 }],
      groups: [{ name: "team", members: ["matrix:U2", "group:team"] }],
    };
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    const byName = Object.fromEntries(result.current.channelCards.map(card => [card.name, card]));
    expect(byName.Slack).toMatchObject({ id: "svc-slack", connected: true, href: "/bots" });
    expect(result.current.channelCards.filter(card => card.name === "Slack")).toHaveLength(1);
    expect(byName.Signal).toMatchObject({ id: "chan-signal", connected: true, detail: "Connected for bots", href: "/bots" });
    expect(byName.Telegram).toMatchObject({ connected: false, detail: "Configured on a bot, provider offline", href: "/bots" });
    expect(byName.Discord).toMatchObject({ connected: false, href: "/bots" });
    expect(byName.Irc).toMatchObject({ connected: false, href: "/bots" });
    expect(byName.Matrix).toMatchObject({ connected: false, href: "/bots" });
    expect(byName.Group).toBeUndefined();
    expect(result.current.connectedCount).toBe(2);
  });

  it("does not turn a failed email provider list into a missing provider or an offline chat service", () => {
    emailProviders = undefined;
    emailError = new Error("providers down");
    const { result } = renderHook(() => useMessagingData(), { wrapper });
    expect(result.current.emailProvidersFailed).toBe(true);
    expect(result.current.emailConfiguration.error).toBe(emailError);
    expect(result.current.providers).toEqual([]);
    expect(result.current.channelCards).toEqual([]);
    expect(result.current.connectedCount).toBe(0);
  });
});
