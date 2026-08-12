import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { CheckCircle2 } from "lucide-react";
import StatusBadge, { type StatusBadgeDefinition } from "./StatusBadge.tsx";

const STATUSES: Record<string, StatusBadgeDefinition> = {
  connected: {
    label: "Connected",
    icon: <CheckCircle2 className="w-3 h-3" data-testid="connected-icon" />,
    colorClass: "bg-teal-500/10 text-teal-600 border-teal-500/30",
  },
  live: {
    label: "Live",
    dotColor: "bg-emerald-500",
    pulse: true,
    colorClass: "bg-emerald-500/10 text-emerald-600 border-emerald-500/30",
  },
  draft: {
    label: "Draft",
    dotColor: "bg-amber-400",
    colorClass: "bg-amber-400/10 text-amber-600 border-amber-400/30",
  },
  running: {
    label: "Running",
    icon: <CheckCircle2 className="w-3 h-3" data-testid="running-icon" />,
    colorClass: "text-amber-600",
  },
};

describe("StatusBadge", () => {
  it("renders label and color classes from a statuses map", () => {
    render(<StatusBadge status="connected" statuses={STATUSES} data-testid="badge" />);

    const badge = screen.getByTestId("badge");
    expect(badge).toHaveTextContent("Connected");
    expect(badge).toHaveClass("bg-teal-500/10", "text-teal-600", "border-teal-500/30");
    expect(badge).toHaveClass("rounded-full", "border", "text-xs", "font-medium");
    expect(badge).toHaveClass("px-2", "py-0.5");
    expect(screen.getByTestId("connected-icon")).toBeInTheDocument();
  });

  it("renders a pulsing colored dot when dotColor is set", () => {
    const { container } = render(<StatusBadge status="live" statuses={STATUSES} data-testid="live" />);

    const badge = screen.getByTestId("live");
    expect(badge).toHaveTextContent("Live");
    const dot = container.querySelector(".rounded-full.bg-emerald-500");
    expect(dot).not.toBeNull();
    expect(dot).toHaveClass("animate-pulse", "w-1.5", "h-1.5");
  });

  it("prefers icon over dot when both are defined", () => {
    const { container } = render(<StatusBadge label="Both" icon={<CheckCircle2 data-testid="icon" />} dotColor="bg-red-500" colorClass="bg-tertiary" />);

    expect(screen.getByTestId("icon")).toBeInTheDocument();
    expect(container.querySelector(".bg-red-500")).toBeNull();
  });

  it("allows direct props without a statuses map", () => {
    render(<StatusBadge label="Custom" colorClass="bg-sky-500/10 text-sky-600 border-sky-500/30" data-testid="direct" />);

    expect(screen.getByTestId("direct")).toHaveTextContent("Custom");
    expect(screen.getByTestId("direct")).toHaveClass("bg-sky-500/10");
  });

  it("lets direct props override the statuses map entry", () => {
    render(<StatusBadge status="draft" statuses={STATUSES} label="Override" data-testid="override" />);

    expect(screen.getByTestId("override")).toHaveTextContent("Override");
    expect(screen.getByTestId("override")).not.toHaveTextContent("Draft");
  });

  it("uses inline variant without pill chrome", () => {
    render(<StatusBadge status="running" statuses={STATUSES} variant="inline" data-testid="inline" />);

    const badge = screen.getByTestId("inline");
    expect(badge).toHaveTextContent("Running");
    expect(badge).toHaveClass("text-amber-600", "shrink-0", "text-xs");
    expect(badge).not.toHaveClass("rounded-full");
    expect(badge.className.split(/\s+/)).not.toContain("border");
    expect(screen.getByTestId("running-icon")).toBeInTheDocument();
  });

  it("applies md gap", () => {
    render(<StatusBadge label="Gap" gap="md" data-testid="gap" />);

    expect(screen.getByTestId("gap")).toHaveClass("gap-1.5");
  });

  it("forwards title, className, and data-testid", () => {
    render(<StatusBadge label="Titled" title="tooltip" className="extra" data-testid="meta" />);

    const badge = screen.getByTestId("meta");
    expect(badge).toHaveAttribute("title", "tooltip");
    expect(badge).toHaveClass("extra");
  });

  it("falls back to the status key as label when map entry is missing", () => {
    render(<StatusBadge status="unknown" data-testid="fallback" />);

    expect(screen.getByTestId("fallback")).toHaveTextContent("unknown");
  });
});
