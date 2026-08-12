import { describe, expect, it, mock, spyOn } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Calendar, CalendarDays, MapPin } from "lucide-react";
import DetailModal from "./DetailModal.tsx";

describe("DetailModal", () => {
  it("renders title, metadata, and description", () => {
    render(
      <DetailModal
        icon={Calendar}
        title="Team standup"
        metadata={[
          { icon: CalendarDays, value: "2026-08-09 · 09:00 – 09:30" },
          { label: "Provider", value: "google" },
          { icon: MapPin, value: "Room A" },
        ]}
        description="Weekly sync"
        onClose={() => {}}
      />,
    );

    expect(screen.getByRole("dialog", { name: "Team standup" })).toBeInTheDocument();
    expect(screen.getByText("2026-08-09 · 09:00 – 09:30")).toBeInTheDocument();
    expect(screen.getByText(/Provider:\s*google/)).toBeInTheDocument();
    expect(screen.getByText("Room A")).toBeInTheDocument();
    expect(screen.getByText("Weekly sync")).toBeInTheDocument();
  });

  it("always shows Close and only optional action buttons when handlers are provided", () => {
    const { rerender } = render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={() => {}} />);

    // Footer Close text + header X (aria-label Close)
    expect(screen.getByText("Close")).toBeInTheDocument();
    expect(screen.getByLabelText("Close")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /delete/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /edit/i })).not.toBeInTheDocument();

    rerender(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={() => {}} onEdit={() => {}} onDestructive={() => {}} />);

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /edit/i })).toBeInTheDocument();
  });

  it("invokes onClose from the Close button and X control", async () => {
    const onClose = mock(() => {});
    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={onClose} />);

    await userEvent.click(screen.getByText("Close"));
    expect(onClose).toHaveBeenCalledTimes(1);

    await userEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("closes on backdrop click when not busy", async () => {
    const onClose = mock(() => {});
    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={onClose} />);

    await userEvent.click(screen.getByTestId("detail-modal-backdrop"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when clicking inside the dialog content", async () => {
    const onClose = mock(() => {});
    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={onClose} />);

    await userEvent.click(screen.getByRole("dialog"));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invokes onEdit when Edit is clicked", async () => {
    const onEdit = mock(() => {});
    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={() => {}} onEdit={onEdit} />);

    await userEvent.click(screen.getByRole("button", { name: /edit/i }));
    expect(onEdit).toHaveBeenCalledTimes(1);
  });

  it("confirms before destructive action when message is set", async () => {
    const onDestructive = mock(() => {});
    const confirmSpy = spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DetailModal
        icon={Calendar}
        title="Item"
        metadata={[]}
        onClose={() => {}}
        onDestructive={onDestructive}
        destructiveConfirmMessage='Delete "Item"? This cannot be undone.'
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(confirmSpy).toHaveBeenCalledWith('Delete "Item"? This cannot be undone.');
    expect(onDestructive).toHaveBeenCalledTimes(1);
    confirmSpy.mockRestore();
  });

  it("skips destructive action when confirm is cancelled", async () => {
    const onDestructive = mock(() => {});
    const confirmSpy = spyOn(window, "confirm").mockReturnValue(false);

    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={() => {}} onDestructive={onDestructive} destructiveConfirmMessage="Delete?" />);

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    expect(onDestructive).not.toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("disables actions while destructive work is in flight and blocks close", async () => {
    let resolveDelete!: () => void;
    const onDestructive = mock(
      () =>
        new Promise<void>(resolve => {
          resolveDelete = resolve;
        }),
    );
    const onClose = mock(() => {});
    const confirmSpy = spyOn(window, "confirm").mockReturnValue(true);

    render(
      <DetailModal
        icon={Calendar}
        title="Item"
        metadata={[]}
        onClose={onClose}
        onEdit={() => {}}
        onDestructive={onDestructive}
        destructiveConfirmMessage="Delete?"
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).toBeDisabled();
      expect(screen.getByRole("button", { name: /edit/i })).toBeDisabled();
      expect(screen.getByLabelText("Close")).toBeDisabled();
    });

    await userEvent.click(screen.getByTestId("detail-modal-backdrop"));
    expect(onClose).not.toHaveBeenCalled();

    resolveDelete();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /delete/i })).not.toBeDisabled();
    });

    confirmSpy.mockRestore();
  });

  it("renders custom footer actions between destructive and close", () => {
    render(
      <DetailModal
        icon={Calendar}
        title="Item"
        metadata={[]}
        onClose={() => {}}
        onDestructive={() => {}}
        footerActions={
          <button type="button" data-testid="custom-footer">
            Share
          </button>
        }
      />,
    );

    expect(screen.getByTestId("custom-footer")).toBeInTheDocument();
  });

  it("dismisses on Escape when not busy", async () => {
    const onClose = mock(() => {});
    render(<DetailModal icon={Calendar} title="Item" metadata={[]} onClose={onClose} />);

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
