import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";

let escalationConfigured = false;
const mutate = mock(async () => undefined);

void mock.module("../rpc.ts", () => ({
  useJobPolicy: () => ({ data: { defaultApprovalLevel: 5, approvalCeiling: 6, defaultMaxCostUsd: null, escalationConfigured }, mutate }),
  useBots: () => ({ data: { status: "success", bots: [], services: [{ name: "telegram", maxMessageLength: 4000 }], groups: [], discoveredChannels: [] } }),
  botRPCClient: { setEscalation: async () => ({ status: "success" }), testEscalation: async () => ({ status: "success", target: "telegram:7" }) },
}));

const { JobPolicyNote } = await import("./JobLimitsFields.tsx");

const renderNote = () =>
  render(
    <MemoryRouter>
      <JobPolicyNote maxApprovalLevel="" />
    </MemoryRouter>,
  );

describe("JobPolicyNote escalation setup", () => {
  beforeEach(() => {
    escalationConfigured = false;
    mutate.mockClear();
  });

  it("offers to set escalation up in place, and opens the form on request", async () => {
    const user = userEvent.setup();
    renderNote();
    expect(screen.getByText(/No escalation target is set/)).toBeInTheDocument();
    expect(screen.queryByTestId("escalation-setup")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Set one up here" }));
    expect(screen.getByTestId("escalation-setup")).toBeInTheDocument();
  });

  it("says nothing about escalation when a target is already set", () => {
    escalationConfigured = true;
    renderNote();
    expect(screen.queryByText(/No escalation target is set/)).toBeNull();
    expect(screen.queryByRole("button", { name: "Set one up here" })).toBeNull();
  });

  it("refreshes the policy after saving and keeps the result on screen, without the stale 'not set' line", async () => {
    const user = userEvent.setup();
    const view = renderNote();
    await user.click(screen.getByRole("button", { name: "Set one up here" }));
    await user.type(screen.getByLabelText("Send questions to"), "telegram:7");
    await user.click(screen.getByRole("button", { name: "Save and send a test message" }));
    expect(await screen.findByText("Saved. A test message was sent to telegram:7.")).toBeInTheDocument();
    expect(mutate).toHaveBeenCalledTimes(1);

    escalationConfigured = true; // what the refreshed policy now says
    view.rerender(
      <MemoryRouter>
        <JobPolicyNote maxApprovalLevel="" />
      </MemoryRouter>,
    );
    expect(screen.queryByText(/No escalation target is set/)).toBeNull();
    expect(screen.getByText("Saved. A test message was sent to telegram:7.")).toBeInTheDocument();
  });
});
