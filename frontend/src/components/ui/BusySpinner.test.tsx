import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import BusySpinner from "./BusySpinner.tsx";

describe("BusySpinner", () => {
  it("is decorative unless given a label", () => {
    const { container } = render(<BusySpinner />);
    expect(container.firstElementChild).toHaveAttribute("aria-hidden", "true");
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("announces itself when labelled", () => {
    render(<BusySpinner label="Agent working" />);
    expect(screen.getByRole("status")).toHaveAttribute("aria-label", "Agent working");
  });
});
