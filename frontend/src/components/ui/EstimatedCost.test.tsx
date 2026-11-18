import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import EstimatedCost from "./EstimatedCost.tsx";

describe("EstimatedCost", () => {
  it("shows the estimate", () => {
    render(<EstimatedCost estimate={{ status: "ready", amountUsd: 0.04 }} />);
    expect(screen.getByTestId("estimated-cost")).toHaveTextContent("about $0.04");
  });

  it("says when the price is not available, and while loading", () => {
    const { rerender } = render(<EstimatedCost estimate={{ status: "unavailable" }} />);
    expect(screen.getByTestId("estimated-cost")).toHaveTextContent("price not available");
    rerender(<EstimatedCost estimate={{ status: "loading" }} />);
    expect(screen.getByTestId("estimated-cost")).toHaveTextContent("Estimating price");
  });

  it("renders nothing when idle or on error", () => {
    const { rerender } = render(<EstimatedCost estimate={{ status: "error" }} />);
    expect(screen.queryByTestId("estimated-cost")).not.toBeInTheDocument();
    rerender(<EstimatedCost estimate={{ status: "idle" }} />);
    expect(screen.queryByTestId("estimated-cost")).not.toBeInTheDocument();
  });
});
