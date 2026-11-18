import { afterEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import { CONFIRM_SKIPS_KEY } from "../../lib/uiPreferences.ts";
import ConfirmModal from "./ConfirmModal.tsx";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

describe("ConfirmModal", () => {
  afterEach(() => {
    localStorage.clear();
  });

  it("renders title, message, and default Delete confirm label", () => {
    render(<ConfirmModal title="Delete item?" message="This cannot be undone." onConfirm={() => {}} onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Delete item?" })).toBeInTheDocument();
    expect(screen.getByText("This cannot be undone.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
  });

  it("uses a custom confirm label and warning variant without a trash icon", () => {
    render(
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
    expect(confirmBtn).toHaveAttribute("data-variant", "warning");
  });

  it("supports custom cancel label and info variant", () => {
    render(
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
    expect(screen.getByRole("button", { name: /^reset$/i })).toHaveAttribute("data-variant", "primary");
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

  it("shows a Don't ask again checkbox by default", () => {
    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={() => {}} />);
    expect(screen.getByRole("checkbox", { name: /don't ask again/i })).toBeInTheDocument();
  });

  it("hides Don't ask again when showDontAskAgain is false", () => {
    render(<ConfirmModal title="Delete?" message="Sure?" onConfirm={() => {}} onClose={() => {}} showDontAskAgain={false} />);
    expect(screen.queryByRole("checkbox", { name: /don't ask again/i })).toBeNull();
  });

  it("persists Don't ask again under the title key after a successful confirm", async () => {
    render(<ConfirmModal title="Delete item?" message="Sure?" onConfirm={() => {}} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({ "Delete item?": true });
    });
  });

  it("does not persist Don't ask again when the user cancels", async () => {
    render(<ConfirmModal title="Delete item?" message="Sure?" onConfirm={() => {}} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));

    expect(localStorage.getItem(CONFIRM_SKIPS_KEY)).toBeNull();
  });

  it("persists under a custom dontAskAgainKey", async () => {
    render(<ConfirmModal title="Delete?" message="Sure?" dontAskAgainKey="files-delete" onConfirm={() => {}} onClose={() => {}} />);

    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({ "files-delete": true });
    });
  });

  it("keeps skip flags separate when the same title uses different dontAskAgainKeys", async () => {
    const { unmount } = render(
      <ConfirmModal title="Delete item" message="Sure?" dontAskAgainKey="checkpoints:delete" onConfirm={() => {}} onClose={() => {}} />,
    );

    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({ "checkpoints:delete": true });
    });

    unmount();

    render(<ConfirmModal title="Delete item" message="Sure?" dontAskAgainKey="flows:delete" onConfirm={() => {}} onClose={() => {}} />);
    await userEvent.click(screen.getByRole("checkbox", { name: /don't ask again/i }));
    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(CONFIRM_SKIPS_KEY) ?? "{}")).toEqual({ "checkpoints:delete": true, "flows:delete": true });
    });
  });
});
