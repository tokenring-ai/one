import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChannelStatusCard from "./ChannelStatusCard.tsx";

const baseProps = {
  id: "svc-slack",
  name: "Slack",
  kind: "messaging" as const,
  connected: true,
  detail: "Used by bots",
  onOpen: () => {},
};

describe("ChannelStatusCard", () => {
  it("renders name, detail, and Connected badge", () => {
    render(<ChannelStatusCard {...baseProps} />);

    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Used by bots")).toBeInTheDocument();
    expect(screen.getByText("Connected")).toBeInTheDocument();
  });

  it("shows Offline badge when not connected", () => {
    render(<ChannelStatusCard {...baseProps} connected={false} />);

    expect(screen.getByText("Offline")).toBeInTheDocument();
    expect(screen.queryByText("Connected")).not.toBeInTheDocument();
  });

  it("calls onOpen when clicked", async () => {
    const onOpen = mock(() => {});
    render(<ChannelStatusCard {...baseProps} onOpen={onOpen} />);

    await userEvent.click(screen.getByRole("button", { name: /Slack/i }));

    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("applies service gradient from name for messaging kind", () => {
    const { container } = render(<ChannelStatusCard {...baseProps} />);

    const badge = container.querySelector(".from-purple-500");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("to-violet-600", "bg-linear-to-br");
  });

  it("uses email gradient for email kind regardless of name", () => {
    const { container } = render(<ChannelStatusCard {...baseProps} id="email-gmail" name="gmail" kind="email" detail="Email provider ready" />);

    const badge = container.querySelector(".from-red-500");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("to-rose-600");
  });

  it("allows gradient override", () => {
    const { container } = render(<ChannelStatusCard {...baseProps} gradient="from-zinc-500 to-slate-600" />);

    const badge = container.querySelector(".from-zinc-500");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("to-slate-600");
  });

  it("applies compact sizing", () => {
    render(<ChannelStatusCard {...baseProps} compact />);

    const button = screen.getByRole("button", { name: /Slack/i });
    expect(button).toHaveClass("px-3", "py-2.5");
  });

  it("uses standard sizing by default", () => {
    render(<ChannelStatusCard {...baseProps} />);

    const button = screen.getByRole("button", { name: /Slack/i });
    expect(button).toHaveClass("px-4", "py-3");
  });

  it("sets data-channel-id from id prop", () => {
    render(<ChannelStatusCard {...baseProps} data-testid="channel-card" />);

    expect(screen.getByTestId("channel-card")).toHaveAttribute("data-channel-id", "svc-slack");
  });

  it("forwards data-testid and className", () => {
    const { container } = render(<ChannelStatusCard {...baseProps} className="custom-card" data-testid="status-card" />);

    expect(screen.getByTestId("status-card")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-card");
  });
});
