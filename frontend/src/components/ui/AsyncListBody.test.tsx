import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Box } from "lucide-react";
import AsyncListBody from "./AsyncListBody.tsx";

const rows = <p>rows</p>;

describe("AsyncListBody", () => {
  it("shows a spinner only when there is nothing to display", () => {
    const { rerender } = render(
      <AsyncListBody isLoading hasItems={false} loadingMessage="Loading topics…">
        {rows}
      </AsyncListBody>,
    );
    expect(screen.getByText("Loading topics…")).toBeInTheDocument();

    // A refresh over existing content must not blank the list out.
    rerender(
      <AsyncListBody isLoading hasItems loadingMessage="Loading topics…">
        {rows}
      </AsyncListBody>,
    );
    expect(screen.getByText("rows")).toBeInTheDocument();
    expect(screen.queryByText("Loading topics…")).not.toBeInTheDocument();
  });

  it("offers a retry on error", async () => {
    const onRetry = mock(() => {});
    render(
      <AsyncListBody error={new Error("boom")} hasItems={false} onRetry={onRetry} errorTitle="Failed to load topics">
        {rows}
      </AsyncListBody>,
    );
    expect(screen.getByText("Failed to load topics")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onRetry).toHaveBeenCalled();
  });

  it("keeps stale content visible when a refresh fails", () => {
    render(
      <AsyncListBody error={new Error("boom")} hasItems>
        {rows}
      </AsyncListBody>,
    );
    expect(screen.getByText("rows")).toBeInTheDocument();
  });

  it("falls back to an empty state", () => {
    render(
      <AsyncListBody hasItems={false} emptyIcon={Box} emptyTitle="No topics yet" emptyHint="Create one to get started">
        {rows}
      </AsyncListBody>,
    );
    expect(screen.getByText("No topics yet")).toBeInTheDocument();
    expect(screen.getByText("Create one to get started")).toBeInTheDocument();
  });

  it("renders content when there is some", () => {
    render(<AsyncListBody hasItems>{rows}</AsyncListBody>);
    expect(screen.getByText("rows")).toBeInTheDocument();
  });
});
