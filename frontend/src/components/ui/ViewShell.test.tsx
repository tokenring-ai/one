import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import ViewShell from "./ViewShell.tsx";

describe("ViewShell", () => {
  it("scrolls the body and keeps header and footer fixed", () => {
    render(
      <ViewShell header={<div data-testid="head">head</div>} footer={<div data-testid="foot">foot</div>} data-testid="shell">
        <p>body</p>
      </ViewShell>,
    );
    expect(screen.getByTestId("head")).toBeInTheDocument();
    expect(screen.getByTestId("foot")).toBeInTheDocument();
    const body = screen.getByText("body").parentElement!;
    expect(body.className).toContain("overflow-y-auto");
    expect(body.className).toContain("min-h-0");
  });

  it("hands scrolling to the child when asked, as a flex column", () => {
    render(
      <ViewShell scroll={false}>
        <p>body</p>
      </ViewShell>,
    );
    const body = screen.getByText("body").parentElement!;
    expect(body.className).toContain("overflow-hidden");
    expect(body.className).not.toContain("overflow-y-auto");
    // A child that scrolls itself sizes with `flex-1`, so the body must be a column.
    expect(body.className).toContain("flex flex-col");
  });

  it("paints the sidebar tone instead of leaving each view to repaint it", () => {
    render(
      <ViewShell tone="sidebar" data-testid="shell">
        <p>body</p>
      </ViewShell>,
    );
    expect(screen.getByTestId("shell").className).toContain("bg-secondary");
  });

  it("centres a clamped width", () => {
    render(
      <ViewShell width="prose">
        <p>body</p>
      </ViewShell>,
    );
    // The clamp that used to be written by hand, once without `mx-auto`.
    const clamp = screen.getByText("body").parentElement!;
    expect(clamp.className).toContain("max-w-3xl");
    expect(clamp.className).toContain("mx-auto");
  });

  it("does not wrap the children when the width is full", () => {
    render(
      <ViewShell pad="page">
        <p>body</p>
      </ViewShell>,
    );
    const body = screen.getByText("body").parentElement!;
    expect(body.className).toContain("px-4");
  });
});
