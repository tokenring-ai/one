import { beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, useLocation, useNavigate } from "react-router-dom";

const WORKSPACE = "/workspace";

const writeFile = mock(async (_args: { path: string; content: string }) => ({ success: true }));
const appendFile = mock(async (_args: { path: string; content: string }) => ({ success: true }));
const readTextFile = mock(async (_args: { path: string }) => ({ content: "# Opened file\n\nHello." }));
const listDirectory = mock(async (_args: { path: string; showHidden: boolean; recursive: boolean }) => ({
  files: ["notes.md", "docs/"],
}));
const searchWorkspaceFiles = mock(async (_args: { query: string; limit: number }) => ({
  files: ["docs/guide.md"],
  totalMatches: 1,
}));
const getDefaultDirectories = mock(async () => ({
  workingDirectory: "/repo",
  workspaceDirectory: WORKSPACE,
}));

const actualRpc = await import("../../rpc.ts");
void mock.module("../../rpc.ts", () => ({
  ...actualRpc,
  filesystemRPCClient: { writeFile, appendFile, readTextFile, listDirectory, searchWorkspaceFiles, getDefaultDirectories },
  agentRPCClient: {
    getAgentTypes: async () => [],
    createAgent: async () => ({ id: "agent-1" }),
    getAgentEvents: async () => ({ status: "success", position: 0 }),
    sendInput: async () => ({}),
    streamAgentEvents: async function* () {
      /* empty */
    },
  },
}));

void mock.module("../../hooks/useBackgroundAgent.ts", () => ({
  useBackgroundAgent: () => ({ agentId: null, initialising: false, error: "No writer agent" }),
}));

const actualToast = await import("../../components/ui/toast.tsx");
void mock.module("../../components/ui/toast.tsx", () => ({
  ...actualToast,
  toastManager: {
    success: mock(),
    error: mock(),
    warning: mock(),
    info: mock(),
  },
}));

// focus-trap refuses to activate in jsdom
const PassThroughFocusTrap = ({ children }: { children: React.ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const { LayoutApp } = await import("../../layout/LayoutApp.tsx");
const { createLayoutRegistry } = await import("../../layout/registry.ts");
const { CORE_KINDS } = await import("../kinds.ts");
const { CHAT_VIEWS } = await import("../chat/views.ts");
const { DOCUMENTS_APP } = await import("./manifest.ts");
const { DOCUMENTS_KINDS } = await import("./kinds.ts");
const { DOCUMENTS_VIEWS } = await import("./views.ts");
const {
  resetDocumentsStore,
  loadDocument,
  setContent,
  setSelection,
  applyEditToSelection,
  reloadDocumentsStoreFromStorage,
  flushDocumentsDraft,
  DRAFT_STORAGE_KEY,
  MAX_PERSISTED_DRAFT_CHARS,
} = await import("../../features/documents/documentsStore.ts");
const { resolveDocumentPath } = await import("../../features/documents/resolveDocumentPath.ts");

const registry = createLayoutRegistry({ apps: [DOCUMENTS_APP], views: [...DOCUMENTS_VIEWS, ...CHAT_VIEWS], kinds: [...CORE_KINDS, ...DOCUMENTS_KINDS] });

/** Routes the URL to the Documents app, like the shell's AppHost. */
function Host() {
  const location = useLocation();
  const route = registry.routes.resolve(location.pathname);
  if (!route) return <p>No route for {location.pathname}</p>;
  return <LayoutApp key={route.app} registry={registry} appId={route.app} route={route} remote={null} />;
}

/** Router nav buttons that stay mounted while the editor route mounts and unmounts. */
function HistoryButtons() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => void navigate("/files")}>
        go-files
      </button>
      <button type="button" onClick={() => void navigate(-1)}>
        go-back
      </button>
    </>
  );
}

type HandOff = { filePath?: string; fileContent?: string; title?: string };

function renderApp(state?: HandOff, path = "/documents") {
  try {
    for (const key of Object.keys(localStorage)) if (key.startsWith("tokenring-layout:")) localStorage.removeItem(key);
  } catch {
    // storage unavailable
  }
  return render(
    <MemoryRouter initialEntries={[{ pathname: path, ...(state === undefined ? {} : { state }) }]}>
      <HistoryButtons />
      <Host />
    </MemoryRouter>,
  );
}

describe("Documents views", () => {
  beforeEach(() => {
    writeFile.mockClear();
    appendFile.mockClear();
    readTextFile.mockClear();
    listDirectory.mockClear();
    searchWorkspaceFiles.mockClear();
    getDefaultDirectories.mockClear();
    getDefaultDirectories.mockImplementation(async () => ({
      workingDirectory: "/repo",
      workspaceDirectory: WORKSPACE,
    }));
    // The open document is a module store now, so it outlives a render.
    resetDocumentsStore();
  });

  it("renders the welcome document and toolbar actions", () => {
    renderApp();
    expect(screen.getByLabelText("Document title")).toHaveValue("Untitled Document");
    const editor = screen.getByLabelText("Markdown editor") as HTMLTextAreaElement;
    expect(editor).toBeInTheDocument();
    expect(editor.value).toContain("Welcome to Documents");
    expect(screen.getByRole("button", { name: /Open/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /New/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Save As/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Append$/i })).toBeDisabled();
  });

  it("renders the preview from the same document as the editor", () => {
    renderApp(undefined, "/documents/preview");
    // Preview is its own panel rather than a toggle inside the editor, so it
    // reads the document from the store rather than from a prop.
    expect(screen.getByRole("heading", { name: /Welcome to Documents/i })).toBeInTheDocument();
  });

  it("loads a document from navigation state", () => {
    renderApp({
      filePath: "docs/readme.md",
      fileContent: "# From Files\n\nLoaded content.",
      title: "readme",
    });
    expect(screen.getByLabelText("Document title")).toHaveValue("readme");
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("# From Files\n\nLoaded content.");
    expect(screen.getByText("docs/readme.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
  });

  it("allows Save As for a clean untitled document", async () => {
    const user = userEvent.setup();
    renderApp();
    const saveAs = screen.getByRole("button", { name: /Save As/i });
    expect(saveAs).not.toBeDisabled();
    await user.click(saveAs);
    expect(screen.getByRole("dialog", { name: /Save As/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("documents/my-file.md")).toBeInTheDocument();
  });

  it("opens the Save As modal when saving an unsaved document", async () => {
    const user = userEvent.setup();
    renderApp();
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "# Draft");
    await user.click(screen.getByRole("button", { name: /Save As/i }));
    expect(screen.getByRole("dialog", { name: /Save As/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText("documents/my-file.md")).toBeInTheDocument();
  });

  it("saves an opened document via filesystem RPC", async () => {
    const user = userEvent.setup();
    renderApp({
      filePath: "notes.md",
      fileContent: "original",
      title: "notes",
    });
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "updated body");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: "updated body" });
    });
    expect(screen.getByLabelText("Document title")).toHaveValue("notes");
    expect(screen.getByText(`${WORKSPACE}/notes.md`)).toBeInTheDocument();
  });

  it("saves a typed relative path into the workspace and appends to that same file", async () => {
    const user = userEvent.setup();
    renderApp();
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "saved body");
    await user.click(screen.getByRole("button", { name: /Save As/i }));
    const dialog = screen.getByRole("dialog", { name: /Save As/i });
    const pathInput = within(dialog).getByRole("textbox");
    await user.clear(pathInput);
    await user.type(pathInput, "notes");
    await user.click(within(dialog).getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: "saved body" });
    });
    expect(screen.getByText(`${WORKSPACE}/notes.md`)).toBeInTheDocument();
    expect(screen.queryByRole("dialog", { name: /Save As/i })).toBeNull();
    await user.click(screen.getByRole("button", { name: /^Append$/i }));
    const appendDialog = screen.getByRole("dialog", { name: /^Append$/i });
    await user.type(within(appendDialog).getByLabelText("Text to append"), " more");
    await user.click(within(appendDialog).getByRole("button", { name: /^Append$/i }));
    await waitFor(() => {
      expect(appendFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: " more" });
    });
    expect(appendFile.mock.calls.map(call => call[0].path)).not.toContain("notes.md");
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("saved body more");
  });

  it("opens the Open Document modal at the workspace directory", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /Open/i }));
    expect(screen.getByRole("dialog", { name: /Open Document/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalledWith(expect.objectContaining({ path: WORKSPACE }));
    });
    expect(listDirectory.mock.calls.map(call => call[0].path)).not.toContain(".");
    expect(listDirectory.mock.calls.map(call => call[0].path)).not.toContain("/repo");
  });

  it("saves and reloads a picked file at the same workspace path", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /^Open$/i }));
    const dialog = await screen.findByRole("dialog", { name: /Open Document/i });
    await waitFor(() => expect(within(dialog).getByText("notes.md")).toBeInTheDocument());
    await user.click(within(dialog).getByText("notes.md"));
    await user.click(within(dialog).getByRole("button", { name: /^Open$/i }));
    await waitFor(() => {
      expect(readTextFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md` });
    });
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("# Opened file\n\nHello.");
    expect(screen.getByText(`${WORKSPACE}/notes.md`)).toBeInTheDocument();
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "saved body");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: "saved body" });
    });
  });

  it("appends a relative path into the workspace, not the process cwd", async () => {
    const user = userEvent.setup();
    renderApp({ filePath: "notes.md", fileContent: "original", title: "My Notes" });
    await user.click(screen.getByRole("button", { name: /^Append$/i }));
    const dialog = screen.getByRole("dialog", { name: /^Append$/i });
    await user.type(within(dialog).getByLabelText("Text to append"), " more");
    await user.click(within(dialog).getByRole("button", { name: /^Append$/i }));
    await waitFor(() => {
      expect(appendFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: " more" });
    });
    expect(appendFile.mock.calls.map(call => call[0].path)).not.toContain("notes.md");
    expect(screen.getByText(`${WORKSPACE}/notes.md`)).toBeInTheDocument();
    expect(screen.getByLabelText("Document title")).toHaveValue("My Notes");
    expect(screen.queryByText("Unsaved")).toBeNull();
  });

  it("appends confirmed text to the open file", async () => {
    const user = userEvent.setup();
    renderApp({ filePath: `${WORKSPACE}/notes.md`, fileContent: "original", title: "notes" });
    expect(screen.getByRole("button", { name: /^Append$/i })).toBeEnabled();
    await user.click(screen.getByRole("button", { name: /^Append$/i }));
    const dialog = screen.getByRole("dialog", { name: /^Append$/i });
    await user.type(within(dialog).getByLabelText("Text to append"), " more");
    await user.click(within(dialog).getByRole("button", { name: /^Append$/i }));
    await waitFor(() => {
      expect(appendFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: " more" });
    });
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("original more");
    expect(screen.queryByText("Unsaved")).toBeNull();
    expect(listDirectory).not.toHaveBeenCalled();
  });

  it("prompts before discarding dirty content on New", async () => {
    const user = userEvent.setup();
    renderApp();
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "dirty content");
    await user.click(screen.getByRole("button", { name: /New/i }));
    expect(screen.getByRole("dialog", { name: /Unsaved changes/i })).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Discard/i }));
    const value = (screen.getByLabelText("Markdown editor") as HTMLTextAreaElement).value;
    expect(value).toContain("Welcome to Documents");
  });
  it("keeps text typed during a save dirty, using what was sent as the saved baseline", async () => {
    const user = userEvent.setup();
    let finishWrite: () => void = () => {};
    writeFile.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finishWrite = () => resolve({ success: true });
        }),
    );
    renderApp({ filePath: "notes.md", fileContent: "original", title: "notes" });
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "sent");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: "sent" });
    });
    // Typed while the write is in flight.
    await user.type(editor, " more");
    await act(async () => finishWrite());
    expect(editor).toHaveValue("sent more");
    // Still dirty: the in-flight edits did not become the saved baseline.
    expect(screen.getByText("Unsaved")).toBeInTheDocument();
  });

  const badge = () => screen.queryByRole("img", { name: "Unsaved changes" });

  it("shows a warning tab badge while dirty instead of a beforeunload prompt", async () => {
    const user = userEvent.setup();
    const { unmount } = renderApp({ filePath: "notes.md", fileContent: "original", title: "notes" });
    expect(badge()).toBeNull();
    const editor = screen.getByLabelText("Markdown editor");
    await user.type(editor, "!");
    expect(badge()).toBeInTheDocument();
    const unload = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(unload);
    expect(unload.defaultPrevented).toBe(false);
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => expect(badge()).toBeNull());
    await user.type(editor, "?");
    expect(badge()).toBeInTheDocument();
    unmount();
    expect(badge()).toBeNull();
  });

  it("asks before a Files hand-off replaces a dirty document", async () => {
    const user = userEvent.setup();
    loadDocument({ content: "mine", path: "mine.md" });
    setContent("mine, edited");
    renderApp({ filePath: "docs/readme.md", fileContent: "# From Files", title: "readme" });
    expect(screen.getByRole("dialog", { name: /Unsaved changes/i })).toBeInTheDocument();
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("mine, edited");
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("mine, edited");
  });

  it("does not re-apply the Files hand-off when navigating back to it", async () => {
    const user = userEvent.setup();
    renderApp({ filePath: "readme.md", fileContent: "# From Files" });
    const editor = () => screen.getByLabelText("Markdown editor");
    expect(editor()).toHaveValue("# From Files");
    await user.type(editor(), " edited");
    await user.click(screen.getByRole("button", { name: "go-files" }));
    expect(screen.queryByLabelText("Markdown editor")).toBeNull();
    await user.click(screen.getByRole("button", { name: "go-back" }));
    await screen.findByLabelText("Markdown editor");
    // The history entry's payload was consumed, so the edits survive Back.
    expect(editor()).toHaveValue("# From Files edited");
    expect(screen.queryByRole("dialog", { name: /Unsaved changes/i })).toBeNull();
  });

  describe("draft persistence", () => {
    it("restores unsaved edits after a reload", async () => {
      const user = userEvent.setup();
      const first = renderApp({ filePath: "notes.md", fileContent: "original", title: "notes" });
      await user.type(screen.getByLabelText("Markdown editor"), " plus edits");
      first.unmount();
      // A reload: module state is rebuilt from storage, then the editor mounts again.
      reloadDocumentsStoreFromStorage();
      renderApp();
      expect(screen.getByLabelText("Markdown editor")).toHaveValue("original plus edits");
      expect(screen.getByLabelText("Document title")).toHaveValue("notes");
      expect(screen.getByText("notes.md")).toBeInTheDocument();
      // Still dirty against the restored saved baseline, so the badge comes back.
      expect(screen.getByText("Unsaved")).toBeInTheDocument();
      expect(badge()).toBeInTheDocument();
      await user.click(screen.getByRole("button", { name: /^Save$/i }));
      await waitFor(() => expect(writeFile).toHaveBeenCalledWith({ path: `${WORKSPACE}/notes.md`, content: "original plus edits" }));
    });

    it("does not persist a draft above the size guard", () => {
      setContent("x".repeat(MAX_PERSISTED_DRAFT_CHARS));
      flushDocumentsDraft();
      expect(localStorage.getItem(DRAFT_STORAGE_KEY)).toBeNull();
      reloadDocumentsStoreFromStorage();
      renderApp();
      expect((screen.getByLabelText("Markdown editor") as HTMLTextAreaElement).value).toContain("Welcome to Documents");
    });

    it("ignores a corrupt stored draft", () => {
      localStorage.setItem(DRAFT_STORAGE_KEY, "{not json");
      reloadDocumentsStoreFromStorage();
      renderApp();
      expect((screen.getByLabelText("Markdown editor") as HTMLTextAreaElement).value).toContain("Welcome to Documents");
    });
  });

  describe("applying an AI edit", () => {
    // Typed loosely so the test can stub the (deprecated) API without tripping the lint on it.
    const host = document as unknown as { execCommand: (command: string, ui?: boolean, value?: string) => boolean };
    const originalExecCommand = host.execCommand;

    function selectRange(start: number, end: number) {
      const editor = screen.getByLabelText("Markdown editor") as HTMLTextAreaElement;
      act(() => setSelection({ start, end, text: editor.value.slice(start, end) }));
      return editor;
    }

    it("applies through insertText so the browser can undo it", async () => {
      const execCommand = mock((command: string, _ui?: boolean, value?: string) => {
        const target = document.activeElement as HTMLTextAreaElement;
        if (command !== "insertText" || !(target instanceof HTMLTextAreaElement)) return false;
        target.setRangeText(value ?? "", target.selectionStart, target.selectionEnd, "end");
        target.dispatchEvent(new Event("input", { bubbles: true }));
        return true;
      });
      host.execCommand = execCommand;
      try {
        loadDocument({ content: "hello world", path: "a.md" });
        renderApp();
        selectRange(0, 5);
        act(() => applyEditToSelection("goodbye", { start: 0, end: 5, text: "hello" }));
        await waitFor(() => expect(screen.getByLabelText("Markdown editor")).toHaveValue("goodbye world"));
        expect(execCommand).toHaveBeenCalledWith("insertText", false, "goodbye");
        expect(screen.getByText("Unsaved")).toBeInTheDocument();
      } finally {
        host.execCommand = originalExecCommand;
      }
    });

    it("falls back to splicing when insertText is unavailable", async () => {
      host.execCommand = () => false;
      try {
        loadDocument({ content: "hello world", path: "a.md" });
        renderApp();
        selectRange(6, 11);
        act(() => applyEditToSelection("there", { start: 6, end: 11, text: "world" }));
        await waitFor(() => expect(screen.getByLabelText("Markdown editor")).toHaveValue("hello there"));
      } finally {
        host.execCommand = originalExecCommand;
      }
    });
  });

  it("offers Ask AI for a selection and opens the AI panel", async () => {
    const user = userEvent.setup();
    loadDocument({ content: "hello world", path: "a.md" });
    renderApp();
    expect(screen.queryByRole("button", { name: /Ask AI/ })).toBeNull();
    act(() => setSelection({ start: 0, end: 5, text: "hello" }));
    await user.click(screen.getByRole("button", { name: /Ask AI/ }));
    // The AI panel owns the URL once it is opened.
    expect(screen.getByText("AI editing unavailable")).toBeInTheDocument();
  });

  it("resolves a relative path against the workspace only", async () => {
    await expect(resolveDocumentPath("notes.md")).resolves.toBe(`${WORKSPACE}/notes.md`);
    await expect(resolveDocumentPath(`${WORKSPACE}/notes.md`)).resolves.toBe(`${WORKSPACE}/notes.md`);
    getDefaultDirectories.mockImplementationOnce(async () => ({
      workingDirectory: "/repo",
      workspaceDirectory: ".",
    }));
    await expect(resolveDocumentPath("notes.md")).resolves.toBe("notes.md");
    getDefaultDirectories.mockImplementationOnce(async () => ({
      workingDirectory: "/repo",
      workspaceDirectory: "data",
    }));
    // A relative workspace must not be prefixed: writeFile would resolve it again.
    await expect(resolveDocumentPath("notes.md")).resolves.toBe("notes.md");
  });
});
