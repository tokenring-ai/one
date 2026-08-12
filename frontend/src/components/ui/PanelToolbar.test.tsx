import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Mail, Plus } from "lucide-react";
import PanelToolbar from "./PanelToolbar.tsx";

describe("PanelToolbar", () => {
  it("renders the title next to the icon badge", () => {
    render(<PanelToolbar icon={Mail} iconGradient="from-red-500 to-rose-600" title="Email" actions={<button type="button">Open Agent</button>} />);

    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open Agent" })).toBeInTheDocument();
  });

  it("omits the title when not provided", () => {
    const { container } = render(
      <PanelToolbar icon={Mail} iconGradient="from-red-500 to-rose-600" middle={<span>Mailbox</span>} actions={<button type="button">Compose</button>} />,
    );

    expect(screen.getByText("Mailbox")).toBeInTheDocument();
    expect(container.querySelector("span.text-sm.font-semibold")).toBeNull();
  });

  it("renders middle content between the title and actions", () => {
    render(
      <PanelToolbar
        icon={Mail}
        iconGradient="from-red-500 to-rose-600"
        title="Media"
        middle={<input aria-label="Search" placeholder="Search…" />}
        actions={<button type="button">Action</button>}
      />,
    );

    expect(screen.getByRole("textbox", { name: "Search" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Action" })).toBeInTheDocument();
  });

  it("shows the vertical divider by default", () => {
    const { container } = render(
      <PanelToolbar icon={Mail} iconGradient="from-cyan-500 to-blue-600" title="Database" actions={<button type="button">Open Agent</button>} />,
    );

    const divider = container.querySelector(".w-px.h-5");
    expect(divider).not.toBeNull();
    expect(divider).toHaveAttribute("aria-hidden", "true");
  });

  it("hides the divider when showDivider is false", () => {
    const { container } = render(
      <PanelToolbar
        icon={Mail}
        iconGradient="from-cyan-500 to-blue-600"
        title="Database"
        actions={<button type="button">Open Agent</button>}
        showDivider={false}
      />,
    );

    expect(container.querySelector(".w-px.h-5")).toBeNull();
  });

  it("applies the icon gradient classes to the badge", () => {
    const { container } = render(<PanelToolbar icon={Plus} iconGradient="from-pink-500 to-rose-600" title="Media" actions={<span>actions</span>} />);

    const badge = container.querySelector(".bg-linear-to-br");
    expect(badge).not.toBeNull();
    expect(badge).toHaveClass("from-pink-500", "to-rose-600");
  });

  it("merges className onto the container", () => {
    const { container } = render(
      <PanelToolbar icon={Mail} iconGradient="from-red-500 to-rose-600" title="Email" actions={<span>actions</span>} className="data-custom" />,
    );

    expect(container.firstChild).toHaveClass("data-custom");
    expect(container.firstChild).toHaveClass("h-11", "bg-secondary");
  });

  it("renders multiple action nodes", () => {
    render(
      <PanelToolbar
        icon={Mail}
        iconGradient="from-red-500 to-rose-600"
        title="Email"
        actions={
          <>
            <button type="button">Compose</button>
            <button type="button">AI Agent</button>
          </>
        }
      />,
    );

    expect(screen.getByRole("button", { name: "Compose" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "AI Agent" })).toBeInTheDocument();
  });
});
