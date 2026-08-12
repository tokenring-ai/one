import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import HistoryRunRow from "./HistoryRunRow.tsx";

const START = Date.UTC(2026, 0, 15, 14, 30, 0);
const END = START + 90_000;

describe("HistoryRunRow", () => {
  it("renders entity name, status badge, duration, and message", () => {
    render(
      <HistoryRunRow
        id="run-1"
        entityName="daily-backup"
        status="completed"
        startTime={START}
        endTime={END}
        message="Backup finished successfully"
        showRelativeTime={false}
      />,
    );

    expect(screen.getByText("daily-backup")).toBeInTheDocument();
    expect(screen.getByText("completed")).toBeInTheDocument();
    expect(screen.getByText("1m 30s")).toBeInTheDocument();
    expect(screen.getByText("Backup finished successfully")).toBeInTheDocument();
  });

  it("uses pre-computed duration when provided", () => {
    render(<HistoryRunRow id="run-2" entityName="job" status="failed" startTime={START} duration="450ms" showRelativeTime={false} showTimestamp={false} />);

    expect(screen.getByText("450ms")).toBeInTheDocument();
    expect(screen.queryByText("1m 30s")).toBeNull();
  });

  it("invokes onEntityClick when the entity name is clicked", async () => {
    const onEntityClick = mock(() => {});
    render(
      <HistoryRunRow
        id="run-3"
        entityName="nightly"
        status="completed"
        startTime={START}
        onEntityClick={onEntityClick}
        showRelativeTime={false}
        showTimestamp={false}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: "nightly" }));
    expect(onEntityClick).toHaveBeenCalledTimes(1);
  });

  it("renders entity name as plain text when onEntityClick is omitted", () => {
    render(<HistoryRunRow id="run-4" entityName="plain-item" status="cancelled" startTime={START} showRelativeTime={false} showTimestamp={false} />);

    expect(screen.getByText("plain-item")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "plain-item" })).toBeNull();
  });

  it("hides the status icon when showIcon is false", () => {
    const { container } = render(
      <HistoryRunRow id="run-5" entityName="no-icon" status="completed" startTime={START} showIcon={false} showRelativeTime={false} showTimestamp={false} />,
    );

    expect(container.querySelector("svg")).toBeNull();
  });

  it("renders a custom status badge when provided", () => {
    render(
      <HistoryRunRow
        id="run-6"
        status="custom"
        statusBadge={<span data-testid="custom-badge">Running</span>}
        startTime={START}
        showIcon={false}
        showRelativeTime={false}
        showTimestamp={false}
      />,
    );

    expect(screen.getByTestId("custom-badge")).toHaveTextContent("Running");
    expect(screen.queryByText("custom")).toBeNull();
  });

  it("uses statusLabel for custom statuses", () => {
    render(
      <HistoryRunRow id="run-7" status="custom" statusLabel="starting" startTime={START} showIcon={false} showRelativeTime={false} showTimestamp={false} />,
    );

    expect(screen.getByText("starting")).toBeInTheDocument();
  });

  it("renders leading and action slots", () => {
    render(
      <HistoryRunRow
        id="run-8"
        entityName="with-slots"
        status="completed"
        startTime={START}
        leading={<button type="button">Expand</button>}
        action={<button type="button">Open</button>}
        showRelativeTime={false}
        showTimestamp={false}
      />,
    );

    expect(screen.getByRole("button", { name: "Expand" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Open" })).toBeInTheDocument();
  });

  it("renders children below the message", () => {
    render(
      <HistoryRunRow id="run-9" entityName="parent" status="completed" startTime={START} message="summary" showRelativeTime={false} showTimestamp={false}>
        <div data-testid="extra-details">Expanded details</div>
      </HistoryRunRow>,
    );

    expect(screen.getByTestId("extra-details")).toHaveTextContent("Expanded details");
  });

  it("omits message when not provided", () => {
    const { container } = render(
      <HistoryRunRow id="run-10" entityName="no-msg" status="completed" startTime={START} showRelativeTime={false} showTimestamp={false} />,
    );

    // Only the entity name should appear as primary text content in the flex row
    expect(container.querySelector(".line-clamp-3")).toBeNull();
  });

  it("forwards data-testid, className, and data-run-id", () => {
    const { container } = render(
      <HistoryRunRow
        id="run-abc"
        entityName="meta"
        status="failed"
        startTime={START}
        className="custom-row"
        data-testid="history-row"
        showRelativeTime={false}
        showTimestamp={false}
      />,
    );

    const root = screen.getByTestId("history-row");
    expect(root).toBe(container.firstChild as HTMLElement);
    expect(root).toHaveClass("custom-row");
    expect(root).toHaveAttribute("data-run-id", "run-abc");
  });

  it("applies completed and failed badge color classes", () => {
    const { rerender } = render(
      <HistoryRunRow id="run-c" entityName="a" status="completed" startTime={START} showRelativeTime={false} showTimestamp={false} />,
    );
    expect(screen.getByText("completed").className).toContain("emerald");

    rerender(<HistoryRunRow id="run-f" entityName="a" status="failed" startTime={START} showRelativeTime={false} showTimestamp={false} />);
    expect(screen.getByText("failed").className).toContain("red");
  });
});
