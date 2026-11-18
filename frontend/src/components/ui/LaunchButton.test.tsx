import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Rocket } from "lucide-react";
import LaunchButton from "./LaunchButton.tsx";

describe("LaunchButton", () => {
  it("renders labeled default state with Launch text", () => {
    render(<LaunchButton loading={false} onClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Launch" })).toBeInTheDocument();
  });

  it("shows spinner and loading label while loading", () => {
    const { container } = render(<LaunchButton loading onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Launching…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("calls onClick when not loading", async () => {
    const onClick = mock(() => {});
    render(<LaunchButton loading={false} onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Launch" }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("does not call onClick while loading", async () => {
    const onClick = mock(() => {});
    render(<LaunchButton loading onClick={onClick} />);

    await userEvent.click(screen.getByRole("button", { name: "Launching…" }));

    expect(onClick).not.toHaveBeenCalled();
  });

  it("respects disabled independently of loading", async () => {
    const onClick = mock(() => {});
    render(<LaunchButton loading={false} onClick={onClick} disabled />);

    const button = screen.getByRole("button", { name: "Launch" });
    expect(button).toBeDisabled();
    expect(button).not.toHaveAttribute("aria-busy");

    await userEvent.click(button);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("is disabled when both loading and disabled", () => {
    const { container } = render(<LaunchButton loading disabled onClick={() => {}} />);

    const button = screen.getByRole("button", { name: "Launching…" });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute("aria-busy", "true");
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("accepts custom labels", () => {
    render(<LaunchButton loading={false} onClick={() => {}} label="Run" loadingLabel="Running…" />);

    expect(screen.getByRole("button", { name: "Run" })).toBeInTheDocument();
  });

  it("shows custom loading label when loading", () => {
    render(<LaunchButton loading onClick={() => {}} label="Run" loadingLabel="Running…" />);

    expect(screen.getByRole("button", { name: "Running…" })).toBeInTheDocument();
  });

  it("renders icon-only variant without text", () => {
    render(<LaunchButton loading={false} onClick={() => {}} variant="icon" aria-label="Run workflow" title="Run workflow" />);

    const button = screen.getByRole("button", { name: "Run workflow" });
    expect(button).not.toHaveTextContent("Launch");
    expect(button).toHaveClass("p-1");
  });

  it("defaults aria-label from label for icon-only when not provided", () => {
    render(<LaunchButton loading={false} onClick={() => {}} variant="icon" label="Start" />);

    expect(screen.getByRole("button", { name: "Start" })).toBeInTheDocument();
  });

  it("uses loadingLabel as aria-label when icon-only and loading", () => {
    render(<LaunchButton loading onClick={() => {}} variant="icon" label="Start" loadingLabel="Starting…" />);

    expect(screen.getByRole("button", { name: "Starting…" })).toBeInTheDocument();
  });

  it("applies sm icon size classes", () => {
    const { container } = render(<LaunchButton loading={false} onClick={() => {}} iconSize="sm" variant="icon" aria-label="Run" />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("w-3", "h-3");
  });

  it("applies md icon size classes by default", () => {
    const { container } = render(<LaunchButton loading={false} onClick={() => {}} />);

    const svg = container.querySelector("svg");
    expect(svg).toHaveClass("w-3.5", "h-3.5");
  });

  it("accepts a custom icon", () => {
    const { container } = render(<LaunchButton loading={false} onClick={() => {}} icon={Rocket} label="Blast off" />);

    expect(screen.getByRole("button", { name: "Blast off" })).toBeInTheDocument();
    expect(container.querySelector("svg")).toBeTruthy();
  });

  it("applies custom bgClassName for labeled variant", () => {
    render(<LaunchButton loading={false} onClick={() => {}} bgClassName="bg-cyan-600 hover:bg-cyan-500" />);

    expect(screen.getByRole("button", { name: "Launch" })).toHaveClass("bg-cyan-600", "hover:bg-cyan-500");
  });

  it("forwards title, className, and data-testid", () => {
    render(<LaunchButton loading={false} onClick={() => {}} title="Start a new agent" className="shrink-0" data-testid="launch-btn" />);

    const button = screen.getByTestId("launch-btn");
    expect(button).toHaveAttribute("title", "Start a new agent");
    expect(button).toHaveClass("shrink-0");
  });

  it("applies default accent background for labeled variant", () => {
    render(<LaunchButton loading={false} onClick={() => {}} />);

    expect(screen.getByRole("button", { name: "Launch" })).toHaveClass("bg-accent", "hover:bg-accent-hover");
  });
});
