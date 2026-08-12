import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import ChangeIndicator, { changeSign } from "./ChangeIndicator.tsx";

describe("changeSign", () => {
  it("prefixes only strictly positive values with plus", () => {
    expect(changeSign(5)).toBe("+");
    expect(changeSign(-3)).toBe("");
    expect(changeSign(0)).toBe("");
  });
});

describe("ChangeIndicator", () => {
  it("renders positive change with up arrow, sign, and percent", () => {
    const { container } = render(<ChangeIndicator change={2.5} changePercent={1.23} data-testid="change" />);

    const el = screen.getByTestId("change");
    expect(el).toHaveClass("text-emerald-500");
    expect(el).toHaveTextContent("+2.50 (+1.23%)");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders negative change with down arrow and no plus sign", () => {
    const { container } = render(<ChangeIndicator change={-1.5} changePercent={-0.8} data-testid="change" />);

    const el = screen.getByTestId("change");
    expect(el).toHaveClass("text-red-500");
    expect(el).toHaveTextContent("-1.50 (-0.80%)");
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders flat zero with muted color and no icon", () => {
    const { container } = render(<ChangeIndicator change={0} changePercent={0} data-testid="change" />);

    const el = screen.getByTestId("change");
    expect(el).toHaveClass("text-muted");
    expect(el).toHaveTextContent("0.00 (0.00%)");
    expect(container.querySelector("svg")).toBeNull();
  });

  it("shows flatDisplay for null, undefined, and NaN", () => {
    const { rerender } = render(<ChangeIndicator change={null} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("—");

    rerender(<ChangeIndicator change={undefined} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("—");

    rerender(<ChangeIndicator change={Number.NaN} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("—");
  });

  it("uses custom flatDisplay", () => {
    render(<ChangeIndicator change={null} flatDisplay="N/A" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("N/A");
  });

  it("hides percent when showPercent is false", () => {
    render(<ChangeIndicator change={1.5} changePercent={2.0} showPercent={false} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("+1.50");
    expect(screen.getByTestId("change")).not.toHaveTextContent("%");
  });

  it("hides percent when changePercent is omitted", () => {
    render(<ChangeIndicator change={1.5} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("+1.50");
    expect(screen.getByTestId("change")).not.toHaveTextContent("%");
  });

  it("hides icon when showIcon is false", () => {
    const { container } = render(<ChangeIndicator change={1.5} showIcon={false} data-testid="change" />);
    expect(container.querySelector("svg")).toBeNull();
    expect(screen.getByTestId("change")).toHaveTextContent("+1.50");
  });

  it("applies size classes to the icon", () => {
    const { container, rerender } = render(<ChangeIndicator change={1} size="sm" />);
    expect(container.querySelector("svg")).toHaveClass("w-3", "h-3");

    rerender(<ChangeIndicator change={1} size="md" />);
    expect(container.querySelector("svg")).toHaveClass("w-4", "h-4");

    rerender(<ChangeIndicator change={1} size="lg" />);
    expect(container.querySelector("svg")).toHaveClass("w-5", "h-5");
  });

  it("applies alignment classes", () => {
    const { rerender } = render(<ChangeIndicator change={1} align="right" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveClass("justify-end");

    rerender(<ChangeIndicator change={1} align="center" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveClass("justify-center");

    rerender(<ChangeIndicator change={1} align="left" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveClass("justify-start");
  });

  it("uses custom formatters", () => {
    render(<ChangeIndicator change={1.234} changePercent={0.5} formatChange={v => v.toFixed(1)} formatPercent={v => v.toFixed(0)} data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("+1.2 (+1%)");
  });

  it("supports percent-only display via custom formatChange", () => {
    render(<ChangeIndicator change={1.23} showIcon={false} formatChange={v => `${v.toFixed(2)}%`} className="text-xs font-medium" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveTextContent("+1.23%");
    expect(screen.getByTestId("change")).not.toHaveTextContent("(");
  });

  it("allows custom color classes", () => {
    render(<ChangeIndicator change={1} upColor="text-green-400" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveClass("text-green-400");
  });

  it("forwards className", () => {
    render(<ChangeIndicator change={1} className="text-sm font-medium" data-testid="change" />);
    expect(screen.getByTestId("change")).toHaveClass("text-sm", "font-medium");
  });
});
