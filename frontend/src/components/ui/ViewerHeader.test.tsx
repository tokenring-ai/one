import { describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ViewerHeader from "./ViewerHeader.tsx";

describe("ViewerHeader", () => {
  it("renders title", () => {
    render(<ViewerHeader title="photo.png" onClose={() => {}} />);

    expect(screen.getByText("photo.png")).toBeInTheDocument();
  });

  it("renders subtitle when provided", () => {
    render(<ViewerHeader title="photo.png" subtitle="1920×1080 · landscape" onClose={() => {}} />);

    expect(screen.getByText("1920×1080 · landscape")).toBeInTheDocument();
  });

  it("omits subtitle when not provided", () => {
    const { container } = render(<ViewerHeader title="photo.png" onClose={() => {}} />);

    expect(container.querySelectorAll("span")).toHaveLength(1);
  });

  it("renders keyword tags", () => {
    render(<ViewerHeader title="clip.mp4" keywords={["sunset", "beach"]} onClose={() => {}} />);

    expect(screen.getByText("sunset")).toBeInTheDocument();
    expect(screen.getByText("beach")).toBeInTheDocument();
  });

  it("omits keyword row when keywords are empty or missing", () => {
    const { rerender } = render(<ViewerHeader title="clip.mp4" onClose={() => {}} />);
    expect(screen.queryByText("sunset")).not.toBeInTheDocument();

    rerender(<ViewerHeader title="clip.mp4" keywords={[]} onClose={() => {}} />);
    expect(screen.queryByText("sunset")).not.toBeInTheDocument();
  });

  it("renders action buttons", () => {
    render(<ViewerHeader title="photo.png" onClose={() => {}} actions={<button type="button">Download</button>} />);

    expect(screen.getByRole("button", { name: "Download" })).toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", async () => {
    const onClose = mock(() => {});
    render(<ViewerHeader title="photo.png" onClose={onClose} />);

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("hides close button when onClose is omitted", () => {
    render(<ViewerHeader title="photo.png" />);

    expect(screen.queryByRole("button", { name: "Close" })).not.toBeInTheDocument();
  });

  it("forwards className and data-testid", () => {
    const { container } = render(<ViewerHeader title="photo.png" onClose={() => {}} className="bg-secondary" data-testid="viewer-hdr" />);

    const root = screen.getByTestId("viewer-hdr");
    expect(root).toBe(container.firstChild as HTMLElement);
    expect(root).toHaveClass("bg-secondary", "border-b");
  });
});
