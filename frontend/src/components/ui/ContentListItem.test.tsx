import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ContentListItem from "./ContentListItem.tsx";

describe("ContentListItem", () => {
  it("renders title", () => {
    render(<ContentListItem selected={false} onClick={() => {}} title="Hello world" />);

    expect(screen.getByRole("button", { name: /hello world/i })).toBeInTheDocument();
  });

  it("marks selected items with aria-current and active styles", () => {
    const { container } = render(<ContentListItem selected onClick={() => {}} title="Selected item" data-testid="item" />);

    const button = screen.getByTestId("item");
    expect(button).toHaveAttribute("aria-current", "true");
    expect(button).toHaveClass("bg-active", "border-l-accent");
    expect(container.firstChild).toBe(button);
  });

  it("uses transparent left border when not selected", () => {
    render(<ContentListItem selected={false} onClick={() => {}} title="Idle" data-testid="item" />);

    expect(screen.getByTestId("item")).toHaveClass("border-l-transparent");
    expect(screen.getByTestId("item")).not.toHaveAttribute("aria-current");
  });

  it("invokes onClick when pressed", async () => {
    const onClick = mock(() => {});
    render(<ContentListItem selected={false} onClick={onClick} title="Click me" />);

    await userEvent.click(screen.getByRole("button", { name: /click me/i }));

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("renders status, subtitle, metadata, and snippet", () => {
    render(
      <ContentListItem
        selected={false}
        onClick={() => {}}
        title="Post title"
        status={<span data-testid="status">Draft</span>}
        subtitle="A short subtitle"
        metadata={<span data-testid="meta">Mar 1</span>}
        snippet="Preview text…"
      />,
    );

    expect(screen.getByTestId("status")).toHaveTextContent("Draft");
    expect(screen.getByText("A short subtitle")).toBeInTheDocument();
    expect(screen.getByTestId("meta")).toHaveTextContent("Mar 1");
    expect(screen.getByText("Preview text…")).toBeInTheDocument();
  });

  it("omits optional slots when not provided", () => {
    const { container } = render(<ContentListItem selected={false} onClick={() => {}} title="Only title" />);

    // Title row + no subtitle/metadata/snippet
    expect(container.querySelectorAll("span").length).toBe(1);
  });

  it("renders an indicator and reserves title-row padding", () => {
    const { container } = render(
      <ContentListItem selected={false} onClick={() => {}} title="Unread" indicator={<span data-testid="dot" className="absolute right-3 top-3" />} />,
    );

    expect(screen.getByTestId("dot")).toBeInTheDocument();
    const titleRow = container.querySelector(".pr-3");
    expect(titleRow).not.toBeNull();
  });

  it("applies a custom selected border color", () => {
    render(<ContentListItem selected onClick={() => {}} title="Email" selectedBorderColor="border-l-red-500" data-testid="item" />);

    expect(screen.getByTestId("item")).toHaveClass("border-l-red-500");
    expect(screen.getByTestId("item")).not.toHaveClass("border-l-accent");
  });

  it("emphasizes title and subtitle when emphasized", () => {
    render(<ContentListItem selected={false} onClick={() => {}} title="Sender" subtitle="Subject" emphasized data-testid="item" />);

    const title = screen.getByText("Sender");
    const subtitle = screen.getByText("Subject");
    expect(title).toHaveClass("font-semibold", "text-primary");
    expect(subtitle).toHaveClass("font-medium", "text-secondary");
  });
});
