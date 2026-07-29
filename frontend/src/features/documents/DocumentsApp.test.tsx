import { beforeEach, describe, expect, it, mock } from "bun:test";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";

const writeFile = mock(async (_args: { path: string; content: string; provider: string }) => ({ success: true }));
const readTextFile = mock(async (_args: { path: string; provider: string }) => ({ content: "# Opened file\n\nHello." }));
const listDirectory = mock(async (_args: { path: string; provider: string; showHidden: boolean; recursive: boolean }) => ({
  files: ["notes.md", "docs/"],
}));
const searchWorkspaceFiles = mock(async (_args: { provider: string; query: string; limit: number }) => ({
  files: ["docs/guide.md"],
  totalMatches: 1,
}));

void mock.module("../../rpc.ts", () => ({
  filesystemRPCClient: { writeFile, readTextFile, listDirectory, searchWorkspaceFiles },
  useFilesystemProviders: () => ({ data: { providers: ["local"] }, isLoading: false }),
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

void mock.module("../../hooks/useHeadlessAgent.ts", () => ({
  useHeadlessAgent: () => ({ agentId: null, initialising: false, error: "No writer agent" }),
}));

void mock.module("../../components/ui/toast.tsx", () => ({
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

const { default: DocumentsApp } = await import("./DocumentsApp.tsx");

function renderApp(state?: { filePath?: string; fileContent?: string; title?: string; provider?: string }) {
  return render(
    <MemoryRouter initialEntries={[{ pathname: "/documents", state }]}>
      <Routes>
        <Route path="/documents" element={<DocumentsApp />} />
      </Routes>
    </MemoryRouter>,
  );
}

describe("DocumentsApp", () => {
  beforeEach(() => {
    writeFile.mockClear();
    readTextFile.mockClear();
    listDirectory.mockClear();
    searchWorkspaceFiles.mockClear();
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
    expect(screen.getByRole("button", { name: /Preview/i })).toBeInTheDocument();
  });

  it("loads a document from navigation state", () => {
    renderApp({
      filePath: "docs/readme.md",
      fileContent: "# From Files\n\nLoaded content.",
      title: "readme",
      provider: "local",
    });
    expect(screen.getByLabelText("Document title")).toHaveValue("readme");
    expect(screen.getByLabelText("Markdown editor")).toHaveValue("# From Files\n\nLoaded content.");
    expect(screen.getByText("docs/readme.md")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /^Save$/i })).toBeInTheDocument();
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
      provider: "local",
    });
    const editor = screen.getByLabelText("Markdown editor");
    await user.clear(editor);
    await user.type(editor, "updated body");
    await user.click(screen.getByRole("button", { name: /^Save$/i }));
    await waitFor(() => {
      expect(writeFile).toHaveBeenCalledWith({ path: "notes.md", content: "updated body", provider: "local" });
    });
  });

  it("opens the Open Document modal", async () => {
    const user = userEvent.setup();
    renderApp();
    await user.click(screen.getByRole("button", { name: /Open/i }));
    expect(screen.getByRole("dialog", { name: /Open Document/i })).toBeInTheDocument();
    await waitFor(() => {
      expect(listDirectory).toHaveBeenCalled();
    });
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
});
