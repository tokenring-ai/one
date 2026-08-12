import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Inbox, RefreshCw } from "lucide-react";
import EmptyState from "./EmptyState.tsx";

describe("EmptyState", () => {
  it("renders title and hint", () => {
    render(<EmptyState icon={Inbox} title="Inbox is empty" hint="No recent messages." />);

    expect(screen.getByText("Inbox is empty")).toBeInTheDocument();
    expect(screen.getByText("No recent messages.")).toBeInTheDocument();
  });

  it("omits the hint paragraph when no hint is given", () => {
    const { container } = render(<EmptyState title="Nothing here" />);

    expect(container.querySelectorAll("p")).toHaveLength(1);
  });

  it("renders the CTA only when both label and handler are supplied", () => {
    const { rerender } = render(<EmptyState title="No items" ctaLabel="Add item" />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<EmptyState title="No items" onCta={() => {}} />);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();

    rerender(<EmptyState title="No items" ctaLabel="Add item" onCta={() => {}} />);
    expect(screen.getByRole("button", { name: /add item/i })).toBeInTheDocument();
  });

  it("invokes the CTA handler on click", async () => {
    const onCta = mock(() => {});
    render(<EmptyState title="No items" ctaLabel="Add item" onCta={onCta} />);

    await userEvent.click(screen.getByRole("button", { name: /add item/i }));

    expect(onCta).toHaveBeenCalledTimes(1);
  });

  it("disables the CTA while loading", () => {
    render(<EmptyState title="No terminals" ctaLabel="New Terminal" ctaIcon={RefreshCw} ctaLoading onCta={() => {}} />);

    expect(screen.getByRole("button", { name: /new terminal/i })).toBeDisabled();
  });

  it("renders an arbitrary action node", () => {
    render(<EmptyState title="No plugins" action={<a href="/configuration">Open configuration</a>} />);

    expect(screen.getByRole("link", { name: "Open configuration" })).toBeInTheDocument();
  });

  it("applies the dashed card styling for the card variant", () => {
    const { container } = render(<EmptyState variant="card" title="No spend yet" data-testid="spend-empty" />);

    expect(screen.getByTestId("spend-empty")).toBe(container.firstChild as HTMLElement);
    expect(container.firstChild).toHaveClass("border-dashed");
  });
});
