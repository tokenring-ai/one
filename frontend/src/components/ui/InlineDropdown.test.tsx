import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import InlineDropdown, { InlineDropdownItem } from "./InlineDropdown.tsx";

describe("InlineDropdown", () => {
  it("renders the trigger and keeps the menu closed by default", () => {
    render(
      <InlineDropdown trigger="Options" header="Menu">
        <InlineDropdownItem>Item A</InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(screen.getByRole("button", { name: "Options" })).toBeInTheDocument();
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
    expect(screen.queryByText("Menu")).not.toBeInTheDocument();
  });

  it("opens the menu on trigger click and shows header and items", async () => {
    render(
      <InlineDropdown trigger="Options" header="Mailboxes">
        <InlineDropdownItem>Inbox</InlineDropdownItem>
        <InlineDropdownItem>Sent</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));

    expect(screen.getByRole("menu")).toBeInTheDocument();
    expect(screen.getByText("Mailboxes")).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Inbox" })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: "Sent" })).toBeInTheDocument();
  });

  it("sets aria-expanded on the trigger", async () => {
    render(
      <InlineDropdown trigger="Options">
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    const trigger = screen.getByRole("button", { name: "Options" });
    expect(trigger).toHaveAttribute("aria-expanded", "false");

    await userEvent.click(trigger);
    expect(trigger).toHaveAttribute("aria-expanded", "true");
  });

  it("closes when the backdrop is clicked", async () => {
    const { container } = render(
      <InlineDropdown trigger="Options" header="Menu">
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    const backdrop = container.querySelector(".fixed.inset-0");
    expect(backdrop).toBeTruthy();
    await userEvent.click(backdrop!);

    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("closes on Escape", async () => {
    render(
      <InlineDropdown trigger="Options">
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("menu")).toBeInTheDocument();

    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("supports controlled open state via open and onOpenChange", async () => {
    const onOpenChange = mock((_open: boolean) => {});

    function Controlled() {
      const [open, setOpen] = useState(false);
      return (
        <InlineDropdown
          trigger="Options"
          open={open}
          onOpenChange={next => {
            onOpenChange(next);
            setOpen(next);
          }}
        >
          <InlineDropdownItem>Item</InlineDropdownItem>
        </InlineDropdown>
      );
    }

    render(<Controlled />);

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(onOpenChange).toHaveBeenCalledWith(true);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("does not close on item click when closeOnSelect is false (default)", async () => {
    const onClick = mock(() => {});
    render(
      <InlineDropdown trigger="Options">
        <InlineDropdownItem onClick={onClick}>Pick me</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pick me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.getByRole("menu")).toBeInTheDocument();
  });

  it("closes on item click when closeOnSelect is true", async () => {
    const onClick = mock(() => {});
    render(
      <InlineDropdown trigger="Options" closeOnSelect>
        <InlineDropdownItem onClick={onClick}>Pick me</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    await userEvent.click(screen.getByRole("menuitem", { name: "Pick me" }));

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("menu")).not.toBeInTheDocument();
  });

  it("aligns the panel left or right", async () => {
    const { rerender } = render(
      <InlineDropdown trigger="Options" align="left" width="w-52">
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    await userEvent.click(screen.getByRole("button", { name: "Options" }));
    expect(screen.getByRole("menu")).toHaveClass("left-0", "w-52");

    rerender(
      <InlineDropdown trigger="Options" align="right" width="w-48" open onOpenChange={() => {}}>
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );
    expect(screen.getByRole("menu")).toHaveClass("right-0", "w-48");
  });

  it("passes open state to a function trigger", async () => {
    render(
      <InlineDropdown trigger={open => (open ? "Close menu" : "Open menu")}>
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Open menu" }));
    expect(screen.getByRole("button", { name: "Close menu" })).toBeInTheDocument();
  });

  it("disables the trigger when disabled is true", () => {
    render(
      <InlineDropdown trigger="Options" disabled>
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(screen.getByRole("button", { name: "Options" })).toBeDisabled();
  });

  it("merges triggerClassName and className", () => {
    const { container } = render(
      <InlineDropdown trigger="Options" className="ml-2" triggerClassName="gap-2">
        <InlineDropdownItem>Item</InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(container.firstChild).toHaveClass("relative", "ml-2");
    expect(screen.getByRole("button", { name: "Options" })).toHaveClass("gap-2");
  });
});

describe("InlineDropdownItem", () => {
  it("renders leading content and default active trailing dot", async () => {
    render(
      <InlineDropdown trigger="Options" open onOpenChange={() => {}}>
        <InlineDropdownItem active leading={<span data-testid="lead">L</span>}>
          Active item
        </InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(screen.getByTestId("lead")).toBeInTheDocument();
    const item = screen.getByRole("menuitem", { name: /Active item/i });
    expect(item).toHaveClass("font-medium");
    // default active dot
    const dots = item.querySelectorAll("span.rounded-full");
    expect(dots.length).toBeGreaterThanOrEqual(1);
  });

  it("uses custom trailing instead of the default active dot", async () => {
    render(
      <InlineDropdown trigger="Options" open onOpenChange={() => {}}>
        <InlineDropdownItem active trailing={<span data-testid="custom-trail">★</span>}>
          Active item
        </InlineDropdownItem>
      </InlineDropdown>,
    );

    expect(screen.getByTestId("custom-trail")).toBeInTheDocument();
  });

  it("applies custom activeColor when using the default active dot", () => {
    render(
      <InlineDropdown trigger="Options" open onOpenChange={() => {}}>
        <InlineDropdownItem active activeColor="bg-sky-500">
          Active item
        </InlineDropdownItem>
      </InlineDropdown>,
    );

    const item = screen.getByRole("menuitem", { name: /Active item/i });
    expect(item.querySelector(".bg-sky-500")).toBeTruthy();
  });
});
