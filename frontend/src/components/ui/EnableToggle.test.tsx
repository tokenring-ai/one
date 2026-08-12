import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Check, X } from "lucide-react";
import EnableToggle from "./EnableToggle.tsx";

describe("EnableToggle", () => {
  it("renders enabled state with On label and aria attributes", () => {
    render(<EnableToggle enabled onToggle={() => {}} itemName="email_send" />);

    const button = screen.getByRole("button", { name: "Disable email_send" });
    expect(button).toHaveAttribute("aria-pressed", "true");
    expect(button).toHaveTextContent("On");
  });

  it("renders disabled state with Off label", () => {
    render(<EnableToggle enabled={false} onToggle={() => {}} itemName="email_send" />);

    const button = screen.getByRole("button", { name: "Enable email_send" });
    expect(button).toHaveAttribute("aria-pressed", "false");
    expect(button).toHaveTextContent("Off");
  });

  it("calls onToggle when clicked", async () => {
    const onToggle = mock(() => {});
    render(<EnableToggle enabled={false} onToggle={onToggle} itemName="skill" />);

    await userEvent.click(screen.getByRole("button", { name: "Enable skill" }));

    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it("shows spinner and is disabled while loading", async () => {
    const onToggle = mock(() => {});
    const { container } = render(<EnableToggle enabled onToggle={onToggle} itemName="tool" loading />);

    const button = screen.getByRole("button", { name: "Disable tool" });
    expect(button).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeTruthy();

    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("respects disabled prop independently of loading", async () => {
    const onToggle = mock(() => {});
    render(<EnableToggle enabled={false} onToggle={onToggle} itemName="hook" disabled />);

    const button = screen.getByRole("button", { name: "Enable hook" });
    expect(button).toBeDisabled();

    await userEvent.click(button);
    expect(onToggle).not.toHaveBeenCalled();
  });

  it("hides labels when showLabels is false", () => {
    render(<EnableToggle enabled onToggle={() => {}} itemName="skill" showLabels={false} />);

    const button = screen.getByRole("button", { name: "Disable skill" });
    expect(button).not.toHaveTextContent("On");
    expect(button).not.toHaveTextContent("Off");
  });

  it("accepts custom enabled/disabled icons", () => {
    const { container } = render(<EnableToggle enabled onToggle={() => {}} itemName="hook" enabledIcon={Check} disabledIcon={X} />);

    // lucide Check renders an SVG; ensure button still has On label
    expect(screen.getByRole("button", { name: "Disable hook" })).toHaveTextContent("On");
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("applies custom color classes", () => {
    render(
      <EnableToggle
        enabled
        onToggle={() => {}}
        itemName="flag"
        enabledColors={{
          bg: "bg-emerald-500/10",
          text: "text-emerald-600",
          border: "border-emerald-500/30",
          hover: "hover:bg-emerald-500/20",
        }}
      />,
    );

    const button = screen.getByRole("button", { name: "Disable flag" });
    expect(button).toHaveClass("bg-emerald-500/10", "text-emerald-600", "border-emerald-500/30");
  });

  it("applies sm size padding", () => {
    render(<EnableToggle enabled onToggle={() => {}} itemName="skill" size="sm" showLabels={false} />);

    expect(screen.getByRole("button", { name: "Disable skill" })).toHaveClass("p-1.5");
  });

  it("forwards className and data-testid", () => {
    render(<EnableToggle enabled onToggle={() => {}} itemName="x" className="shrink-0" data-testid="enable-toggle" />);

    const button = screen.getByTestId("enable-toggle");
    expect(button).toHaveClass("shrink-0");
    expect(button).toHaveAttribute("aria-pressed", "true");
  });

  it("sets title matching aria-label for tooltips", () => {
    render(<EnableToggle enabled={false} onToggle={() => {}} itemName="plugins" />);

    expect(screen.getByRole("button", { name: "Enable plugins" })).toHaveAttribute("title", "Enable plugins");
  });
});
