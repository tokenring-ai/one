import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import EditorSaveBar from "./EditorSaveBar.tsx";

describe("EditorSaveBar", () => {
  it("shows Save label when dirty with an existing item", () => {
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Save" })).toHaveAttribute("title", "Save (Ctrl/⌘+S)");
  });

  it("shows Saved label and disables save when clean with an existing item", () => {
    render(<EditorSaveBar isDirty={false} isSaving={false} hasItem onSave={() => {}} />);

    const saveButton = screen.getByRole("button", { name: "Saved" });
    expect(saveButton).toBeDisabled();
  });

  it("shows Save… label for drafts", () => {
    render(<EditorSaveBar isDirty={false} isSaving={false} hasItem={false} onSave={() => {}} />);

    const saveButton = screen.getByRole("button", { name: "Save…" });
    expect(saveButton).not.toBeDisabled();
    expect(saveButton).toHaveAttribute("title", "Save…");
  });

  it("shows the dirty indicator when isDirty is true", () => {
    const { container } = render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} />);

    const dot = container.querySelector(".bg-amber-400");
    expect(dot).toBeTruthy();
    expect(dot).toHaveAttribute("title", "Unsaved changes");
  });

  it("hides the dirty indicator when isDirty is false", () => {
    const { container } = render(<EditorSaveBar isDirty={false} isSaving={false} hasItem onSave={() => {}} />);

    expect(container.querySelector(".bg-amber-400")).toBeNull();
  });

  it("disables save and shows spinner while saving", () => {
    const { container } = render(<EditorSaveBar isDirty isSaving hasItem onSave={() => {}} />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
    expect(container.querySelector(".animate-spin")).toBeTruthy();
  });

  it("disables save when disabled prop is set", () => {
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} disabled />);

    expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  });

  it("invokes onSave when save is clicked", async () => {
    const onSave = mock(() => {});
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={onSave} />);

    await userEvent.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it("renders Save As only when hasItem and onSaveAs are set", () => {
    const { rerender } = render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} />);

    expect(screen.queryByRole("button", { name: "Save As…" })).toBeNull();

    const onSaveAs = mock(() => {});
    rerender(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} onSaveAs={onSaveAs} />);

    expect(screen.getByRole("button", { name: "Save As…" })).toBeInTheDocument();
  });

  it("does not render Save As when hasItem is false even if onSaveAs is provided", () => {
    render(<EditorSaveBar isDirty={false} isSaving={false} hasItem={false} onSave={() => {}} onSaveAs={() => {}} />);

    expect(screen.queryByRole("button", { name: "Save As…" })).toBeNull();
  });

  it("invokes onSaveAs when Save As is clicked", async () => {
    const onSaveAs = mock(() => {});
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} onSaveAs={onSaveAs} />);

    await userEvent.click(screen.getByRole("button", { name: "Save As…" }));

    expect(onSaveAs).toHaveBeenCalledTimes(1);
  });

  it("renders trailing actions after save controls", () => {
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} onSaveAs={() => {}} actions={<button type="button">Delete</button>} />);

    const buttons = screen.getAllByRole("button");
    expect(buttons.map(b => b.textContent)).toEqual(["Save", "Save As…", "Delete"]);
  });

  it("applies the accent variant classes", () => {
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} variant="accent" />);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("bg-accent");
  });

  it("applies the subtle variant by default", () => {
    render(<EditorSaveBar isDirty isSaving={false} hasItem onSave={() => {}} />);

    expect(screen.getByRole("button", { name: "Save" })).toHaveClass("text-muted");
    expect(screen.getByRole("button", { name: "Save" })).not.toHaveClass("bg-accent");
  });

  it("supports custom labels and tooltips", () => {
    render(
      <EditorSaveBar
        isDirty
        isSaving={false}
        hasItem
        onSave={() => {}}
        onSaveAs={() => {}}
        saveLabel="Write"
        saveTooltip="Write (Ctrl+S)"
        saveAsLabel="Write As…"
      />,
    );

    expect(screen.getByRole("button", { name: "Write" })).toHaveAttribute("title", "Write (Ctrl+S)");
    expect(screen.getByRole("button", { name: "Write As…" })).toBeInTheDocument();
  });
});
