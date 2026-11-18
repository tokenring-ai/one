import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Bot, Settings2 } from "lucide-react";
import type { ReactElement } from "react";
import { MemoryRouter } from "react-router-dom";
import PlatformCard from "./PlatformCard.tsx";

function renderCard(ui: ReactElement) {
  return render(<MemoryRouter>{ui}</MemoryRouter>);
}

describe("PlatformCard", () => {
  it("renders name, description, detail, and gradient badge", () => {
    const { container } = renderCard(
      <PlatformCard name="Slack" description="Workspaces and channels" detail="1 account live (workspace)" gradient="from-purple-500 to-violet-600" />,
    );

    expect(screen.getByText("Slack")).toBeInTheDocument();
    expect(screen.getByText("Workspaces and channels")).toBeInTheDocument();
    expect(screen.getByText("1 account live (workspace)")).toBeInTheDocument();

    const badge = container.querySelector(".from-purple-500");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("to-violet-600", "bg-linear-to-br");
  });

  it("renders optional icon inside the gradient badge", () => {
    renderCard(
      <PlatformCard
        name="Slack"
        description="Workspaces"
        detail="Connected"
        gradient="from-purple-500 to-violet-600"
        icon={<Settings2 data-testid="platform-icon" />}
      />,
    );

    expect(screen.getByTestId("platform-icon")).toBeInTheDocument();
  });

  it("renders status badge when provided", () => {
    renderCard(
      <PlatformCard
        name="Telegram"
        description="Bot accounts"
        detail="Needs config"
        gradient="from-sky-500 to-blue-600"
        statusBadge={<span data-testid="status-badge">Needs config</span>}
      />,
    );

    expect(screen.getByTestId("status-badge")).toHaveTextContent("Needs config");
  });

  it("renders action links with href as router links", () => {
    renderCard(
      <PlatformCard
        name="Discord"
        description="Servers"
        detail="Ready"
        gradient="from-indigo-500 to-violet-600"
        actions={[
          { label: "Configure", icon: <Settings2 data-testid="config-icon" />, href: "/configuration/discord", primary: true },
          { label: "Manage bots", icon: <Bot data-testid="bots-icon" />, href: "/bots" },
        ]}
      />,
    );

    const configure = screen.getByRole("link", { name: /Configure/i });
    expect(configure).toHaveAttribute("href", "/configuration/discord");
    expect(screen.getByTestId("config-icon")).toBeInTheDocument();

    const bots = screen.getByRole("link", { name: /Manage bots/i });
    expect(bots).toHaveAttribute("href", "/bots");
    expect(screen.getByTestId("bots-icon")).toBeInTheDocument();
  });

  it("renders action buttons and calls onClick", async () => {
    const onAction = mock(() => {});
    renderCard(
      <PlatformCard
        name="X"
        description="Mentions"
        detail="Configured"
        gradient="from-gray-700 to-gray-900"
        actions={[{ label: "Open vault", icon: <Settings2 />, onClick: onAction }]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Open vault/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it("applies primary styling to primary actions", () => {
    renderCard(
      <PlatformCard
        name="Reddit"
        description="Subreddits"
        detail="Ready"
        gradient="from-orange-500 to-red-600"
        actions={[
          { label: "Primary", icon: <Settings2 />, href: "/primary", primary: true },
          { label: "Secondary", icon: <Bot />, href: "/secondary" },
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /Primary/i })).toHaveClass("text-primary");
    expect(screen.getByRole("link", { name: /Secondary/i })).toHaveClass("text-muted");
  });

  it("applies muted opacity when muted", () => {
    const { container } = renderCard(
      <PlatformCard name="Reddit" description="Subreddits" detail="Not installed" gradient="from-orange-500 to-red-600" muted />,
    );

    expect(container.firstChild).toHaveClass("opacity-80");
  });

  it("makes the card clickable when onClick is provided", async () => {
    const onClick = mock(() => {});
    renderCard(<PlatformCard name="Slack" description="Workspaces" detail="Open details" gradient="from-purple-500 to-violet-600" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: /Slack/i }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not fire card onClick when an action button is clicked", async () => {
    const onCardClick = mock(() => {});
    const onAction = mock(() => {});
    renderCard(
      <PlatformCard
        name="Slack"
        description="Workspaces"
        detail="Open details"
        gradient="from-purple-500 to-violet-600"
        onClick={onCardClick}
        actions={[{ label: "Open vault", icon: <Settings2 />, onClick: onAction }]}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /Open vault/i }));
    expect(onAction).toHaveBeenCalledTimes(1);
    expect(onCardClick).not.toHaveBeenCalled();
  });

  it("forwards data-testid and className", () => {
    const { container } = renderCard(
      <PlatformCard
        name="Email"
        description="Inbox"
        detail="Ready"
        gradient="from-red-500 to-rose-600"
        className="custom-platform"
        data-testid="platform-card"
      />,
    );

    expect(screen.getByTestId("platform-card")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-platform");
  });

  it("does not render actions row when actions is empty or omitted", () => {
    const { rerender } = renderCard(<PlatformCard name="Slack" description="Workspaces" detail="Ready" gradient="from-purple-500 to-violet-600" />);

    expect(screen.queryByRole("link")).not.toBeInTheDocument();

    rerender(
      <MemoryRouter>
        <PlatformCard name="Slack" description="Workspaces" detail="Ready" gradient="from-purple-500 to-violet-600" actions={[]} />
      </MemoryRouter>,
    );

    expect(screen.queryByRole("link")).not.toBeInTheDocument();
  });
});
