import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Code2, Eye, Pencil } from "lucide-react";
import ViewModeToggle, { type ViewModeOption } from "./ViewModeToggle.tsx";

const previewEditOptions: ViewModeOption<"preview" | "edit">[] = [
  { value: "preview", label: "Preview", title: "Preview markdown", icon: Eye },
  { value: "edit", label: "Edit", title: "Edit markdown source", icon: Pencil },
];

describe("ViewModeToggle", () => {
  it("renders all options with labels and aria-label", () => {
    render(<ViewModeToggle options={previewEditOptions} value="preview" onChange={() => {}} aria-label="View mode" />);

    expect(screen.getByRole("group", { name: "View mode" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Preview/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
  });

  it("marks the active option with aria-pressed", () => {
    render(<ViewModeToggle options={previewEditOptions} value="preview" onChange={() => {}} aria-label="View mode" />);

    expect(screen.getByRole("button", { name: /Preview/i })).toHaveAttribute("aria-pressed", "true");
    expect(screen.getByRole("button", { name: /Edit/i })).toHaveAttribute("aria-pressed", "false");
  });

  it("calls onChange with the selected value", async () => {
    const onChange = mock(() => {});
    render(<ViewModeToggle options={previewEditOptions} value="preview" onChange={onChange} aria-label="View mode" />);

    await userEvent.click(screen.getByRole("button", { name: /Edit/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith("edit");
  });

  it("applies title tooltips on each option", () => {
    render(<ViewModeToggle options={previewEditOptions} value="preview" onChange={() => {}} aria-label="View mode" />);

    expect(screen.getByRole("button", { name: /Preview/i })).toHaveAttribute("title", "Preview markdown");
    expect(screen.getByRole("button", { name: /Edit/i })).toHaveAttribute("title", "Edit markdown source");
  });

  it("supports per-option hiddenClassname", () => {
    const options: ViewModeOption<"split" | "code">[] = [
      { value: "split", label: "Split", title: "Show code and preview", icon: Code2, hiddenClassname: "hidden md:flex" },
      { value: "code", label: "Code", title: "Show code only", icon: Code2 },
    ];

    render(<ViewModeToggle options={options} value="code" onChange={() => {}} aria-label="Code and preview view" />);

    expect(screen.getByRole("button", { name: /Split/i })).toHaveClass("hidden", "md:flex");
    expect(screen.getByRole("button", { name: /Code/i })).toHaveClass("flex");
  });

  it("merges className onto the container", () => {
    const { container } = render(<ViewModeToggle options={previewEditOptions} value="preview" onChange={() => {}} aria-label="View mode" className="ml-2" />);

    expect(container.firstChild).toHaveClass("ml-2");
    expect(container.firstChild).toHaveClass("rounded-lg");
  });
});
