import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import OverlayText from "./OverlayText.tsx";

describe("OverlayText", () => {
  it("renders the message", () => {
    render(<OverlayText message="Waiting for output..." />);

    expect(screen.getByRole("status")).toHaveTextContent("Waiting for output...");
  });

  it("defaults to top-left positioning and pointer-events-none", () => {
    const { container } = render(<OverlayText message="Connecting..." data-testid="overlay" />);

    const el = screen.getByTestId("overlay");
    expect(el).toBe(container.firstChild as HTMLElement);
    expect(el).toHaveClass("absolute", "inset-0", "items-start", "p-4", "pointer-events-none");
  });

  it("applies position variants", () => {
    const { rerender } = render(<OverlayText message="Loading…" position="top-center" data-testid="overlay" />);
    expect(screen.getByTestId("overlay")).toHaveClass("items-start", "justify-center", "pt-8");

    rerender(<OverlayText message="Loading…" position="center" data-testid="overlay" />);
    expect(screen.getByTestId("overlay")).toHaveClass("items-center", "justify-center");

    rerender(<OverlayText message="Loading…" position="bottom-center" data-testid="overlay" />);
    expect(screen.getByTestId("overlay")).toHaveClass("items-end", "justify-center", "pb-4");
  });

  it("allows pointer events when passThrough is false", () => {
    render(<OverlayText message="Blocked" passThrough={false} data-testid="overlay" />);

    expect(screen.getByTestId("overlay")).not.toHaveClass("pointer-events-none");
  });

  it("applies mono font and size classes", () => {
    render(<OverlayText message="Shell" font="mono" size="sm" data-testid="overlay" />);

    const el = screen.getByTestId("overlay");
    expect(el).toHaveClass("font-mono", "text-sm");
  });

  it("dims the background when requested", () => {
    render(<OverlayText message="Loading…" dimBackground data-testid="overlay" />);

    expect(screen.getByTestId("overlay")).toHaveClass("bg-primary/40");
  });

  it("renders a spinner when spinner is true", () => {
    const { container } = render(<OverlayText message="Connecting..." spinner data-testid="overlay" />);

    expect(container.querySelector("svg")).not.toBeNull();
    expect(screen.getByTestId("overlay")).toHaveTextContent("Connecting...");
  });

  it("does not render a spinner by default", () => {
    const { container } = render(<OverlayText message="Idle" />);

    expect(container.querySelector("svg")).toBeNull();
  });
});
