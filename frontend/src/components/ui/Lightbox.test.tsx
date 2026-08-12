import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("./toast.tsx", () => ({
  toastManager: {
    error: toastError,
    success: mock(),
    warning: mock(),
    info: mock(),
    remove: mock(),
  },
}));

const { default: Lightbox } = await import("./Lightbox.tsx");

describe("Lightbox", () => {
  beforeEach(() => {
    toastError.mockClear();
  });

  it("renders nothing when closed", () => {
    render(<Lightbox open={false} src="/img.png" onClose={() => {}} />);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders an image dialog when open", () => {
    render(<Lightbox open src="/img.png" alt="Panda" onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Full size image" })).toBeTruthy();
    const img = screen.getByRole("img", { name: "Panda" });
    expect(img.getAttribute("src")).toBe("/img.png");
  });

  it("renders a video with controls when type is video", () => {
    render(<Lightbox open src="/clip.mp4" type="video" onClose={() => {}} />);

    expect(screen.getByRole("dialog", { name: "Full size video" })).toBeTruthy();
    // Portaled to document.body — query the dialog, not the RTL container
    const video = screen.getByRole("dialog").querySelector("video");
    expect(video).toBeTruthy();
    expect(video?.getAttribute("src")).toBe("/clip.mp4");
    expect(video?.hasAttribute("controls")).toBe(true);
  });

  it("calls onClose when the close button is clicked", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(<Lightbox open src="/img.png" onClose={onClose} />);

    await user.click(screen.getByLabelText("Close full size"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("calls onClose when the backdrop is clicked", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(<Lightbox open src="/img.png" onClose={onClose} />);

    await user.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not close when the media itself is clicked", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(<Lightbox open src="/img.png" alt="media" onClose={onClose} />);

    await user.click(screen.getByRole("img", { name: "media" }));
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls onClose on Escape", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(<Lightbox open src="/img.png" onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("does not listen for Escape when closed", async () => {
    const user = userEvent.setup();
    const onClose = mock(() => {});
    render(<Lightbox open={false} src="/img.png" onClose={onClose} />);

    await user.keyboard("{Escape}");
    expect(onClose).not.toHaveBeenCalled();
  });

  it("toasts and calls onError + onClose when the image fails to load", () => {
    const onClose = mock(() => {});
    const onError = mock(() => {});
    render(<Lightbox open src="/broken.png" alt="broken" onClose={onClose} onError={onError} />);

    screen.getByRole("img", { name: "broken" }).dispatchEvent(new Event("error"));

    expect(toastError).toHaveBeenCalledWith("Failed to load full-size image", { duration: 3000 });
    expect(onError).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("uses the video error message when type is video", () => {
    render(<Lightbox open src="/broken.mp4" type="video" onClose={() => {}} />);

    screen.getByRole("dialog").querySelector("video")?.dispatchEvent(new Event("error"));

    expect(toastError).toHaveBeenCalledWith("Failed to load full-size video", { duration: 3000 });
  });

  it("suppresses toast when errorMessage is false", () => {
    const onError = mock(() => {});
    render(<Lightbox open src="/broken.png" alt="x" onClose={() => {}} onError={onError} errorMessage={false} />);

    screen.getByRole("img", { name: "x" }).dispatchEvent(new Event("error"));

    expect(toastError).not.toHaveBeenCalled();
    expect(onError).toHaveBeenCalledTimes(1);
  });

  it("respects a custom ariaLabel", () => {
    render(<Lightbox open src="/img.png" onClose={() => {}} ariaLabel="Zoomed photo" />);
    expect(screen.getByRole("dialog", { name: "Zoomed photo" })).toBeTruthy();
  });
});
