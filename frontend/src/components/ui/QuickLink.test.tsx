import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Mail } from "lucide-react";
import QuickLink from "./QuickLink.tsx";

describe("QuickLink", () => {
  it("renders title, description, and icon", () => {
    render(
      <QuickLink
        title="Email inbox"
        description="Browse, search, and reply with AI"
        icon={<Mail data-testid="link-icon" />}
        gradient="from-red-500 to-rose-600"
        onClick={() => {}}
      />,
    );

    expect(screen.getByText("Email inbox")).toBeInTheDocument();
    expect(screen.getByText("Browse, search, and reply with AI")).toBeInTheDocument();
    expect(screen.getByTestId("link-icon")).toBeInTheDocument();
  });

  it("calls onClick when clicked", async () => {
    const onClick = mock(() => {});
    render(<QuickLink title="Bots" description="Channels and threads" icon={<Mail />} gradient="from-teal-500 to-emerald-600" onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: /Bots/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies gradient classes to the icon badge", () => {
    const { container } = render(
      <QuickLink title="Configuration" description="Connect services" icon={<Mail />} gradient="from-slate-500 to-zinc-600" onClick={() => {}} />,
    );

    const badge = container.querySelector(".from-slate-500");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("to-zinc-600", "bg-linear-to-br");
  });

  it("uses md size styles by default", () => {
    render(<QuickLink title="Email inbox" description="Browse messages" icon={<Mail />} gradient="from-red-500 to-rose-600" onClick={() => {}} />);

    const button = screen.getByRole("button", { name: /Email inbox/i });
    expect(button).toHaveClass("px-4", "py-3", "gap-3");
    expect(screen.getByText("Email inbox")).toHaveClass("text-sm");
  });

  it("applies sm size styles when size is sm", () => {
    render(<QuickLink title="Compact link" description="Smaller card" icon={<Mail />} gradient="from-blue-500 to-indigo-600" onClick={() => {}} size="sm" />);

    const button = screen.getByRole("button", { name: /Compact link/i });
    expect(button).toHaveClass("px-3", "py-2.5", "gap-2.5");
    expect(screen.getByText("Compact link")).toHaveClass("text-xs");
  });

  it("forwards data-testid and className", () => {
    const { container } = render(
      <QuickLink
        title="Settings"
        description="App preferences"
        icon={<Mail />}
        gradient="from-zinc-500 to-slate-600"
        onClick={() => {}}
        className="custom-link"
        data-testid="quick-link-settings"
      />,
    );

    expect(screen.getByTestId("quick-link-settings")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-link");
  });
});
