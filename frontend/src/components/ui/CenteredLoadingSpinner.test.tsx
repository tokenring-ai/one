import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import CenteredLoadingSpinner from "./CenteredLoadingSpinner.tsx";

describe("CenteredLoadingSpinner", () => {
  it("renders a status region with a default aria-label", () => {
    render(<CenteredLoadingSpinner />);

    expect(screen.getByRole("status", { name: "Loading" })).toBeInTheDocument();
  });

  it("renders an optional message and omits the default aria-label", () => {
    render(<CenteredLoadingSpinner message="Starting Media…" />);

    const status = screen.getByRole("status");
    expect(status).not.toHaveAttribute("aria-label");
    expect(screen.getByText("Starting Media…")).toBeInTheDocument();
  });

  it("applies flex-1 when fill is true", () => {
    const { container } = render(<CenteredLoadingSpinner fill />);

    expect(container.firstChild).toHaveClass("flex-1");
  });

  it("does not apply flex-1 by default", () => {
    const { container } = render(<CenteredLoadingSpinner />);

    expect(container.firstChild).not.toHaveClass("flex-1");
  });

  it("maps size tokens to spinner classes", () => {
    const { container, rerender } = render(<CenteredLoadingSpinner size="sm" />);
    expect(container.querySelector("svg")).toHaveClass("w-4", "h-4");

    rerender(<CenteredLoadingSpinner size="md" />);
    expect(container.querySelector("svg")).toHaveClass("w-6", "h-6");

    rerender(<CenteredLoadingSpinner size="lg" />);
    expect(container.querySelector("svg")).toHaveClass("w-8", "h-8");
  });

  it("defaults to md spinner size", () => {
    const { container } = render(<CenteredLoadingSpinner />);

    expect(container.querySelector("svg")).toHaveClass("w-6", "h-6");
  });

  it("merges className onto the container", () => {
    const { container } = render(<CenteredLoadingSpinner className="h-full absolute inset-0" data-testid="spinner" />);

    expect(screen.getByTestId("spinner")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("h-full", "absolute", "inset-0");
  });
});
