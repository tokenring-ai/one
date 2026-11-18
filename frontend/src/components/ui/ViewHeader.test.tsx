import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Box, RefreshCw } from "lucide-react";
import { getDashboardManifestById } from "../../shell/appCatalog.ts";
import ViewHeader from "./ViewHeader.tsx";

describe("ViewHeader", () => {
  it("takes its icon and gradient from the dashboard manifest", () => {
    const manifest = getDashboardManifestById("settings")!;
    render(<ViewHeader title="Settings" dashboardId="settings" />);
    const badge = screen.getByText("Settings").parentElement!.previousElementSibling!;
    // Hardcoding the gradient at the call site is how three headers drifted away
    // from the rail entry for the same dashboard.
    expect(badge.className).toContain(manifest.gradient);
  });

  it("prefers an explicit icon and gradient over the manifest", () => {
    render(<ViewHeader title="Custom" icon={Box} iconGradient="from-red-500 to-rose-600" dashboardId="settings" />);
    const badge = screen.getByText("Custom").parentElement!.previousElementSibling!;
    expect(badge.className).toContain("from-red-500");
  });

  it("renders actions as labelled buttons", async () => {
    const onClick = mock(() => {});
    render(<ViewHeader title="Panel" icon={Box} actions={[{ icon: <RefreshCw />, label: "Refresh", onClick }]} />);
    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    expect(onClick).toHaveBeenCalled();
  });

  it("renders the navigator variant as a compact, content-hugging row", () => {
    const { container } = render(<ViewHeader variant="navigator" title="Terminals" />);
    const root = container.firstElementChild!;
    // NOT a fixed height, and shorter than the panel variant: the dock tab above
    // is the panel's title bar, so this row must stay subordinate to it.
    expect(root.className).not.toContain("h-11");
    expect(root.className).toContain("py-1.5");
    expect(screen.getByText("Terminals").className).not.toContain("uppercase");
  });

  it("is quieter than SectionLabel, which is the heading inside a panel", () => {
    render(<ViewHeader variant="navigator" title="Terminals" />);
    const label = screen.getByText("Terminals");
    // Two adjacent `font-bold uppercase tracking-widest` labels read as having no
    // hierarchy at all, which is what made the sidebars look wrong.
    expect(label.className).toContain("font-medium");
    expect(label.className).not.toContain("tracking-widest");
  });

  it("renders an actions-only row when the dock tab already names the panel", () => {
    const onClick = mock(() => {});
    const { container } = render(<ViewHeader variant="navigator" actions={[{ icon: <RefreshCw />, label: "Refresh", onClick }]} />);
    expect(screen.getByRole("button", { name: "Refresh" })).toBeInTheDocument();
    // No title element, so nothing repeats the tab.
    expect(container.textContent).toBe("");
  });

  it("keeps the panel variant at a fixed height", () => {
    const panel = render(<ViewHeader title="A" icon={Box} />).container.firstElementChild!;
    expect(panel.className).toContain("h-11");
  });
});
