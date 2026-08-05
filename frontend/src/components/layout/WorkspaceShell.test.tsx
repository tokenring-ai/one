import { beforeEach, describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import WorkspaceShell from "./WorkspaceShell.tsx";

function renderShell(hasSelection = true) {
  return render(
    <MemoryRouter>
      <WorkspaceShell appId="test" title="Test app" navigationLabel="Test resources" hasSelection={hasSelection} navigation={<div>Only navigation copy</div>}>
        <div>Main workspace</div>
      </WorkspaceShell>
    </MemoryRouter>,
  );
}

describe("WorkspaceShell", () => {
  beforeEach(() => localStorage.clear());

  it("renders one navigation tree and an accessible desktop separator", () => {
    renderShell();
    expect(screen.getAllByText("Only navigation copy")).toHaveLength(1);
    const separator = screen.getByRole("separator", { name: "Resize Test resources" });
    expect(separator).toHaveAttribute("aria-valuemin", "220");
    expect(separator).toHaveAttribute("aria-valuemax", "380");
    expect(separator).toHaveAttribute("aria-valuenow", "280");
  });

  it("resizes and collapses the navigator by keyboard", async () => {
    const user = userEvent.setup();
    renderShell();
    const separator = screen.getByRole("separator", { name: "Resize Test resources" });
    separator.focus();
    await user.keyboard("{ArrowRight}");
    expect(separator).toHaveAttribute("aria-valuenow", "288");

    await user.click(screen.getByRole("button", { name: "Hide Test resources" }));
    expect(screen.queryByRole("separator", { name: "Resize Test resources" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Show Test resources" })).toBeInTheDocument();
  });

  it("uses the same navigator as a mobile master screen", async () => {
    const user = userEvent.setup();
    const { rerender } = renderShell(false);
    const navigation = screen.getByLabelText("Test resources");
    expect(navigation).toHaveClass("flex");

    rerender(
      <MemoryRouter>
        <WorkspaceShell appId="test" title="Test app" navigationLabel="Test resources" hasSelection navigation={<div>Only navigation copy</div>}>
          <div>Main workspace</div>
        </WorkspaceShell>
      </MemoryRouter>,
    );
    expect(navigation).toHaveClass("hidden");
    await user.click(screen.getByRole("button", { name: "Browse" }));
    expect(navigation).toHaveClass("flex");
  });
});
