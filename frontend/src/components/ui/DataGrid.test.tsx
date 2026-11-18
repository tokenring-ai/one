import { describe, expect, it, mock } from "bun:test";
import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DataGrid, { type DataGridColumn } from "./DataGrid.tsx";

const columns: DataGridColumn[] = [
  { name: "id", dataType: "integer", isPrimaryKey: true, isNumeric: true },
  { name: "name", dataType: "varchar", label: "Name" },
  { name: "active", dataType: "boolean" },
];

const rows: Record<string, unknown>[] = [
  { id: 1, name: "Alpha", active: true },
  { id: 2, name: "Beta", active: false },
  { id: 3, name: null, active: true },
];

function rowKeyOf(row: Record<string, unknown>, _index: number) {
  return String(row.id);
}

const baseProps = {
  rows,
  columns,
  selectedKeys: new Set<string>(),
  rowKeyOf,
  loading: false,
  onToggleRow: () => {},
  onToggleAll: () => {},
  onSort: () => {},
  onRetry: () => {},
};

describe("DataGrid", () => {
  it("renders column headers and row values", () => {
    render(<DataGrid {...baseProps} data-testid="grid" />);

    expect(screen.getByRole("columnheader", { name: /id/i })).toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Alpha")).toBeInTheDocument();
    expect(screen.getByText("Beta")).toBeInTheDocument();
  });

  it("shows data type labels under headers by default", () => {
    render(<DataGrid {...baseProps} />);

    expect(screen.getByText("integer")).toBeInTheDocument();
    expect(screen.getByText("varchar")).toBeInTheDocument();
  });

  it("hides data type labels when showDataTypeLabels is false", () => {
    render(<DataGrid {...baseProps} showDataTypeLabels={false} />);

    expect(screen.queryByText("integer")).toBeNull();
    expect(screen.queryByText("varchar")).toBeNull();
  });

  it("shows primary key indicator", () => {
    render(<DataGrid {...baseProps} />);

    expect(screen.getByLabelText("Primary key")).toBeInTheDocument();
  });

  it("hides primary key indicator when showPrimaryKeyIndicators is false", () => {
    render(<DataGrid {...baseProps} showPrimaryKeyIndicators={false} />);

    expect(screen.queryByLabelText("Primary key")).toBeNull();
  });

  it("renders null and empty cell placeholders", () => {
    render(
      <DataGrid
        {...baseProps}
        rows={[
          { id: 1, name: null, active: true },
          { id: 2, name: "", active: false },
        ]}
      />,
    );

    expect(screen.getByText("null")).toBeInTheDocument();
    expect(screen.getByText("empty")).toBeInTheDocument();
  });

  it("renders boolean values as muted text", () => {
    render(<DataGrid {...baseProps} />);

    expect(screen.getAllByText("true").length).toBeGreaterThan(0);
    expect(screen.getByText("false")).toBeInTheDocument();
  });

  it("right-aligns numeric columns", () => {
    const { container } = render(<DataGrid {...baseProps} />);

    const numericCells = container.querySelectorAll("td.text-right.tabular-nums");
    expect(numericCells.length).toBe(3);
  });

  it("uses fields to subset and order columns", () => {
    render(<DataGrid {...baseProps} fields={["name", "id"]} />);

    const headers = screen.getAllByRole("columnheader");
    // selection checkbox header + name + id
    expect(headers).toHaveLength(3);
    expect(within(headers[1]!).getByText("Name")).toBeInTheDocument();
    expect(within(headers[2]!).getByText("id")).toBeInTheDocument();
  });

  it("shows loading state when loading with no rows", () => {
    render(<DataGrid {...baseProps} rows={[]} loading loadingMessage="Loading rows…" />);

    expect(screen.getByRole("status")).toBeInTheDocument();
    expect(screen.getByText("Loading rows…")).toBeInTheDocument();
  });

  it("shows error state with retry", async () => {
    const onRetry = mock(() => {});
    render(<DataGrid {...baseProps} rows={[]} error={new Error("connection refused")} errorTitle="Failed to load rows" onRetry={onRetry} />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("Failed to load rows")).toBeInTheDocument();
    expect(screen.getByText("connection refused")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it("shows empty message when there are no rows", () => {
    render(<DataGrid {...baseProps} rows={[]} emptyMessage="This table has no rows." />);

    expect(screen.getByText("This table has no rows.")).toBeInTheDocument();
  });

  it("shows filter-aware empty message when filters are active", () => {
    render(<DataGrid {...baseProps} rows={[]} hasActiveFilters emptyFilteredMessage="No rows match the current filters." />);

    expect(screen.getByText("No rows match the current filters.")).toBeInTheDocument();
  });

  it("toggles individual row selection", async () => {
    const onToggleRow = mock((_row: Record<string, unknown>, _index: number) => {});
    render(<DataGrid {...baseProps} onToggleRow={onToggleRow} />);

    await userEvent.click(screen.getByLabelText("Select row 1"));
    expect(onToggleRow).toHaveBeenCalledTimes(1);
    expect(onToggleRow.mock.calls[0]?.[0]).toEqual(rows[0]);
    expect(onToggleRow.mock.calls[0]?.[1]).toBe(0);
  });

  it("toggles select-all", async () => {
    const onToggleAll = mock(() => {});
    render(<DataGrid {...baseProps} onToggleAll={onToggleAll} />);

    await userEvent.click(screen.getByLabelText("Select rows on this page"));
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it("marks selected rows and sets indeterminate on select-all", () => {
    render(<DataGrid {...baseProps} selectedKeys={new Set(["1"])} data-testid="grid" />);

    const selectedRow = screen.getByLabelText("Select row 1").closest("tr");
    expect(selectedRow).toHaveAttribute("aria-selected", "true");
    expect(selectedRow).toHaveClass("bg-active");

    const selectAll = screen.getByLabelText("Select rows on this page") as HTMLInputElement;
    expect(selectAll.indeterminate).toBe(true);
    expect(selectAll.checked).toBe(false);
  });

  it("checks select-all when every row is selected", () => {
    render(<DataGrid {...baseProps} selectedKeys={new Set(["1", "2", "3"])} />);

    const selectAll = screen.getByLabelText("Deselect rows on this page") as HTMLInputElement;
    expect(selectAll.checked).toBe(true);
    expect(selectAll.indeterminate).toBe(false);
  });

  it("hides selection when showSelection is false", () => {
    render(<DataGrid {...baseProps} showSelection={false} />);

    expect(screen.queryByLabelText(/select row/i)).toBeNull();
    expect(screen.queryByLabelText(/select rows on this page/i)).toBeNull();
  });

  it("invokes onSort when a sortable header is clicked", async () => {
    const onSort = mock(() => {});
    render(<DataGrid {...baseProps} onSort={onSort} />);

    await userEvent.click(screen.getByRole("button", { name: /name/i }));
    expect(onSort).toHaveBeenCalledWith("name");
  });

  it("shows sort direction indicators", () => {
    render(<DataGrid {...baseProps} orderBy={[{ column: "name", direction: "asc" }]} />);

    expect(screen.getByLabelText("Sorted ascending")).toBeInTheDocument();
  });

  it("shows descending sort indicator", () => {
    render(<DataGrid {...baseProps} orderBy={[{ column: "id", direction: "desc" }]} />);

    expect(screen.getByLabelText("Sorted descending")).toBeInTheDocument();
  });

  it("does not sort non-sortable columns", () => {
    const onSort = mock(() => {});
    render(<DataGrid {...baseProps} columns={[{ name: "name", sortable: false }, { name: "id" }]} fields={["name", "id"]} onSort={onSort} />);

    expect(screen.queryByRole("button", { name: /^name$/i })).toBeNull();
    expect(screen.getByText("name")).toBeInTheDocument();
  });

  it("opens a row on double-click when enableRowDetail is true", () => {
    const onOpenRow = mock((_row: Record<string, unknown>) => {});
    render(<DataGrid {...baseProps} onOpenRow={onOpenRow} />);

    fireEvent.doubleClick(screen.getByText("Alpha"));
    expect(onOpenRow).toHaveBeenCalledTimes(1);
    expect(onOpenRow.mock.calls[0]?.[0]).toEqual(rows[0]);
  });

  it("does not open a row on double-click when enableRowDetail is false", () => {
    const onOpenRow = mock(() => {});
    render(<DataGrid {...baseProps} onOpenRow={onOpenRow} enableRowDetail={false} />);

    fireEvent.doubleClick(screen.getByText("Alpha"));
    expect(onOpenRow).not.toHaveBeenCalled();
  });

  it("uses custom cell renderers", () => {
    render(
      <DataGrid
        {...baseProps}
        columns={[
          {
            name: "name",
            renderCell: value => <span data-testid="custom-cell">{String(value).toUpperCase()}</span>,
          },
        ]}
        fields={["name"]}
      />,
    );

    const cells = screen.getAllByTestId("custom-cell");
    expect(cells[0]).toHaveTextContent("ALPHA");
    expect(cells[1]).toHaveTextContent("BETA");
  });

  it("applies size variant classes", () => {
    const { container } = render(<DataGrid {...baseProps} size="md" />);

    expect(container.querySelector("table")).toHaveClass("text-sm");
  });

  it("forwards className and data-testid", () => {
    const { container } = render(<DataGrid {...baseProps} className="custom-grid" data-testid="data-grid" />);

    expect(screen.getByTestId("data-grid")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("custom-grid");
  });

  it("sets cell title attribute for tooltips", () => {
    render(<DataGrid {...baseProps} />);

    expect(screen.getByText("Alpha").closest("td")).toHaveAttribute("title", "Alpha");
  });
});
