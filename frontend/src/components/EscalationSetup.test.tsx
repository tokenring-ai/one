import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

const setEscalation = mock(async (_args: unknown) => ({ status: "success" as const }));
const testEscalation = mock(
  async (_args: unknown): Promise<{ status: "success"; target: string } | { status: "failed"; message: string }> => ({
    status: "success",
    target: "telegram:42",
  }),
);
let botData: unknown;

void mock.module("../rpc.ts", () => ({
  botRPCClient: { setEscalation, testEscalation },
  useBots: () => ({ data: botData }),
}));

const { default: EscalationSetup } = await import("./EscalationSetup.tsx");

const bots = (overrides: Record<string, unknown> = {}) => ({
  status: "success",
  bots: [],
  services: [{ name: "telegram", maxMessageLength: 4000 }],
  groups: [],
  discoveredChannels: [],
  escalation: { target: "", afterSeconds: 300, answerFromChat: true, agentTypes: [], jobAlertsEnabled: false },
  ...overrides,
});

const renderSetup = (onSaved = mock()) => {
  render(
    <MemoryRouter>
      <EscalationSetup onSaved={onSaved} />
    </MemoryRouter>,
  );
  return onSaved;
};

describe("EscalationSetup", () => {
  beforeEach(() => {
    setEscalation.mockClear();
    testEscalation.mockClear();
    botData = bots();
  });

  it("sends the person to Bots when no messaging service is connected", () => {
    botData = bots({ services: [] });
    renderSetup();
    expect(screen.getByTestId("escalation-needs-service")).toHaveTextContent("No messaging service is connected yet");
    expect(screen.getByRole("link", { name: "Bots" })).toHaveAttribute("href", "/bots");
    expect(screen.queryByRole("button", { name: /Save/ })).toBeNull();
  });

  it("validates a typed address, saves it with failure alerts on, then sends a test", async () => {
    const user = userEvent.setup();
    const onSaved = renderSetup();
    const save = screen.getByRole("button", { name: "Save and send a test message" });
    expect(save).toBeDisabled();

    await user.type(screen.getByLabelText("Send questions to"), "not-an-address");
    expect(screen.getByText(/Use service:id/)).toBeInTheDocument();
    expect(save).toBeDisabled();

    await user.clear(screen.getByLabelText("Send questions to"));
    await user.type(screen.getByLabelText("Send questions to"), "telegram:42");
    await user.click(save);

    await waitFor(() => expect(testEscalation).toHaveBeenCalledTimes(1));
    expect(setEscalation).toHaveBeenCalledWith({ target: "telegram:42", jobAlertsEnabled: true });
    expect(onSaved).toHaveBeenCalledTimes(1);
    expect(await screen.findByText("Saved. A test message was sent to telegram:42.")).toBeInTheDocument();
  });

  it("offers channels, the person who added the bot and groups the bots already know", async () => {
    botData = bots({
      discoveredChannels: [{ target: "slack:C1", service: "slack", channelId: "C1", title: "#ops", discoveredAt: 1, invitedBy: "slack:U9" }],
      groups: [{ name: "oncall", members: ["telegram:1", "telegram:2"] }],
    });
    const user = userEvent.setup();
    renderSetup();

    const select = screen.getByLabelText("Send questions to");
    const labels = Array.from(select.querySelectorAll("option")).map(option => option.textContent);
    expect(labels).toEqual(["Choose…", "#ops (channel, slack)", "slack:U9 (added the bot to #ops)", "oncall (group, 2 members)", "Another address…"]);

    await user.selectOptions(select, "group:oncall");
    await user.click(screen.getByRole("button", { name: "Save and send a test message" }));
    await waitFor(() => expect(setEscalation).toHaveBeenCalledWith({ target: "group:oncall", jobAlertsEnabled: true }));
  });

  it("honours the alerts checkbox", async () => {
    const user = userEvent.setup();
    renderSetup();
    await user.type(screen.getByLabelText("Send questions to"), "telegram:42");
    await user.click(screen.getByRole("checkbox", { name: /fails or is interrupted/ }));
    await user.click(screen.getByRole("button", { name: "Save and send a test message" }));
    await waitFor(() => expect(setEscalation).toHaveBeenCalledWith({ target: "telegram:42", jobAlertsEnabled: false }));
  });

  it("says plainly when the address was saved but the test message failed", async () => {
    testEscalation.mockResolvedValueOnce({ status: "failed", message: "chat not found" });
    const user = userEvent.setup();
    renderSetup();
    await user.type(screen.getByLabelText("Send questions to"), "telegram:42");
    await user.click(screen.getByRole("button", { name: "Save and send a test message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saved, but the test message to telegram:42 did not go through: chat not found");
  });

  it("shows a rejected save and does not send a test", async () => {
    setEscalation.mockResolvedValueOnce({ status: "configRejected", issues: [{ path: [], message: "Unknown service" }] } as never);
    const user = userEvent.setup();
    const onSaved = renderSetup();
    await user.type(screen.getByLabelText("Send questions to"), "nope:1");
    await user.click(screen.getByRole("button", { name: "Save and send a test message" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Could not save: Unknown service");
    expect(testEscalation).not.toHaveBeenCalled();
    expect(onSaved).not.toHaveBeenCalled();
  });
});
