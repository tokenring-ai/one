import { beforeEach, describe, expect, it, mock, spyOn } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ChatAttachment } from "@tokenring-ai/agent/AgentEvents";
import AttachmentChip from "./AttachmentChip.tsx";

const errorMock = mock();

void mock.module("../ui/toast.tsx", () => ({
  toastManager: {
    error: errorMock,
  },
}));

const textAttachment: ChatAttachment = {
  name: "notes.txt",
  encoding: "base64",
  mimeType: "text/plain",
  body: btoa("hello world"),
};

const httpsImageAttachment: ChatAttachment = {
  name: "logo.png",
  encoding: "href",
  mimeType: "image/png",
  body: "https://example.com/logo.png",
};

const javascriptImageAttachment: ChatAttachment = {
  name: "evil.png",
  encoding: "href",
  mimeType: "image/png",
  body: "javascript:alert(1)",
};

describe("AttachmentChip", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  it("renders an inline attachment with name and action buttons", () => {
    render(<AttachmentChip attachment={textAttachment} />);

    expect(screen.getByLabelText("Attachment: notes.txt")).toBeTruthy();
    expect(screen.getByText("notes.txt")).toBeTruthy();
    expect(screen.getByLabelText("Preview notes.txt")).toBeTruthy();
    expect(screen.getByLabelText("Copy notes.txt to clipboard")).toBeTruthy();
    expect(screen.getByLabelText("Download notes.txt")).toBeTruthy();
  });

  it("opens a preview overlay for text attachments", async () => {
    const user = userEvent.setup();
    render(<AttachmentChip attachment={textAttachment} />);

    await user.click(screen.getByLabelText("Preview notes.txt"));

    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("hello world")).toBeTruthy();

    await user.click(screen.getByLabelText("Close preview"));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the preview overlay on Escape", async () => {
    const user = userEvent.setup();
    render(<AttachmentChip attachment={textAttachment} />);

    await user.click(screen.getByLabelText("Preview notes.txt"));
    expect(screen.getByRole("dialog")).toBeTruthy();

    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows a toast when clipboard copy fails", async () => {
    const user = userEvent.setup();
    const writeTextSpy = spyOn(navigator.clipboard, "writeText").mockRejectedValueOnce(new Error("Clipboard denied"));

    render(<AttachmentChip attachment={textAttachment} />);
    await user.click(screen.getByLabelText("Copy notes.txt to clipboard"));

    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith("hello world");
      expect(errorMock).toHaveBeenCalledWith(expect.stringContaining('Failed to copy "notes.txt" to clipboard:'), { duration: 5000 });
      expect(errorMock.mock.calls[0]?.[0]).toContain("Clipboard denied");
    });

    writeTextSpy.mockRestore();
  });

  it("shows a toast when download fails", async () => {
    const user = userEvent.setup();
    const createObjectURLSpy = spyOn(URL, "createObjectURL").mockImplementationOnce(() => {
      throw new Error("Blob URL unavailable");
    });

    render(<AttachmentChip attachment={textAttachment} />);
    await user.click(screen.getByRole("button", { name: "Download notes.txt" }));

    await waitFor(() => {
      expect(createObjectURLSpy).toHaveBeenCalled();
      expect(errorMock).toHaveBeenCalledWith(expect.stringContaining('Failed to download "notes.txt":'), { duration: 5000 });
      expect(errorMock.mock.calls.at(-1)?.[0]).toContain("Blob URL unavailable");
    });

    createObjectURLSpy.mockRestore();
  });

  it("renders https href image attachments with a thumbnail and preview source", async () => {
    const user = userEvent.setup();
    const { container } = render(<AttachmentChip attachment={httpsImageAttachment} />);

    expect(container.querySelector("img")?.getAttribute("src")).toBe("https://example.com/logo.png");

    await user.click(screen.getByLabelText("Preview logo.png"));
    const previewImages = screen.getByRole("dialog").querySelectorAll("img");
    expect(previewImages.length).toBeGreaterThan(0);
    expect(previewImages[previewImages.length - 1]?.getAttribute("src")).toBe("https://example.com/logo.png");
  });

  it("blocks javascript: href attachments from media and download links", async () => {
    const user = userEvent.setup();
    const { container } = render(<AttachmentChip attachment={javascriptImageAttachment} />);

    // No thumbnail from the unsafe href; the name is still shown
    expect(container.querySelector("img")).toBeNull();
    expect(screen.getByText("evil.png")).toBeTruthy();

    await user.click(screen.getByLabelText("Preview evil.png"));
    expect(screen.getByText("No preview available for this attachment.")).toBeTruthy();
    await user.click(screen.getByLabelText("Close preview"));

    await user.click(screen.getByRole("button", { name: "Download evil.png" }));
    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith(expect.stringContaining("unsupported URL scheme"), { duration: 5000 });
    });
  });
});
