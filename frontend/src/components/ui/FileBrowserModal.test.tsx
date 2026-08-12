import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const listDirectory = mock(async (_args: { path: string; provider: string; showHidden: boolean; recursive: boolean }) => ({
  files: ["notes.md", "readme.txt", "docs/"],
}));
const searchWorkspaceFiles = mock(async (_args: { provider: string; query: string; limit: number }) => ({
  files: ["docs/guide.md", "docs/other.txt"],
  totalMatches: 2,
}));
const readTextFile = mock(async (_args: { path: string; provider: string }) => ({
  content: "# Hello\n\nWorld.",
}));

void mock.module("../../rpc.ts", () => ({
  filesystemRPCClient: { listDirectory, searchWorkspaceFiles, readTextFile },
}));

const { default: FileBrowserModal } = await import("./FileBrowserModal.tsx");

function renderModal(overrides: Partial<Parameters<typeof FileBrowserModal>[0]> = {}) {
  const props = {
    providers: ["local"],
    onOpen: mock((_path: string, _content: string, _provider: string) => {}),
    onClose: mock(() => {}),
    ...overrides,
  };
  return { ...render(<FileBrowserModal {...props} />), props };
}

describe("FileBrowserModal", () => {
  beforeEach(() => {
    listDirectory.mockClear();
    searchWorkspaceFiles.mockClear();
    readTextFile.mockClear();
    listDirectory.mockImplementation(async () => ({
      files: ["notes.md", "readme.txt", "docs/"],
    }));
    searchWorkspaceFiles.mockImplementation(async () => ({
      files: ["docs/guide.md", "docs/other.txt"],
      totalMatches: 2,
    }));
    readTextFile.mockImplementation(async () => ({ content: "# Hello\n\nWorld." }));
  });

  it("renders title, search, Cancel and Open buttons", async () => {
    renderModal({ title: "Open Document" });

    expect(screen.getByRole("dialog", { name: "Open Document" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^open$/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalled();
    });
  });

  it("lists directories and all files when extensionFilter is null", async () => {
    renderModal({ extensionFilter: null });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });
    expect(screen.getByText("readme.txt")).toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("filters listing by extensionFilter", async () => {
    renderModal({ extensionFilter: ".md" });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });
    expect(screen.queryByText("readme.txt")).not.toBeInTheDocument();
    expect(screen.getByText("docs")).toBeInTheDocument();
  });

  it("navigates into a directory on single click", async () => {
    listDirectory
      .mockImplementationOnce(async () => ({ files: ["notes.md", "docs/"] }))
      .mockImplementationOnce(async ({ path }) => {
        expect(path).toBe("docs");
        return { files: ["guide.md"] };
      });

    renderModal({ extensionFilter: ".md" });

    await waitFor(() => {
      expect(screen.getByText("docs")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("docs"));

    await waitFor(() => {
      expect(screen.getByText("guide.md")).toBeInTheDocument();
    });
  });

  it("selects a file on single click and opens on Open button", async () => {
    const onOpen = mock((_path: string, _content: string, _provider: string) => {});
    renderModal({ onOpen, extensionFilter: ".md" });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });

    const openBtn = screen.getByRole("button", { name: /^open$/i });
    expect(openBtn).toBeDisabled();

    await userEvent.click(screen.getByText("notes.md"));
    expect(openBtn).not.toBeDisabled();

    await userEvent.click(openBtn);

    await waitFor(() => {
      expect(readTextFile).toHaveBeenCalledWith({ path: "notes.md", provider: "local" });
      expect(onOpen).toHaveBeenCalledWith("notes.md", "# Hello\n\nWorld.", "local");
    });
  });

  it("opens a file on double-click", async () => {
    const onOpen = mock((_path: string, _content: string, _provider: string) => {});
    renderModal({ onOpen, extensionFilter: ".md" });

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });

    await userEvent.dblClick(screen.getByText("notes.md"));

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith("notes.md", "# Hello\n\nWorld.", "local");
    });
  });

  it("invokes onClose when Cancel is clicked", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("invokes onClose when the X button is clicked", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("dismisses on Escape when not opening", async () => {
    const onClose = mock(() => {});
    renderModal({ onClose });

    await userEvent.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("shows provider selector when multiple providers exist", async () => {
    renderModal({ providers: ["local", "remote"], initialProvider: "remote" });

    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalledWith(expect.objectContaining({ provider: "remote" }));
    });

    const select = screen.getByRole("combobox");
    expect(select).toHaveValue("remote");
    expect(screen.getByText("Location")).toBeInTheDocument();
  });

  it("hides provider selector when only one provider exists", async () => {
    renderModal({ providers: ["local"] });
    expect(screen.queryByText("Location")).not.toBeInTheDocument();
    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalled();
    });
  });

  it("searches workspace files with debounce and filters by extension", async () => {
    renderModal({
      extensionFilter: ".md",
      searchPlaceholder: "Search markdown files…",
    });

    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalled();
    });

    const search = screen.getByLabelText("Search markdown files…");
    await userEvent.type(search, "guide");

    await waitFor(
      () => {
        expect(searchWorkspaceFiles).toHaveBeenCalledWith({
          provider: "local",
          query: "guide",
          limit: 80,
        });
      },
      { timeout: 1000 },
    );

    await waitFor(() => {
      expect(screen.getByText("docs/guide.md")).toBeInTheDocument();
    });
    expect(screen.queryByText("docs/other.txt")).not.toBeInTheDocument();
  });

  it("shows empty message when directory has no matching files", async () => {
    listDirectory.mockImplementation(async () => ({ files: ["image.png"] }));
    renderModal({ extensionFilter: ".md", emptyMessage: "No markdown files or folders here" });

    await waitFor(() => {
      expect(screen.getByText("No markdown files or folders here")).toBeInTheDocument();
    });
  });

  it("shows no-providers message when providers list is empty", () => {
    renderModal({ providers: [] });
    expect(screen.getByText("No filesystem providers available")).toBeInTheDocument();
  });

  it("navigates via breadcrumb root", async () => {
    listDirectory
      .mockImplementationOnce(async () => ({ files: ["docs/"] }))
      .mockImplementationOnce(async () => ({ files: ["guide.md"] }))
      .mockImplementationOnce(async ({ path }) => {
        expect(path).toBe(".");
        return { files: ["notes.md", "docs/"] };
      });

    renderModal({ extensionFilter: ".md" });

    await waitFor(() => {
      expect(screen.getByText("docs")).toBeInTheDocument();
    });
    await userEvent.click(screen.getByText("docs"));

    await waitFor(() => {
      expect(screen.getByText("guide.md")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByRole("button", { name: "root" }));

    await waitFor(() => {
      expect(screen.getByText("notes.md")).toBeInTheDocument();
    });
  });

  it("displays listDirectory errors", async () => {
    listDirectory.mockImplementation(async () => {
      throw new Error("Permission denied");
    });
    renderModal();

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("Permission denied");
    });
  });
});
