import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ListItemWithActions from "./ListItemWithActions.tsx";

describe("ListItemWithActions", () => {
  it("renders primary content", () => {
    render(
      <ListItemWithActions id="snap-1" onPrimary={() => {}}>
        <span>snapshot-a</span>
      </ListItemWithActions>,
    );

    expect(screen.getByRole("button", { name: /snapshot-a/i })).toBeInTheDocument();
  });

  it("invokes onPrimary when the primary area is clicked", async () => {
    const onPrimary = mock(() => {});
    render(
      <ListItemWithActions id="snap-1" onPrimary={onPrimary}>
        Open me
      </ListItemWithActions>,
    );

    await userEvent.click(screen.getByRole("button", { name: /open me/i }));
    expect(onPrimary).toHaveBeenCalledTimes(1);
  });

  it("marks selected items with aria-current and active styles", () => {
    render(
      <ListItemWithActions id="snap-1" selected onPrimary={() => {}} data-testid="row">
        Selected
      </ListItemWithActions>,
    );

    const row = screen.getByTestId("row");
    expect(row).toHaveAttribute("aria-current", "true");
    expect(row).toHaveAttribute("data-item-id", "snap-1");
    expect(row).toHaveClass("bg-active", "group");
  });

  it("omits aria-current when not selected", () => {
    render(
      <ListItemWithActions id="snap-1" onPrimary={() => {}} data-testid="row">
        Idle
      </ListItemWithActions>,
    );

    expect(screen.getByTestId("row")).not.toHaveAttribute("aria-current");
    expect(screen.getByTestId("row")).toHaveClass("hover:bg-hover");
  });

  it("renders the action slot", () => {
    render(
      <ListItemWithActions id="snap-1" onPrimary={() => {}} action={<button type="button">Delete</button>}>
        Item
      </ListItemWithActions>,
    );

    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
  });

  it("does not invoke onPrimary when the action button is clicked", async () => {
    const onPrimary = mock(() => {});
    const onDelete = mock(() => {});
    render(
      <ListItemWithActions
        id="snap-1"
        onPrimary={onPrimary}
        action={
          <button type="button" onClick={onDelete}>
            Delete
          </button>
        }
      >
        Item
      </ListItemWithActions>,
    );

    await userEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
    expect(onPrimary).not.toHaveBeenCalled();
  });

  it("hides actions by default and shows them when alwaysShowAction is set", () => {
    const { rerender } = render(
      <ListItemWithActions id="snap-1" onPrimary={() => {}} action={<button type="button">Delete</button>} data-testid="row">
        Item
      </ListItemWithActions>,
    );

    const actionWrap = screen.getByRole("button", { name: /delete/i }).parentElement;
    expect(actionWrap).toHaveClass("opacity-0", "group-hover:opacity-100");

    rerender(
      <ListItemWithActions id="snap-1" onPrimary={() => {}} alwaysShowAction action={<button type="button">Delete</button>} data-testid="row">
        Item
      </ListItemWithActions>,
    );

    expect(screen.getByRole("button", { name: /delete/i }).parentElement).toHaveClass("opacity-100");
  });

  it("renders children in a non-button container when onPrimary is omitted", () => {
    render(
      <ListItemWithActions id="news-1" action={<a href="https://example.com">Open</a>}>
        Headline only
      </ListItemWithActions>,
    );

    expect(screen.queryByRole("button", { name: /headline only/i })).not.toBeInTheDocument();
    expect(screen.getByText("Headline only")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /open/i })).toBeInTheDocument();
  });

  it("forwards primaryProps to the primary button", () => {
    render(
      <ListItemWithActions id="tab-1" onPrimary={() => {}} primaryProps={{ title: "Working dir", disabled: true }}>
        shell
      </ListItemWithActions>,
    );

    const primary = screen.getByRole("button", { name: /shell/i });
    expect(primary).toBeDisabled();
    expect(primary).toHaveAttribute("title", "Working dir");
  });
});
