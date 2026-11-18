import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Activity } from "lucide-react";
import SummaryStat from "./SummaryStat.tsx";

describe("SummaryStat", () => {
  it("renders label and value", () => {
    render(<SummaryStat label="Queues" value="3" icon={<Activity data-testid="stat-icon" />} />);

    expect(screen.getByText("Queues")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByTestId("stat-icon")).toBeInTheDocument();
  });

  it("renders optional subtitle", () => {
    render(<SummaryStat label="Tasks" value="5" sub="2 running" icon={<Activity />} />);

    expect(screen.getByText("2 running")).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    const { container } = render(<SummaryStat label="Pending" value="12" icon={<Activity />} />);

    expect(container.querySelector("p")).toBeNull();
  });

  it("applies accent class to the icon", () => {
    const { container } = render(<SummaryStat label="Running" value="2" icon={<Activity />} accentClass="text-amber-500" />);

    const iconWrap = container.querySelector(".text-amber-500");
    expect(iconWrap).not.toBeNull();
  });

  it("colors the value when icon is right-aligned", () => {
    const { container } = render(<SummaryStat label="Results" value="9" icon={<Activity />} accentClass="text-violet-500" iconPosition="right" size="lg" />);

    const value = screen.getByText("9");
    expect(value).toHaveClass("text-violet-500");
    expect(container.firstChild).toHaveClass("px-4", "py-3.5");
  });

  it("keeps primary value color when icon is left-aligned", () => {
    render(<SummaryStat label="Bots" value="4" icon={<Activity />} accentClass="text-teal-500" iconPosition="left" />);

    expect(screen.getByText("4")).toHaveClass("text-primary");
  });

  it("applies sm size styles", () => {
    const { container } = render(<SummaryStat label="Services" value="1" icon={<Activity />} size="sm" />);

    expect(container.firstChild).toHaveClass("px-3", "py-2.5");
    expect(screen.getByText("1")).toHaveClass("text-base");
  });

  it("forwards data-testid and className", () => {
    const { container } = render(<SummaryStat label="Cost" value="$1.00" icon={<Activity />} className="custom-stat" data-testid="metrics-summary-stat" />);

    expect(screen.getByTestId("metrics-summary-stat")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-stat");
  });
});
