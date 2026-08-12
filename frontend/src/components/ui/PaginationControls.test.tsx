import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ComponentProps } from "react";
import PaginationControls, { formatPaginationRangeLabel } from "./PaginationControls.tsx";

function renderControls(overrides: Partial<ComponentProps<typeof PaginationControls>> = {}) {
  const onPageChange = mock(() => {});
  const props = {
    offset: 0,
    pageSize: 50,
    hasMore: true,
    itemCount: 50,
    totalCount: 237 as number | null,
    onPageChange,
    ...overrides,
  };
  const result = render(<PaginationControls {...props} />);
  return { ...result, onPageChange, props };
}

describe("formatPaginationRangeLabel", () => {
  it("formats known totals", () => {
    expect(formatPaginationRangeLabel(1, 50, 237, true, 50)).toBe("1–50 of 237");
  });

  it("formats unknown totals with hasMore as trailing plus", () => {
    expect(formatPaginationRangeLabel(1, 50, null, true, 50)).toBe("1–50+");
  });

  it("formats unknown totals without hasMore as a closed range", () => {
    expect(formatPaginationRangeLabel(51, 75, null, false, 25)).toBe("51–75");
  });

  it("returns 0 rows when empty and total is unknown", () => {
    expect(formatPaginationRangeLabel(0, 0, null, false, 0)).toBe("0 rows");
  });

  it("returns Loading… when loading with no items", () => {
    expect(formatPaginationRangeLabel(0, 0, null, false, 0, true)).toBe("Loading…");
  });

  it("prefers totalCount over loading when items are present", () => {
    expect(formatPaginationRangeLabel(1, 50, 100, true, 50, true)).toBe("1–50 of 100");
  });
});

describe("PaginationControls", () => {
  it("renders range label and navigation buttons", () => {
    renderControls();

    expect(screen.getByText("1–50 of 237")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Previous page" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Next page" })).toBeInTheDocument();
    expect(screen.getByRole("navigation", { name: "Pagination" })).toBeInTheDocument();
  });

  it("disables previous on the first page and enables next when hasMore", () => {
    renderControls({ offset: 0, hasMore: true });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).not.toBeDisabled();
  });

  it("disables next when hasMore is false and enables previous when offset > 0", () => {
    renderControls({ offset: 50, hasMore: false, itemCount: 20, totalCount: 70 });

    expect(screen.getByRole("button", { name: "Previous page" })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
    expect(screen.getByText("51–70 of 70")).toBeInTheDocument();
  });

  it("calls onPageChange with the next offset", async () => {
    const { onPageChange } = renderControls({ offset: 0, pageSize: 50 });

    await userEvent.click(screen.getByRole("button", { name: "Next page" }));

    expect(onPageChange).toHaveBeenCalledTimes(1);
    expect(onPageChange).toHaveBeenCalledWith(50);
  });

  it("calls onPageChange with the previous offset, clamped to 0", async () => {
    const { onPageChange } = renderControls({ offset: 30, pageSize: 50, hasMore: false, itemCount: 10 });

    await userEvent.click(screen.getByRole("button", { name: "Previous page" }));

    expect(onPageChange).toHaveBeenCalledWith(0);
  });

  it("disables navigation while loading", () => {
    renderControls({ offset: 50, hasMore: true, loading: true });

    expect(screen.getByRole("button", { name: "Previous page" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next page" })).toBeDisabled();
  });

  it("shows selection count when selectionCount > 0", () => {
    renderControls({ selectionCount: 3 });

    expect(screen.getByText("3 selected")).toBeInTheDocument();
  });

  it("hides selection count when zero or omitted", () => {
    const { rerender } = renderControls({ selectionCount: 0 });
    expect(screen.queryByText(/selected/)).toBeNull();

    rerender(<PaginationControls offset={0} pageSize={50} hasMore={false} itemCount={0} onPageChange={() => {}} />);
    expect(screen.queryByText(/selected/)).toBeNull();
  });

  it("shows refresh button when showRefresh and onRefresh are set", async () => {
    const onRefresh = mock(() => {});
    renderControls({ showRefresh: true, onRefresh });

    const refresh = screen.getByRole("button", { name: "Refresh" });
    await userEvent.click(refresh);

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("hides refresh button by default", () => {
    renderControls({ onRefresh: () => {} });
    expect(screen.queryByRole("button", { name: "Refresh" })).toBeNull();
  });

  it("supports a custom rangeLabelFormatter", () => {
    renderControls({
      rangeLabelFormatter: (start, end, total) => `Page range ${start}-${end} / ${total}`,
    });

    expect(screen.getByText("Page range 1-50 / 237")).toBeInTheDocument();
  });

  it("hides range label when formatter returns null", () => {
    renderControls({
      rangeLabelFormatter: () => null,
    });

    expect(screen.queryByText(/of/)).toBeNull();
    expect(screen.queryByText(/rows/)).toBeNull();
  });

  it("announces the range label politely", () => {
    renderControls();
    const label = screen.getByText("1–50 of 237");
    expect(label).toHaveAttribute("aria-live", "polite");
  });

  it("applies footer variant styles", () => {
    const { container } = renderControls({ variant: "footer" });
    expect(container.firstChild).toHaveClass("border-t", "justify-center");
  });

  it("applies md size styles", () => {
    renderControls({ size: "md" });
    const next = screen.getByRole("button", { name: "Next page" });
    expect(next).toHaveClass("p-2");
  });

  it("forwards className and data-testid", () => {
    const { container } = renderControls({ className: "custom-pagination", "data-testid": "db-pagination" });
    expect(screen.getByTestId("db-pagination")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-pagination");
  });

  it("shows Loading… when loading with no items", () => {
    renderControls({ loading: true, itemCount: 0, totalCount: null, hasMore: false });
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });
});
