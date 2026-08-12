import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Plus, Send } from "lucide-react";
import FormActionBar from "./FormActionBar.tsx";

describe("FormActionBar", () => {
  it("renders cancel and submit labels", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Save" />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
  });

  it("uses a custom cancel label", () => {
    render(<FormActionBar cancelLabel="Discard" onCancel={() => {}} submitLabel="Save" />);

    expect(screen.getByRole("button", { name: "Discard" })).toBeInTheDocument();
  });

  it("invokes onCancel when cancel is clicked", async () => {
    const onCancel = mock(() => {});
    render(<FormActionBar onCancel={onCancel} submitLabel="Save" />);

    await userEvent.click(screen.getByRole("button", { name: "Cancel" }));

    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables submit while loading and shows a spinner", () => {
    const { container } = render(<FormActionBar onCancel={() => {}} submitLabel="Send" submitIcon={Send} loading />);

    expect(screen.getByRole("button", { name: /send/i })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("disables cancel while loading by default", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Save" loading />);

    expect(screen.getByRole("button", { name: "Cancel" })).toBeDisabled();
  });

  it("keeps cancel enabled when cancelDisabled is false during loading", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Save" loading cancelDisabled={false} />);

    expect(screen.getByRole("button", { name: "Cancel" })).not.toBeDisabled();
  });

  it("disables submit when disabled is set", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Create" disabled />);

    expect(screen.getByRole("button", { name: "Create" })).toBeDisabled();
  });

  it("renders additional actions between cancel and submit", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Save" actions={<button type="button">Draft</button>} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map(b => b.textContent)).toEqual(["Cancel", "Draft", "Save"]);
  });

  it("applies separated chrome when separated is true", () => {
    const { container } = render(<FormActionBar onCancel={() => {}} submitLabel="Send" separated data-testid="bar" />);

    expect(screen.getByTestId("bar")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("border-t", "bg-secondary");
  });

  it("uses type=submit for the primary button", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Add" submitIcon={Plus} />);

    expect(screen.getByRole("button", { name: /add/i })).toHaveAttribute("type", "submit");
  });

  it("applies the variant color class", () => {
    render(<FormActionBar onCancel={() => {}} submitLabel="Send" variant="red" />);

    expect(screen.getByRole("button", { name: "Send" })).toHaveClass("bg-red-600");
  });
});
