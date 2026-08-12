import { describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import SaveAsModal, { type SaveAsField } from "./SaveAsModal.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const VALIDATION_ERROR = "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.";

function makeField(overrides: Partial<SaveAsField> = {}): SaveAsField {
  return {
    label: "Topic",
    placeholder: "solid-state-batteries",
    initialValue: "",
    pattern: NAME_PATTERN,
    validationError: VALIDATION_ERROR,
    options: [],
    ...overrides,
  };
}

function renderModal(overrides: Partial<Parameters<typeof SaveAsModal>[0]> = {}) {
  const props = {
    title: "Save Research Item",
    containerField: makeField({
      label: "Topic",
      placeholder: "solid-state-batteries",
      options: [{ value: "batteries", label: "Batteries" }, { value: "chips" }],
    }),
    itemField: makeField({
      label: "Item name",
      placeholder: "summary",
      autoFocus: true,
      selectOnFocus: true,
    }),
    onSave: mock(async () => {}),
    onClose: mock(() => {}),
    ...overrides,
  };
  return { ...render(<SaveAsModal {...props} />), props };
}

describe("SaveAsModal", () => {
  it("renders title, both fields, Save and Cancel buttons", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "Save Research Item" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("solid-state-batteries")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("summary")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables Save until both fields match their patterns", async () => {
    renderModal();

    const saveBtn = screen.getByRole("button", { name: /save/i });
    expect(saveBtn).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "bad name!");
    await userEvent.type(screen.getByPlaceholderText("summary"), "ok-item");
    expect(saveBtn).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(VALIDATION_ERROR);

    await userEvent.clear(screen.getByPlaceholderText("solid-state-batteries"));
    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "valid-topic");
    expect(saveBtn).not.toBeDisabled();
  });

  it("invokes onSave with trimmed field values", async () => {
    const onSave = mock(async () => {});
    renderModal({ onSave });

    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "  my-topic  ");
    await userEvent.type(screen.getByPlaceholderText("summary"), "  my-item  ");
    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledTimes(1);
      expect(onSave).toHaveBeenCalledWith("my-topic", "my-item");
    });
  });

  it("submits on Enter when both fields are valid", async () => {
    const onSave = mock(async () => {});
    renderModal({
      onSave,
      containerField: makeField({
        label: "Topic",
        placeholder: "solid-state-batteries",
        initialValue: "existing-topic",
        options: [{ value: "existing-topic" }],
      }),
    });

    const itemInput = screen.getByPlaceholderText("summary");
    await userEvent.clear(itemInput);
    await userEvent.type(itemInput, "enter-item{Enter}");

    await waitFor(() => {
      expect(onSave).toHaveBeenCalledWith("existing-topic", "enter-item");
    });
  });

  it("invokes onClose when Cancel is clicked", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the X button is clicked", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape when not saving", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables controls while onSave is in flight", async () => {
    let resolveSave!: () => void;
    const onSave = mock(
      () =>
        new Promise<void>(resolve => {
          resolveSave = resolve;
        }),
    );

    renderModal({
      onSave,
      containerField: makeField({
        label: "Topic",
        placeholder: "solid-state-batteries",
        initialValue: "topic-a",
        options: [{ value: "topic-a" }],
      }),
      itemField: makeField({
        label: "Item name",
        placeholder: "summary",
        initialValue: "item-a",
        autoFocus: true,
        selectOnFocus: true,
      }),
    });

    await userEvent.click(screen.getByRole("button", { name: /save/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    resolveSave();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /save/i })).not.toBeDisabled();
    });
  });

  it("uses a custom save label", () => {
    renderModal({ saveLabel: "Save Item" });
    expect(screen.getByRole("button", { name: /save item/i })).toBeInTheDocument();
  });

  it("renders datalist options for the container field", () => {
    const { container } = renderModal();
    const options = container.querySelectorAll("datalist option");
    expect(options.length).toBe(2);
    expect(options[0]?.getAttribute("value")).toBe("batteries");
    expect(options[1]?.getAttribute("value")).toBe("chips");
  });
});
