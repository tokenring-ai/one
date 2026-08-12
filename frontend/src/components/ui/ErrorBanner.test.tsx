import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { WifiOff } from "lucide-react";
import ErrorBanner from "./ErrorBanner.tsx";

describe("ErrorBanner", () => {
  it("renders title and message", () => {
    render(<ErrorBanner title="AI editing is disabled" message="Agent failed to start." />);

    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(screen.getByText("AI editing is disabled")).toBeInTheDocument();
    expect(screen.getByText("Agent failed to start.")).toBeInTheDocument();
  });

  it("applies warning styles by default", () => {
    const { container } = render(<ErrorBanner title="Warning" message="Something needs attention." />);

    expect(container.firstChild).toHaveClass("bg-warning/10", "border-warning/30");
  });

  it("applies error styles for the error variant", () => {
    const { container } = render(<ErrorBanner title="Failed" message="Request timed out." variant="error" />);

    expect(container.firstChild).toHaveClass("bg-red-500/10", "border-red-500/30");
  });

  it("applies info styles for the info variant", () => {
    const { container } = render(<ErrorBanner title="Note" message="Updates pause while offline." variant="info" />);

    expect(container.firstChild).toHaveClass("bg-accent/10", "border-accent/30");
  });

  it("renders an optional action button and invokes onClick", async () => {
    const onClick = mock(() => {});
    render(<ErrorBanner title="Connection lost" message="Unable to reach the server." variant="error" action={{ label: "Retry", onClick }} />);

    await userEvent.click(screen.getByRole("button", { name: "Retry" }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it("omits the action button when action is not provided", () => {
    render(<ErrorBanner title="Warning" message="Detail only." />);

    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("renders a custom leading icon when provided", () => {
    render(<ErrorBanner title="Offline" message="No network route." icon={<WifiOff data-testid="custom-icon" className="w-4 h-4" />} />);

    expect(screen.getByTestId("custom-icon")).toBeInTheDocument();
  });

  it("forwards data-testid and className", () => {
    render(<ErrorBanner title="Banner" message="Body" className="custom-class" data-testid="error-banner" />);

    const banner = screen.getByTestId("error-banner");
    expect(banner).toHaveClass("custom-class");
  });
});
