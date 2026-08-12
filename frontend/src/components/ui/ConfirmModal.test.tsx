import { describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ConfirmModal from "./ConfirmModal.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

describe("ConfirmModal", () => {
  it("renders title, message, and default Delete confirm label", () => {
    render(<ConfirmModal title="Delete item?" message="This cannot be undone." onConfirm={() => {}} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Delete item?" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses a custom confirm label and warning variant without a trash icon", () => {
    const { container } = render(
      <ConfirmModal
        title="Discard changes?"
        message="Unsaved edits will be lost."
        confirmLabel="Discard"
        variant="warning"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /discard/i })).toBeInTheDocument();
    // warning default has no leading icon; only the label text is present
    const confirmBtn = screen.getByRole("button", { name: /discard/i });
    expect(confirmBtn.querySelector("svg")).toBeNull();
    expect(container.querySelector(".bg-amber-600")).toBeTruthy();
  });

  it("supports custom cancel label and info variant", () => {
    const { container } = render(
      <ConfirmModal
        title="Reset layout?"
        message="Pinned apps return to defaults."
        confirmLabel="Reset"
        cancelLabel="Keep"
        variant="info"
        onConfirm={() => {}}
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /^reset$/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^keep$/i })).toBeInTheDocument();
    expect(container.querySelector(".bg-accent")).toBeTruthy();
  });

  it("invokes onClose when Cancel is clicked", async () => {
    const onClose = mock(() => {});
    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onConfirm when confirm is clicked", async () => {
    const onConfirm = mock(() => {});
    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={onConfirm} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("disables buttons while onConfirm is in flight", async () => {
    let resolveConfirm!: () => void;
    const onConfirm = mock(
      () =>
        new Promise<void>(resolve => {
          resolveConfirm = resolve;
        }),
    );

    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={onConfirm} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /cancel/i })).toBeDisabled();
    });

    resolveConfirm();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).not.toBeDisabled();
    });
  });

  it("dismisses on Escape when not confirming", async () => {
    const onClose = mock(() => {});
    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not dismiss on backdrop click by default", async () => {
    const onClose = mock(() => {});
    const { container } = render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={onClose} />);

    // outer overlay is the backdrop
    const backdrop = container.firstElementChild as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClose).not.toHaveBeenCalled();
  });

  it("dismisses on backdrop click when closeOnBackdrop is true", async () => {
    const onClose = mock(() => {});
    const { container } = render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={onClose} closeOnBackdrop />);

    const backdrop = container.firstElementChild as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
