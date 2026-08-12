import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import DateRangePicker, { type DateRange, validateDateRange } from "./DateRangePicker.tsx";

const base: DateRange = { from: "2026-01-01", to: "2026-01-31" };

describe("validateDateRange", () => {
  it("requires both dates", () => {
    expect(validateDateRange({ from: "", to: "2026-01-01" })).toBe("Select both start and end dates");
    expect(validateDateRange({ from: "2026-01-01", to: "" })).toBe("Select both start and end dates");
  });

  it("rejects start after end", () => {
    expect(validateDateRange({ from: "2026-02-01", to: "2026-01-01" })).toBe("Start date must be on or before end date");
  });

  it("enforces maxDays", () => {
    expect(validateDateRange({ from: "2026-01-01", to: "2026-01-15" }, 7)).toBe("Range cannot exceed 7 days");
    expect(validateDateRange({ from: "2026-01-01", to: "2026-01-08" }, 7)).toBeNull();
  });

  it("accepts a valid range", () => {
    expect(validateDateRange(base)).toBeNull();
  });
});

describe("DateRangePicker", () => {
  it("renders start/end inputs and apply button", () => {
    render(<DateRangePicker value={base} onChange={() => {}} />);

    expect(screen.getByLabelText("Start date")).toHaveValue("2026-01-01");
    expect(screen.getByLabelText("End date")).toHaveValue("2026-01-31");
    expect(screen.getByRole("button", { name: /apply/i })).toBeInTheDocument();
    expect(screen.getByText("to")).toBeInTheDocument();
  });

  it("uses custom aria-labels, separator, and apply label", () => {
    render(
      <DateRangePicker value={base} onChange={() => {}} fromAriaLabel="History start date" toAriaLabel="History end date" separator="–" applyLabel="Update" />,
    );

    expect(screen.getByLabelText("History start date")).toBeInTheDocument();
    expect(screen.getByLabelText("History end date")).toBeInTheDocument();
    expect(screen.getByText("–")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /update/i })).toBeInTheDocument();
  });

  it("renders optional visible labels", () => {
    render(<DateRangePicker value={base} onChange={() => {}} fromLabel="From" toLabel="To" />);

    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("does not call onChange until Apply is clicked", async () => {
    const onChange = mock(() => {});
    render(<DateRangePicker value={base} onChange={onChange} />);

    const from = screen.getByLabelText("Start date");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-01-10");

    expect(onChange).not.toHaveBeenCalled();

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(onChange).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith({ from: "2026-01-10", to: "2026-01-31" });
  });

  it("shows an error when applying without both dates", async () => {
    const onChange = mock(() => {});
    render(<DateRangePicker value={{ from: "", to: "" }} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Select both start and end dates");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows an error when start is after end", async () => {
    const onChange = mock(() => {});
    render(<DateRangePicker value={{ from: "2026-02-01", to: "2026-01-01" }} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Start date must be on or before end date");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("shows maxDays validation error", async () => {
    const onChange = mock(() => {});
    render(<DateRangePicker value={{ from: "2026-01-01", to: "2026-01-31" }} onChange={onChange} maxDays={7} />);

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    expect(screen.getByRole("alert")).toHaveTextContent("Range cannot exceed 7 days");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("clears the error when the user edits a field", async () => {
    const onChange = mock(() => {});
    render(<DateRangePicker value={{ from: "2026-02-01", to: "2026-01-01" }} onChange={onChange} />);

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));
    expect(screen.getByRole("alert")).toBeInTheDocument();

    await userEvent.clear(screen.getByLabelText("Start date"));
    await userEvent.type(screen.getByLabelText("Start date"), "2026-01-01");

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("hides Apply and auto-applies valid changes when autoApply is true", async () => {
    const onChange = mock((_range: DateRange) => {});
    render(<DateRangePicker value={base} onChange={onChange} autoApply />);

    expect(screen.queryByRole("button", { name: /apply/i })).not.toBeInTheDocument();

    const from = screen.getByLabelText("Start date");
    await userEvent.clear(from);
    await userEvent.type(from, "2026-01-15");

    expect(onChange).toHaveBeenCalled();
    const last = onChange.mock.calls.at(-1)?.[0];
    expect(last).toEqual({ from: "2026-01-15", to: "2026-01-31" });
  });

  it("renders presets and applies them immediately", async () => {
    const onChange = mock((_range: DateRange) => {});
    render(
      <DateRangePicker
        value={base}
        onChange={onChange}
        presets={[
          { label: "7D", days: 7 },
          { label: "30D", days: 30 },
        ]}
      />,
    );

    expect(screen.getByRole("button", { name: "7D" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "30D" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "7D" }));

    expect(onChange).toHaveBeenCalledTimes(1);
    const range = onChange.mock.calls[0]![0];
    expect(range.from).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.to).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(range.from <= range.to).toBe(true);
  });

  it("applies className and data-testid", () => {
    const { container } = render(<DateRangePicker value={base} onChange={() => {}} className="mt-2" data-testid="range" />);

    expect(screen.getByTestId("range")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("mt-2");
  });
});
