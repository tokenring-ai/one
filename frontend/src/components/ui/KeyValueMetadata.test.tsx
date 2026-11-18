import { describe, expect, it } from "bun:test";
import { render, screen } from "@testing-library/react";
import { Clock } from "lucide-react";
import KeyValueMetadata, { KeyValueRow } from "./KeyValueMetadata.tsx";

describe("KeyValueRow", () => {
  it("renders label and value", () => {
    render(<KeyValueRow label="From" value="alice@example.com" />);

    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toBeInTheDocument();
  });

  it("applies default label width and truncate", () => {
    const { container } = render(<KeyValueRow label="To" value="bob@example.com" data-testid="row" />);

    const label = screen.getByText("To");
    expect(label).toHaveClass("w-8", "font-medium", "text-secondary", "shrink-0");

    const value = screen.getByText("bob@example.com");
    expect(value).toHaveClass("truncate", "min-w-0", "flex-1");
    expect(container.firstChild).toBe(screen.getByTestId("row"));
  });

  it("uses break-all instead of truncate when breakAll is true", () => {
    render(<KeyValueRow label="From" value="long@example.com" breakAll />);

    const value = screen.getByText("long@example.com");
    expect(value).toHaveClass("break-all");
    expect(value).not.toHaveClass("truncate");
  });

  it("disables truncate when truncate is false", () => {
    render(<KeyValueRow label="Name" value="content" truncate={false} />);

    const value = screen.getByText("content");
    expect(value).not.toHaveClass("truncate");
    expect(value).not.toHaveClass("break-all");
  });

  it("accepts custom labelWidth", () => {
    render(<KeyValueRow label="Subject" value="Hello" labelWidth="w-10" />);

    expect(screen.getByText("Subject")).toHaveClass("w-10");
  });

  it("renders as a label element when as is label", () => {
    render(<KeyValueRow as="label" label="To" value={<input aria-label="to-input" />} data-testid="field-row" />);

    const row = screen.getByTestId("field-row");
    expect(row.tagName).toBe("LABEL");
    expect(screen.getByLabelText("to-input")).toBeInTheDocument();
  });

  it("centers items when align is center", () => {
    render(<KeyValueRow label="Cc" value="x" align="center" data-testid="centered" />);

    expect(screen.getByTestId("centered")).toHaveClass("items-center");
  });

  it("forwards className and data-testid", () => {
    const { container } = render(<KeyValueRow label="Date" value="today" className="extra-row" data-testid="row-id" />);

    expect(screen.getByTestId("row-id")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("extra-row");
  });

  it("renders ReactNode values with icons", () => {
    render(
      <KeyValueRow
        label="Date"
        value={
          <span className="flex items-center gap-1">
            <Clock data-testid="clock-icon" className="w-3 h-3" />
            Mar 1
          </span>
        }
        truncate={false}
      />,
    );

    expect(screen.getByTestId("clock-icon")).toBeInTheDocument();
    expect(screen.getByText("Mar 1")).toBeInTheDocument();
  });
});

describe("KeyValueMetadata", () => {
  it("renders multiple rows", () => {
    render(
      <KeyValueMetadata
        items={[
          { label: "From", value: "alice@example.com", breakAll: true },
          { label: "To", value: "bob@example.com" },
          { label: "Date", value: "Mar 1" },
        ]}
        data-testid="meta"
      />,
    );

    expect(screen.getByTestId("meta")).toBeInTheDocument();
    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("alice@example.com")).toHaveClass("break-all");
    expect(screen.getByText("To")).toBeInTheDocument();
    expect(screen.getByText("bob@example.com")).toHaveClass("truncate");
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.getByText("Mar 1")).toBeInTheDocument();
  });

  it("skips falsy items and null/undefined/false values", () => {
    render(
      <KeyValueMetadata
        items={[
          { label: "From", value: "alice@example.com" },
          false,
          null,
          { label: "To", value: null },
          { label: "Cc", value: undefined },
          { label: "Bcc", value: false },
          { label: "Date", value: "Mar 1" },
        ]}
      />,
    );

    expect(screen.getByText("From")).toBeInTheDocument();
    expect(screen.getByText("Date")).toBeInTheDocument();
    expect(screen.queryByText("To")).toBeNull();
    expect(screen.queryByText("Cc")).toBeNull();
    expect(screen.queryByText("Bcc")).toBeNull();
  });

  it("returns null when no rows remain", () => {
    const { container } = render(<KeyValueMetadata items={[{ label: "Empty", value: null }, false]} />);

    expect(container.firstChild).toBeNull();
  });

  it("applies size, gap, labelWidth, and divider", () => {
    render(<KeyValueMetadata items={[{ label: "Size", value: "1 KB" }]} size="sm" gap="space-y-2" labelWidth="w-16" divider data-testid="styled" />);

    const root = screen.getByTestId("styled");
    expect(root).toHaveClass("text-sm", "space-y-2", "border-b", "border-primary");
    expect(screen.getByText("Size")).toHaveClass("w-16");
  });

  it("forwards className", () => {
    render(<KeyValueMetadata items={[{ label: "A", value: "1" }]} className="custom-meta" data-testid="meta" />);

    expect(screen.getByTestId("meta")).toHaveClass("custom-meta");
  });

  it("uses custom row keys when provided", () => {
    const { container } = render(
      <KeyValueMetadata
        items={[
          { key: "from-addr", label: "From", value: "a@x.com" },
          { key: "to-addr", label: "From", value: "b@x.com" },
        ]}
      />,
    );

    // Both rows render even with duplicate labels when keys differ.
    const labels = container.querySelectorAll("span.font-medium");
    expect(labels).toHaveLength(2);
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
  });
});
