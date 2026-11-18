import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import SearchInput from "./SearchInput.tsx";

describe("SearchInput", () => {
  it("renders the search input with placeholder and aria-label", () => {
    render(<SearchInput value="" onChange={() => {}} placeholder="Search plugins…" aria-label="Search plugins" />);

    const input = screen.getByRole("searchbox", { name: "Search plugins" });
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute("placeholder", "Search plugins…");
    expect(input).toHaveAttribute("type", "search");
  });

  it("calls onChange with the typed value", async () => {
    const onChange = mock((_value: string) => {});
    render(<SearchInput value="" onChange={onChange} aria-label="Search" />);

    await userEvent.type(screen.getByRole("searchbox", { name: "Search" }), "ab");

    expect(onChange).toHaveBeenCalled();
    expect(onChange.mock.calls.some(call => call[0] === "a")).toBe(true);
    expect(onChange.mock.calls.some(call => call[0] === "b")).toBe(true);
  });

  it("hides the clear button when the value is empty", () => {
    render(<SearchInput value="" onChange={() => {}} aria-label="Search" />);

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("shows the clear button when the value is non-empty", () => {
    render(<SearchInput value="query" onChange={() => {}} aria-label="Search" />);

    expect(screen.getByRole("button", { name: "Clear search" })).toBeInTheDocument();
  });

  it("clears the value and calls onClear when the clear button is clicked", async () => {
    const onChange = mock(() => {});
    const onClear = mock(() => {});
    render(<SearchInput value="query" onChange={onChange} onClear={onClear} aria-label="Search" />);

    await userEvent.click(screen.getByRole("button", { name: "Clear search" }));

    expect(onChange).toHaveBeenCalledWith("");
    expect(onClear).toHaveBeenCalledTimes(1);
  });

  it("never shows the clear button when showClear is false", () => {
    render(<SearchInput value="query" onChange={() => {}} showClear={false} aria-label="Search" />);

    expect(screen.queryByRole("button", { name: "Clear search" })).not.toBeInTheDocument();
  });

  it("uses a custom clear aria-label", () => {
    render(<SearchInput value="x" onChange={() => {}} clearAriaLabel="Clear filter" aria-label="Filter list" />);

    expect(screen.getByRole("button", { name: "Clear filter" })).toBeInTheDocument();
  });

  it("applies wrapper className", () => {
    const { container } = render(<SearchInput value="" onChange={() => {}} className="flex-1 min-w-0" aria-label="Search" />);

    expect(container.firstChild).toHaveClass("relative", "flex-1", "min-w-0");
  });

  it("forwards inputProps such as disabled", () => {
    render(<SearchInput value="" onChange={() => {}} aria-label="Search" inputProps={{ disabled: true }} />);

    expect(screen.getByRole("searchbox", { name: "Search" })).toBeDisabled();
  });

  it("uses md size classes when size is md", () => {
    render(<SearchInput value="" onChange={() => {}} size="md" aria-label="Search" />);

    expect(screen.getByRole("searchbox", { name: "Search" })).toHaveClass("text-sm");
  });
});
