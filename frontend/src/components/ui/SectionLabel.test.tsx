import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import SectionLabel from "./SectionLabel.tsx";

describe("SectionLabel", () => {
  it("renders one spelling of the uppercase group heading", () => {
    render(<SectionLabel>Running</SectionLabel>);
    const label = screen.getByText("Running");
    expect(label.className).toContain("uppercase");
    expect(label.className).toContain("tracking-widest");
    expect(label.className).toContain("font-bold");
  });

  it("supports the warning and accent tones that were colour-forked by hand", () => {
    render(<SectionLabel tone="warning">Unsaved</SectionLabel>);
    expect(screen.getByText("Unsaved").className).toContain("text-amber-600");
  });

  it("renders trailing meta", () => {
    render(<SectionLabel meta={3}>Sessions</SectionLabel>);
    expect(screen.getByText("3")).toBeInTheDocument();
  });
});
