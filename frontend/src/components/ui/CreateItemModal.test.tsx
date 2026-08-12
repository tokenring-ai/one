import { describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import CreateItemModal from "./CreateItemModal.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const NAME_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9_-]*$/;
const VALIDATION_ERROR = "Use letters, numbers, hyphens, and underscores only, starting with a letter or number.";

function renderModal(overrides: Partial<Parameters<typeof CreateItemModal>[0]> = {}) {
  const props = {
    title: "New Topic",
    placeholder: "solid-state-batteries",
    pattern: NAME_PATTERN,
    validationError: VALIDATION_ERROR,
    onCreate: mock(async () => {}),
    onClose: mock(() => {}),
    ...overrides,
  };
  return { ...render(<CreateItemModal {...props} />), props };
}

describe("CreateItemModal", () => {
  it("renders title, input, Create and Cancel buttons", () => {
    renderModal();

    expect(screen.getByRole("dialog", { name: "New Topic" })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("solid-state-batteries")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /create/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("disables Create until the name matches the pattern", async () => {
    renderModal();

    const createBtn = screen.getByRole("button", { name: /create/i });
    expect(createBtn).toBeDisabled();

    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "bad name!");
    expect(createBtn).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(VALIDATION_ERROR);

    await userEvent.clear(screen.getByPlaceholderText("solid-state-batteries"));
    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "valid-name");
    expect(createBtn).not.toBeDisabled();
    expect(screen.queryByRole("alert")).toBeNull();
  });

  it("invokes onCreate with the trimmed name", async () => {
    const onCreate = mock(async () => {});
    renderModal({ onCreate });

    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "  my-topic  ");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledTimes(1);
      expect(onCreate).toHaveBeenCalledWith("my-topic");
    });
  });

  it("submits on Enter when valid", async () => {
    const onCreate = mock(async () => {});
    renderModal({ onCreate });

    const input = screen.getByPlaceholderText("solid-state-batteries");
    await userEvent.type(input, "enter-topic{Enter}");

    await waitFor(() => {
      expect(onCreate).toHaveBeenCalledWith("enter-topic");
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

  it("dismisses on Escape when not creating", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("disables controls while onCreate is in flight", async () => {
    let resolveCreate!: () => void;
    const onCreate = mock(
      () =>
        new Promise<void>(resolve => {
          resolveCreate = resolve;
        }),
    );

    renderModal({ onCreate });

    await userEvent.type(screen.getByPlaceholderText("solid-state-batteries"), "loading-item");
    await userEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    resolveCreate();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /create/i })).not.toBeDisabled();
    });
  });

  it("uses a custom create label and initial value", () => {
    renderModal({ createLabel: "Add Topic", initialValue: "prefilled" });

    expect(screen.getByRole("button", { name: /add topic/i })).toBeInTheDocument();
    expect(screen.getByDisplayValue("prefilled")).toBeInTheDocument();
  });
});
