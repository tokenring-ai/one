import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import StatCard from "./StatCard.tsx";

describe("StatCard", () => {
  it("renders label and value", () => {
    render(<StatCard label="Open" value="$150.00" />);

    expect(screen.getByText("Open")).toBeInTheDocument();
    expect(screen.getByText("$150.00")).toBeInTheDocument();
  });

  it("renders optional subtitle", () => {
    render(<StatCard label="Volume" value="1.2M" sub="Avg 980K" />);

    expect(screen.getByText("Avg 980K")).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    const { container } = render(<StatCard label="Bid" value="$10.00" />);

    expect(container.querySelectorAll("div").length).toBe(3); // root + label + value
    expect(screen.queryByText("Avg")).toBeNull();
  });

  it("renders ReactNode value and sub", () => {
    render(<StatCard label="P/E" value={<span data-testid="pe-value">24.5</span>} sub={<span data-testid="pe-sub">TTM</span>} />);

    expect(screen.getByTestId("pe-value")).toHaveTextContent("24.5");
    expect(screen.getByTestId("pe-sub")).toHaveTextContent("TTM");
  });

  it("applies up accent color", () => {
    render(<StatCard label="1W" value="+2.4%" accent="up" />);

    expect(screen.getByText("+2.4%")).toHaveClass("text-emerald-500");
  });

  it("applies down accent color", () => {
    render(<StatCard label="1M" value="-1.1%" accent="down" />);

    expect(screen.getByText("-1.1%")).toHaveClass("text-red-500");
  });

  it("defaults to neutral (primary) accent", () => {
    render(<StatCard label="Market Cap" value="$2.1T" />);

    expect(screen.getByText("$2.1T")).toHaveClass("text-primary");
  });

  it("applies explicit neutral accent", () => {
    render(<StatCard label="Shares Out" value="15B" accent="neutral" />);

    expect(screen.getByText("15B")).toHaveClass("text-primary");
  });

  it("forwards data-testid and className", () => {
    const { container } = render(<StatCard label="YTD" value="+12%" className="custom-stat" data-testid="performance-stat" />);

    expect(screen.getByTestId("performance-stat")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-stat");
  });
});
