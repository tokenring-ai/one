import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";
import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ChatFooter from "./ChatFooter.tsx";

const warningMock = mock();
const errorMock = mock();

void mock.module("../ui/toast.tsx", () => ({
  toastManager: {
    warning: warningMock,
    error: errorMock,
  },
}));

void mock.module("../../rpc.ts", () => ({
  agentRPCClient: {
    abortCurrentOperation: mock(),
  },
}));

void mock.module("../HookSelector.tsx", () => ({ default: () => null }));
void mock.module("../ModelSelector.tsx", () => ({ default: () => null }));
void mock.module("../SkillSelector.tsx", () => ({ default: () => null }));
void mock.module("../SubAgentSelector.tsx", () => ({ default: () => null }));
void mock.module("../ToolSelector.tsx", () => ({ default: () => null }));

function renderChatFooter(overrides: Partial<Parameters<typeof ChatFooter>[0]> = {}) {
  const props = {
    agentId: "test-agent",
    input: "",
    setInput: mock(),
    inputError: false,
    setInputError: mock(),
    idle: true,
    statusMessage: "Ready",
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
      expect(screen.getByText(/1 file/)).toBeInTheDocument();
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
