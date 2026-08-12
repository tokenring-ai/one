import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Hash } from "lucide-react";
import TagChip from "./TagChip.tsx";

describe("TagChip", () => {
  it("renders the label", () => {
    render(<TagChip label="typescript" />);

    expect(screen.getByText("typescript")).toBeInTheDocument();
  });

  it("shows the default Tag icon", () => {
    const { container } = render(<TagChip label="react" data-testid="chip" />);

    const chip = screen.getByTestId("chip");
    expect(chip.querySelector("svg")).not.toBeNull();
    expect(container.querySelector("svg")).toHaveClass("w-2.5", "h-2.5");
  });

  it("hides the icon when showIcon is false", () => {
    const { container } = render(<TagChip label="no-icon" showIcon={false} />);

    expect(container.querySelector("svg")).toBeNull();
  });

  it("uses a custom icon and sm size", () => {
    const { container } = render(<TagChip label="hash" icon={Hash} iconSize="sm" data-testid="hash-chip" />);

    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg).toHaveClass("w-3", "h-3");
  });

  it("applies variant styles", () => {
    render(<TagChip label="urgent" variant="rose" data-testid="rose-chip" />);

    expect(screen.getByTestId("rose-chip")).toHaveClass("bg-rose-500/10", "border-rose-500/30", "text-rose-600");
  });

  it("renders as a span when not clickable", () => {
    render(<TagChip label="static" data-testid="static-chip" />);

    expect(screen.getByTestId("static-chip").tagName).toBe("SPAN");
    expect(screen.queryByRole("button")).toBeNull();
  });

  it("renders as a button and calls onClick when interactive", async () => {
    const onClick = mock(() => {});
    render(<TagChip label="filter-me" onClick={onClick} data-testid="clickable" />);

    const button = screen.getByRole("button", { name: /filter-me/i });
    expect(button).toBe(screen.getByTestId("clickable"));

    await userEvent.click(button);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("applies selected styles and aria-pressed", () => {
    render(<TagChip label="active" onClick={() => {}} selected data-testid="selected" />);

    const chip = screen.getByTestId("selected");
    expect(chip).toHaveAttribute("aria-pressed", "true");
    expect(chip).toHaveClass("bg-accent-subtle", "border-accent", "text-accent-soft");
  });

  it("forwards className and data-testid", () => {
    const { container } = render(<TagChip label="custom" className="custom-chip" data-testid="chip-id" />);

    expect(screen.getByTestId("chip-id")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-chip");
  });
});
