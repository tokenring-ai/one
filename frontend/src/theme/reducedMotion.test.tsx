import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { render, screen } from "@testing-library/react";
import BusySpinner from "../components/ui/BusySpinner.tsx";
import CenteredLoadingSpinner from "../components/ui/CenteredLoadingSpinner.tsx";
import LoadingState from "../components/ui/LoadingState.tsx";
import Button from "../ui/button.tsx";

const css = readFileSync(join(import.meta.dir, "..", "index.css"), "utf8");

const OFF = ["animation: none !important", "transition: none !important", "scroll-behavior: auto !important"];

describe("reduced motion stylesheet", () => {
  it("turns animation, transitions and smooth scrolling off under prefers-reduced-motion", () => {
    const start = css.indexOf("@media (prefers-reduced-motion: reduce)");
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("\n}\n", start));
    for (const rule of OFF) expect(block).toContain(rule);
  });

  it("honours an explicit data-motion=reduce on <html> with the same rules", () => {
    const start = css.indexOf(':root[data-motion="reduce"] *,');
    expect(start).toBeGreaterThan(-1);
    const block = css.slice(start, css.indexOf("\n}\n", start));
    for (const rule of OFF) expect(block).toContain(rule);
  });
});

describe("busy indicators without motion", () => {
  it("name the busy state in text or attributes, not by spinning", () => {
    render(
      <>
        <BusySpinner label="Agent working" />
        <LoadingState />
        <LoadingState message="Loading agents" />
        <CenteredLoadingSpinner />
        <Button busy busyLabel="Saving…">
          Save
        </Button>
      </>,
    );
    expect(screen.getByRole("status", { name: "Agent working" })).toBeInTheDocument();
    expect(screen.getAllByRole("status", { name: "Loading" })).toHaveLength(2);
    expect(screen.getByText("Loading agents").closest("[role=status]")).not.toBeNull();
    const button = screen.getByRole("button", { name: "Saving…" });
    expect(button).toHaveAttribute("aria-busy", "true");
    // The spinning glyphs themselves are decorative.
    for (const glyph of document.querySelectorAll(".animate-spin")) {
      expect(glyph.closest("[role=status], [aria-busy=true]")).not.toBeNull();
      if (glyph.tagName.toLowerCase() === "svg") expect(glyph).toHaveAttribute("aria-hidden", "true");
    }
  });
});
