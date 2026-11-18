import { afterEach, beforeEach, describe, expect, it, mock } from "bun:test";

const toastSuccess = mock((_message: string, _opts?: { duration?: number }) => "id");
const toastError = mock((_message: string, _opts?: { duration?: number }) => "id");

void mock.module("../components/ui/toast.tsx", () => ({
  toastManager: {
    success: toastSuccess,
    error: toastError,
    warning: mock(),
    info: mock(),
    remove: mock(),
  },
}));

const { copyToClipboard } = await import("./clipboard.ts");

/** jsdom does not implement execCommand; install a controllable stub. */
function installExecCommand(impl: (...args: unknown[]) => boolean) {
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: impl,
  });
}

function removeExecCommand() {
  // Restore to undefined (jsdom default)
  Object.defineProperty(document, "execCommand", {
    configurable: true,
    writable: true,
    value: undefined,
  });
}

describe("copyToClipboard", () => {
  let writeText: ReturnType<typeof mock>;
  let execCommand: ReturnType<typeof mock>;

  beforeEach(() => {
    toastSuccess.mockClear();
    toastError.mockClear();
    writeText = mock(async (_text: string) => undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText },
    });
    execCommand = mock((_command?: string) => true);
    installExecCommand(execCommand);
  });

  afterEach(() => {
    removeExecCommand();
  });

  it("copies via navigator.clipboard.writeText when available", async () => {
    const ok = await copyToClipboard("hello");
    expect(ok).toBe(true);
    expect(writeText).toHaveBeenCalledWith("hello");
    expect(toastSuccess).toHaveBeenCalledWith("Copied to clipboard", { duration: 2000 });
    expect(execCommand).not.toHaveBeenCalled();
  });

  it("uses a label in the success toast", async () => {
    const ok = await copyToClipboard("pkg", { label: "package name" });
    expect(ok).toBe(true);
    expect(toastSuccess).toHaveBeenCalledWith("Copied package name", { duration: 2000 });
  });

  it("respects successDuration", async () => {
    await copyToClipboard("x", { successDuration: 1500 });
    expect(toastSuccess).toHaveBeenCalledWith("Copied to clipboard", { duration: 1500 });
  });

  it("calls onSuccess instead of default toast", async () => {
    const onSuccess = mock((_text: string) => {});
    const ok = await copyToClipboard("secret", { onSuccess });
    expect(ok).toBe(true);
    expect(onSuccess).toHaveBeenCalledWith("secret");
    expect(toastSuccess).not.toHaveBeenCalled();
  });

  it("silent mode suppresses toasts", async () => {
    const ok = await copyToClipboard("quiet", { silent: true });
    expect(ok).toBe(true);
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("falls back to execCommand when writeText is missing", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });

    const ok = await copyToClipboard("fallback");
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(toastSuccess).toHaveBeenCalledWith("Copied to clipboard", { duration: 2000 });
  });

  it("falls back to execCommand when writeText rejects", async () => {
    writeText.mockImplementation(async () => {
      throw new Error("denied");
    });

    const ok = await copyToClipboard("fallback-reject");
    expect(ok).toBe(true);
    expect(execCommand).toHaveBeenCalledWith("copy");
    expect(toastSuccess).toHaveBeenCalled();
  });

  it("reports error when execCommand fails", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
    execCommand.mockReturnValue(false);

    const ok = await copyToClipboard("nope");
    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Could not copy to clipboard", { duration: 3000 });
  });

  it("reports error when execCommand is unavailable", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
    removeExecCommand();

    const ok = await copyToClipboard("no-exec");
    expect(ok).toBe(false);
    expect(toastError).toHaveBeenCalledWith("Could not copy to clipboard", { duration: 3000 });
  });

  it("prefers the original writeText error when fallback also fails", async () => {
    writeText.mockImplementation(async () => {
      throw new Error("Clipboard denied");
    });
    removeExecCommand();
    const onError = mock((_err: unknown) => {});

    const ok = await copyToClipboard("denied", { onError });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalled();
    const err = onError.mock.calls[0]![0];
    expect(err).toBeInstanceOf(Error);
    expect((err as Error).message).toBe("Clipboard denied");
  });

  it("calls onError instead of default error toast", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
    execCommand.mockImplementation(() => {
      throw new Error("boom");
    });
    const onError = mock((_err: unknown) => {});

    const ok = await copyToClipboard("err", { onError });
    expect(ok).toBe(false);
    expect(onError).toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it("cleans up the temporary textarea after fallback", async () => {
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: {},
    });
    const before = document.body.querySelectorAll("textarea").length;
    await copyToClipboard("cleanup");
    const after = document.body.querySelectorAll("textarea").length;
    expect(after).toBe(before);
  });
});
