import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import type { ReactNode } from "react";
import ChatFooter from "./ChatFooter.tsx";

// The DOM has no layout, so focus-trap finds nothing tabbable in the remote picker; the trap itself is ModalShell's concern.
const PassThroughFocusTrap = ({ children }: { children: ReactNode }) => children;
void mock.module("focus-trap-react", () => ({ FocusTrap: PassThroughFocusTrap, default: PassThroughFocusTrap }));

const warningMock = mock();
const errorMock = mock();
const abortCurrentOperationMock = mock((): Promise<unknown> => Promise.resolve());

void mock.module("../ui/toast.tsx", () => ({
  toastManager: {
    warning: warningMock,
    error: errorMock,
  },
}));

const searchContextResult = {
  status: "success" as const,
  categories: [
    {
      id: "skills",
      label: "Skills",
      items: [
        {
          id: "code-review",
          tag: "@[skill:code-review]",
          title: "code-review",
          subtitle: "Review a pull request",
          categoryId: "skills",
          categoryLabel: "Skills",
        },
      ],
    },
  ],
  pending: [],
};

const remote = {
  mounts: [] as { scheme: string; authority: string; url: string; label: string; writable: boolean; contextualSearch: boolean }[],
};
const budget = {
  url: "googledrive://work/budget-id",
  name: "Budget",
  kind: "file" as const,
  mimeType: "application/vnd.google-apps.spreadsheet",
  readsAs: "text/csv",
};
const remoteRead = mock(async () => ({ name: "Budget", mimeType: "text/csv", size: 9, encoding: "utf8" as const, content: "a,b\n1,2\n" }));

const searchContext = mock(async function* () {
  yield searchContextResult;
});

void mock.module("../../rpc.ts", () => ({
  agentRPCClient: {
    abortCurrentOperation: abortCurrentOperationMock,
  },
  remoteRPCClient: { read: remoteRead },
  // S3 is registered with no buckets, as when the AWS plugin is installed but unconfigured: the menu still names Drive.
  useRemoteMounts: () => ({
    data: {
      stores: [
        { scheme: "googledrive", label: "Google Drive" },
        { scheme: "s3", label: "Amazon S3" },
      ],
      mounts: remote.mounts,
    },
    error: undefined,
  }),
  useRemoteListing: (url: string | null) => ({ data: url ? { entries: [budget] } : undefined, error: undefined }),
  useRemoteSearch: () => ({ data: undefined, error: undefined }),
  chatRPCClient: {
    searchContext,
  },
  useChatUsage: () => ({
    data: {
      status: "success",
      model: "openai:gpt-5",
      cost: { input: 0.1, cachedInput: 0, output: 0.3, reasoning: 0, total: 0.42 },
      contextLength: 26_000,
      maxContextLength: 200_000,
      lastStepUsage: {},
      totalUsage: {},
      toolCount: 12,
    },
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: mock(),
  }),
  useFilesystemState: () => ({
    data: {
      status: "success",
      allowedPaths: [{ path: "/Users/example/projects/tokenring/one", permission: "write" }],
      selectedFiles: [],
      readFiles: {},
      dirty: false,
    },
    error: undefined,
    isLoading: false,
    isValidating: false,
    mutate: mock(),
  }),
}));

void mock.module("../HookSelector.tsx", () => ({ default: () => null }));
void mock.module("../ModelSelector.tsx", () => ({ default: () => null }));
void mock.module("../ToolApprovalSelector.tsx", () => ({ default: () => null }));
void mock.module("../ToolSelector.tsx", () => ({ default: () => null }));

function renderChatFooter(overrides: Partial<Parameters<typeof ChatFooter>[0]> = {}) {
  const props = {
    agentId: "test-agent",
    input: "",
    setInput: mock(),
    inputError: false,
    setInputError: mock(),
    idle: true,
    availableCommands: [],
    commandHistory: [],
    showHistory: false,
    setShowHistory: mock(),
    setShowFileBrowser: mock(),
    onSubmit: mock(),
    submitFeedback: null,
    ...overrides,
  };

  return render(<ChatFooter {...props} />);
}

type MediaRecorderHandler = (() => void) | null;

class MockMediaRecorder {
  static isTypeSupported = mock(() => true);

  state: "inactive" | "recording" = "inactive";
  mimeType: string;
  ondataavailable: ((event: { data: Blob }) => void) | null = null;
  onerror: MediaRecorderHandler = null;
  onstop: MediaRecorderHandler = null;
  start = mock((_timeslice?: number) => {
    this.state = "recording";
  });
  stop = mock(() => {
    this.state = "inactive";
    this.ondataavailable?.({ data: new Blob([new Uint8Array([1, 2, 3, 4])], { type: this.mimeType }) });
    this.onstop?.();
  });

  constructor(_stream: MediaStream, options?: { mimeType?: string }) {
    this.mimeType = options?.mimeType ?? "audio/webm";
  }
}

const originalMediaRecorder = (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
const originalFileReader = globalThis.FileReader;

function stubMediaDevices() {
  const trackStop = mock();
  const stream = {
    getTracks: () => [{ stop: trackStop }],
  } as unknown as MediaStream;

  const getUserMedia = mock(() => Promise.resolve(stream));
  Object.defineProperty(navigator, "mediaDevices", {
    configurable: true,
    value: { getUserMedia },
  });

  (globalThis as unknown as { MediaRecorder: typeof MockMediaRecorder }).MediaRecorder = MockMediaRecorder;

  return { getUserMedia, trackStop, stream };
}

function restoreMediaGlobals() {
  if (originalMediaRecorder !== undefined) {
    (globalThis as { MediaRecorder: unknown }).MediaRecorder = originalMediaRecorder;
  } else {
    delete (globalThis as { MediaRecorder?: unknown }).MediaRecorder;
  }
  globalThis.FileReader = originalFileReader;
}

describe("ChatFooter usage metrics", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  afterEach(() => {
    restoreMediaGlobals();
  });

  it("renders context, cost, and working directory indicators", () => {
    renderChatFooter();

    const metrics = screen.getByTestId("chat-footer-metrics");
    // 26k / 200k → 13% of context window used
    expect(metrics).toHaveTextContent("13% ctx");
    expect(metrics).toHaveTextContent("$0.42");
    // The working directory sits on its own, at the left.
    expect(screen.getByTestId("chat-footer-cwd")).toHaveTextContent("…/tokenring/one");
    expect(screen.getByTitle(/26k \/ 200k tokens/i)).toBeInTheDocument();
    expect(screen.getByTitle(/\/Users\/example\/projects\/tokenring\/one \(write\)/)).toBeInTheDocument();
  });
});

describe("ChatFooter file attachments", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  afterEach(() => {
    restoreMediaGlobals();
  });

  it("shows a warning toast when a file exceeds the size limit", async () => {
    const user = userEvent.setup();
    renderChatFooter();

    const oversizedFile = new File(["x"], "large.txt", { type: "text/plain" });
    Object.defineProperty(oversizedFile, "size", { value: 6 * 1024 * 1024 });

    const input = screen.getByLabelText("Upload files");
    await user.upload(input, oversizedFile);

    await waitFor(() => {
      expect(warningMock).toHaveBeenCalledWith('"large.txt" exceeds the 5MB limit and was not attached.', { duration: 5000 });
    });
  });

  it("shows an error toast when file reading fails", async () => {
    class FailingFileReader {
      onerror: (() => void) | null = null;
      onload: (() => void) | null = null;
      result: ArrayBuffer | null = null;
      readAsArrayBuffer = mock(() => {
        queueMicrotask(() => {
          this.onerror?.();
        });
      });
    }

    (globalThis as { FileReader: unknown }).FileReader = FailingFileReader;

    const user = userEvent.setup();
    renderChatFooter();

    const file = new File(["hello"], "broken.txt", { type: "text/plain" });
    const input = screen.getByLabelText("Upload files");
    await user.upload(input, file);

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith(expect.stringContaining('Failed to read "broken.txt":'), { duration: 5000 });
      expect(errorMock.mock.calls[0]?.[0]).toContain("Failed to read file");
    });
  });

  function pasteFiles(element: HTMLElement, files: File[]) {
    const items = files.map(file => ({
      kind: "file" as const,
      type: file.type,
      getAsFile: () => file,
    }));

    fireEvent.paste(element, {
      clipboardData: {
        files,
        items,
        types: files.map(file => file.type),
      },
    });
  }

  it("attaches a pasted image from the chat input", async () => {
    renderChatFooter();

    const image = new File([new Uint8Array([137, 80, 78, 71])], "screenshot.png", { type: "image/png" });
    pasteFiles(screen.getByLabelText("Command or message input"), [image]);

    await waitFor(() => {
      expect(screen.getByText("screenshot.png")).toBeInTheDocument();
    });
    expect(warningMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });

  it("names unnamed clipboard images when pasting", async () => {
    renderChatFooter();

    const image = new File([new Uint8Array([137, 80, 78, 71])], "", { type: "image/png" });
    pasteFiles(screen.getByLabelText("Command or message input"), [image]);

    await waitFor(() => {
      expect(screen.getByText(/pasted-.*\.png/)).toBeInTheDocument();
    });
  });

  it("attaches other supported types pasted into the input", async () => {
    renderChatFooter();

    const json = new File(['{"ok":true}'], "payload.json", { type: "application/json" });
    pasteFiles(screen.getByLabelText("Command or message input"), [json]);

    await waitFor(() => {
      expect(screen.getByText("payload.json")).toBeInTheDocument();
    });
  });

  it("warns when a pasted file type is not supported", async () => {
    renderChatFooter();

    const gif = new File([new Uint8Array([71, 73, 70])], "loop.gif", { type: "image/gif" });
    pasteFiles(screen.getByLabelText("Command or message input"), [gif]);

    await waitFor(() => {
      expect(warningMock).toHaveBeenCalledWith('"loop.gif" is not a supported attachment type and was not attached.', { duration: 5000 });
    });
    expect(screen.queryByText("loop.gif")).not.toBeInTheDocument();
  });

  it("warns when a pasted file exceeds the size limit", async () => {
    renderChatFooter();

    const oversized = new File(["x"], "huge.png", { type: "image/png" });
    Object.defineProperty(oversized, "size", { value: 6 * 1024 * 1024 });
    pasteFiles(screen.getByLabelText("Command or message input"), [oversized]);

    await waitFor(() => {
      expect(warningMock).toHaveBeenCalledWith('"huge.png" exceeds the 5MB limit and was not attached.', { duration: 5000 });
    });
    expect(screen.queryByText("huge.png")).not.toBeInTheDocument();
  });

  it("does not attach anything when the clipboard contains only text", async () => {
    renderChatFooter();

    fireEvent.paste(screen.getByLabelText("Command or message input"), {
      clipboardData: {
        files: [],
        items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
        types: ["text/plain"],
        getData: () => "hello",
      },
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 20));
    });

    expect(screen.queryByText(/file/)).not.toBeInTheDocument();
    expect(warningMock).not.toHaveBeenCalled();
    expect(errorMock).not.toHaveBeenCalled();
  });
});

describe("ChatFooter audio recording", () => {
  beforeEach(() => {
    mock.clearAllMocks();
  });

  afterEach(() => {
    restoreMediaGlobals();
  });

  it("starts recording when the mic button is clicked", async () => {
    const { getUserMedia } = stubMediaDevices();
    const user = userEvent.setup();
    renderChatFooter();

    await user.click(screen.getByRole("button", { name: "Record audio" }));

    await waitFor(() => {
      expect(getUserMedia).toHaveBeenCalledWith({ audio: true });
      expect(screen.getByRole("status", { name: "Recording in progress" })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: "Stop recording" })).toHaveAttribute("aria-pressed", "true");
    });
  });

  it("attaches recorded audio after stop", async () => {
    stubMediaDevices();
    const user = userEvent.setup();
    renderChatFooter();

    await user.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Recording in progress" })).toBeInTheDocument();
    });

    // Past MIN_RECORDING_MS (150) so finalizeRecording keeps the clip
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    await user.click(screen.getByRole("button", { name: "Stop recording and attach" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Record audio" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.getByText(/recording-/)).toBeInTheDocument();
    });
  });

  it("discards recording when cancelled", async () => {
    stubMediaDevices();
    const user = userEvent.setup();
    renderChatFooter();

    await user.click(screen.getByRole("button", { name: "Record audio" }));
    await waitFor(() => {
      expect(screen.getByRole("status", { name: "Recording in progress" })).toBeInTheDocument();
    });

    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 200));
    });

    await user.click(screen.getByRole("button", { name: "Cancel recording" }));

    await waitFor(() => {
      expect(screen.getByRole("button", { name: "Record audio" })).toHaveAttribute("aria-pressed", "false");
      expect(screen.queryByText(/recording-/)).not.toBeInTheDocument();
    });
  });

  it("shows an error when microphone permission is denied", async () => {
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: {
        getUserMedia: mock(() => Promise.reject(new Error("NotAllowedError: Permission denied"))),
      },
    });
    (globalThis as unknown as { MediaRecorder: typeof MockMediaRecorder }).MediaRecorder = MockMediaRecorder;

    const user = userEvent.setup();
    renderChatFooter();

    await user.click(screen.getByRole("button", { name: "Record audio" }));

    await waitFor(() => {
      expect(errorMock).toHaveBeenCalledWith("Microphone permission denied. Allow microphone access to record audio.", { duration: 5000 });
    });
  });
});

describe("ChatFooter contextual search", () => {
  beforeEach(() => {
    mock.clearAllMocks();
    searchContext.mockImplementation(async function* () {
      yield searchContextResult;
    });
  });

  afterEach(() => {
    restoreMediaGlobals();
  });

  it("searches after typing @ and replaces the query with the selected tag", async () => {
    const user = userEvent.setup();
    const setInput = mock();
    renderChatFooter({ input: "@rev", setInput });

    const textarea = screen.getByLabelText("Command or message input") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 4);

    await waitFor(() => {
      expect(searchContext).toHaveBeenCalledWith({ agentId: "test-agent", query: "rev" }, expect.any(AbortSignal));
      expect(screen.getByRole("listbox", { name: "Contextual search results" })).toBeInTheDocument();
      expect(screen.getByRole("option", { name: /code-review/ })).toBeInTheDocument();
    });

    await user.click(screen.getByRole("option", { name: /code-review/ }));
    expect(setInput).toHaveBeenCalledWith("@[skill:code-review] ");
  });

  it("inserts the selected tag with Enter and does not submit", async () => {
    const user = userEvent.setup();
    const setInput = mock();
    const onSubmit = mock();
    renderChatFooter({ input: "@rev", setInput, onSubmit });

    const textarea = screen.getByLabelText("Command or message input") as HTMLTextAreaElement;
    textarea.focus();
    textarea.setSelectionRange(4, 4);

    await waitFor(() => {
      expect(screen.getByRole("option", { name: /code-review/ })).toBeInTheDocument();
    });

    await user.keyboard("{Enter}");
    expect(setInput).toHaveBeenCalledWith("@[skill:code-review] ");
    expect(onSubmit).not.toHaveBeenCalled();
  });

  it("does not search when the input is a slash command", async () => {
    renderChatFooter({ input: "/help", availableCommands: ["help"] });

    expect(screen.getByRole("listbox", { name: "Command suggestions" })).toBeInTheDocument();
    expect(screen.queryByRole("listbox", { name: "Contextual search results" })).not.toBeInTheDocument();
    expect(searchContext).not.toHaveBeenCalled();
  });

  it("dismisses the picker on Escape without submitting", async () => {
    const user = userEvent.setup();
    const onSubmit = mock();
    renderChatFooter({ input: "@rev", onSubmit });

    screen.getByLabelText("Command or message input").focus();

    await waitFor(() => {
      expect(screen.getByRole("listbox", { name: "Contextual search results" })).toBeInTheDocument();
    });

    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("listbox", { name: "Contextual search results" })).not.toBeInTheDocument();
    });
    expect(onSubmit).not.toHaveBeenCalled();
  });
});

describe("ChatFooter queued inputs and drafts", () => {
  it("keeps the composer usable while the agent is busy and hints at queueing", () => {
    renderChatFooter({ idle: false });

    const input = screen.getByRole("textbox", { name: "Command or message input" });
    expect(input).not.toBeDisabled();
    expect(input.getAttribute("placeholder")).toContain("queued");
  });

  it("shows queued inputs with a cancel affordance and a queue count", async () => {
    const user = userEvent.setup();
    const onCancelQueuedInput = mock();
    renderChatFooter({
      idle: false,
      queuedInputs: [{ requestId: "q1", message: "follow up question" }],
      onCancelQueuedInput,
    });

    expect(screen.getByText("follow up question")).not.toBeNull();
    expect(screen.getByText(/^1 queued$/)).not.toBeNull();

    await user.click(screen.getByRole("button", { name: /cancel queued message/i }));
    expect(onCancelQueuedInput).toHaveBeenCalledWith("q1");
  });

  it("offers both Queue message and Stop when there is something to send while busy", () => {
    renderChatFooter({ idle: false, input: "next task please" });

    expect(screen.getByRole("button", { name: "Queue message" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Abort current operation" })).not.toBeNull();
  });

  it("offers Stop alongside Queue when only attachments are pending while busy", () => {
    const attachment = { name: "only-file.txt", encoding: "text" as const, mimeType: "text/plain" as const, body: "aGk=" };
    renderChatFooter({ idle: false, injectedDraft: { attachments: [attachment], nonce: 3 } });

    expect(screen.getByRole("button", { name: "Queue message" })).not.toBeNull();
    expect(screen.getByRole("button", { name: "Abort current operation" })).not.toBeNull();
  });

  it("still queues with Enter while busy", async () => {
    const user = userEvent.setup();
    const onSubmit = mock(() => Promise.resolve(true));
    renderChatFooter({ idle: false, input: "next task please", onSubmit });

    await user.click(screen.getByRole("textbox", { name: "Command or message input" }));
    await user.keyboard("{Enter}");
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("shows only Send (no Stop) when idle", () => {
    renderChatFooter({ idle: true, input: "hello" });

    expect(screen.getByRole("button", { name: "Send message" })).not.toBeNull();
    expect(screen.queryByRole("button", { name: "Abort current operation" })).toBeNull();
  });

  it("adopts injected draft attachments exactly once per nonce", () => {
    const attachment = { name: "draft-note.txt", encoding: "text" as const, mimeType: "text/plain" as const, body: "aGk=" };
    const injectedDraft = { attachments: [attachment], nonce: 1 };
    const { rerender } = renderChatFooter({ injectedDraft });

    expect(screen.getByText("draft-note.txt")).not.toBeNull();

    // Same nonce again (e.g. a parent re-render) must not duplicate the chip.
    rerender(
      <ChatFooter
        agentId="test-agent"
        input=""
        setInput={mock()}
        inputError={false}
        setInputError={mock()}
        idle={true}
        availableCommands={[]}
        commandHistory={[]}
        showHistory={false}
        setShowHistory={mock()}
        setShowFileBrowser={mock()}
        onSubmit={mock()}
        submitFeedback={null}
        injectedDraft={injectedDraft}
      />,
    );
    expect(screen.getAllByText("draft-note.txt")).toHaveLength(1);
  });
});

describe("ChatFooter submit outcome", () => {
  const attachment = { name: "keep-me.txt", encoding: "text" as const, mimeType: "text/plain" as const, body: "aGk=" };

  it("keeps attachment chips when the send fails", async () => {
    const user = userEvent.setup();
    let resolveSubmit: (delivered: boolean) => void = () => {};
    const onSubmit = mock(() => new Promise<boolean>(resolve => (resolveSubmit = resolve)));
    renderChatFooter({ input: "hello", onSubmit, injectedDraft: { attachments: [attachment], nonce: 7 } });

    await user.click(screen.getByRole("button", { name: "Send message" }));
    expect(onSubmit).toHaveBeenCalledWith([attachment]);
    // Still pending: the chip must not vanish before delivery is confirmed.
    expect(screen.getByText("keep-me.txt")).not.toBeNull();

    await act(async () => resolveSubmit(false));
    expect(screen.getByText("keep-me.txt")).not.toBeNull();
  });

  it("keeps attachment chips when onSubmit rejects", async () => {
    const user = userEvent.setup();
    const onSubmit = mock(() => Promise.reject(new Error("boom")));
    renderChatFooter({ input: "hello", onSubmit, injectedDraft: { attachments: [attachment], nonce: 8 } });

    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(onSubmit).toHaveBeenCalled());
    expect(screen.getByText("keep-me.txt")).not.toBeNull();
  });

  it("clears attachment chips once the send is delivered", async () => {
    const user = userEvent.setup();
    const onSubmit = mock(() => Promise.resolve(true));
    renderChatFooter({ input: "hello", onSubmit, injectedDraft: { attachments: [attachment], nonce: 9 } });

    await user.click(screen.getByRole("button", { name: "Send message" }));
    await waitFor(() => expect(screen.queryByText("keep-me.txt")).toBeNull());
  });

  it("reports a failed abort instead of leaving an unhandled rejection", async () => {
    const user = userEvent.setup();
    abortCurrentOperationMock.mockImplementationOnce(() => Promise.reject(new Error("socket closed")));
    errorMock.mockClear();
    renderChatFooter({ idle: false });

    await user.click(screen.getByRole("button", { name: "Abort current operation" }));
    await waitFor(() => expect(errorMock).toHaveBeenCalledWith(expect.stringContaining("Failed to stop the agent"), { duration: 5000 }));
  });
});

describe("ChatFooter composer", () => {
  it("puts adding files behind a + menu, with the remote file picker beside it", async () => {
    const setShowFileBrowser = mock();
    renderChatFooter({ setShowFileBrowser });
    expect(screen.queryByRole("button", { name: "Attach file" })).toBeNull();

    fireEvent.keyDown(screen.getByRole("button", { name: "Add to message" }), { key: "Enter" });
    const menu = screen.getByRole("menu");
    expect(within(menu).getByRole("menuitem", { name: "Add files or photos" })).toBeInTheDocument();
    fireEvent.click(within(menu).getByRole("menuitem", { name: "Choose from Files" }));
    // Opened only after the menu has closed and let go of focus.
    await waitFor(() => expect(setShowFileBrowser).toHaveBeenCalledWith(true));
  });

  it("keeps voice and history to the right of the message box", () => {
    renderChatFooter();
    const input = screen.getByRole("textbox", { name: "Command or message input" });
    const mic = screen.getByRole("button", { name: "Record audio" });
    const history = screen.getByRole("button", { name: "Show command history" });
    const add = screen.getByRole("button", { name: "Add to message" });
    // Document order: + , input, mic, history.
    expect(add.compareDocumentPosition(input) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(input.compareDocumentPosition(mic) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(mic.compareDocumentPosition(history) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("attaches a Drive file through the remote store, as text when the chat schema has no type for it", async () => {
    remote.mounts = [
      { scheme: "googledrive", authority: "work", url: "googledrive://work/", label: "Google Drive · work", writable: false, contextualSearch: false },
    ];
    try {
      const onSubmit = mock(async () => true);
      renderChatFooter({ input: "summarise this", onSubmit });

      fireEvent.keyDown(screen.getByRole("button", { name: "Add to message" }), { key: "Enter" });
      fireEvent.click(within(screen.getByRole("menu")).getByRole("menuitem", { name: "Attach from Google Drive" }));
      fireEvent.click(await screen.findByRole("button", { name: /Budget/ }));

      await waitFor(() => expect(remoteRead).toHaveBeenCalledWith({ url: "googledrive://work/budget-id" }));
      fireEvent.click(await screen.findByRole("button", { name: "Send message" }));
      await waitFor(() =>
        expect(onSubmit).toHaveBeenCalledWith([
          { name: "Budget", description: "From googledrive://work/budget-id", encoding: "text", mimeType: "text/plain", body: "a,b\n1,2\n" },
        ]),
      );
    } finally {
      remote.mounts = [];
    }
  });

  it("offers no remote attach when no remote store is configured", () => {
    renderChatFooter();
    fireEvent.keyDown(screen.getByRole("button", { name: "Add to message" }), { key: "Enter" });
    expect(within(screen.getByRole("menu")).queryByRole("menuitem", { name: /Attach from/ })).toBeNull();
  });
});
